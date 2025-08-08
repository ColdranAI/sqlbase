package database

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type PostgresDB struct {
	pool   *pgxpool.Pool
	config *pgxpool.Config
	mu     sync.RWMutex
}

func NewPostgresDB(databaseURL string) (*PostgresDB, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}
	
	config.MaxConns = 30
	config.MinConns = 5
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = time.Minute * 30
	config.HealthCheckPeriod = time.Minute
	
	db := &PostgresDB{
		config: config,
	}
	
	if err := db.connect(); err != nil {
		return nil, err
	}
	
	go db.healthCheck()
	
	return db, nil
}

func (db *PostgresDB) connect() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	pool, err := pgxpool.NewWithConfig(ctx, db.config)
	if err != nil {
		return fmt.Errorf("failed to create connection pool: %w", err)
	}
	
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("failed to ping database: %w", err)
	}
	
	if db.pool != nil {
		db.pool.Close()
	}
	
	db.pool = pool
	log.Info().Msg("Database connection established")
	return nil
}

func (db *PostgresDB) healthCheck() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		if err := db.ping(); err != nil {
			log.Error().Err(err).Msg("Database health check failed, attempting reconnection")
			if err := db.connect(); err != nil {
				log.Error().Err(err).Msg("Failed to reconnect to database")
			}
		}
	}
}

func (db *PostgresDB) ping() error {
	db.mu.RLock()
	pool := db.pool
	db.mu.RUnlock()
	
	if pool == nil {
		return fmt.Errorf("database pool is nil")
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	return pool.Ping(ctx)
}

func (db *PostgresDB) GetPool() *pgxpool.Pool {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.pool
}

func (db *PostgresDB) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	pool := db.GetPool()
	if pool == nil {
		return nil, fmt.Errorf("database pool is not available")
	}
	return pool.Query(ctx, sql, args...)
}

func (db *PostgresDB) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	pool := db.GetPool()
	if pool == nil {
		return nil
	}
	return pool.QueryRow(ctx, sql, args...)
}

func (db *PostgresDB) Exec(ctx context.Context, sql string, args ...interface{}) error {
	pool := db.GetPool()
	if pool == nil {
		return fmt.Errorf("database pool is not available")
	}
	_, err := pool.Exec(ctx, sql, args...)
	return err
}

func (db *PostgresDB) Close() {
	db.mu.Lock()
	defer db.mu.Unlock()
	
	if db.pool != nil {
		db.pool.Close()
		db.pool = nil
		log.Info().Msg("Database connection closed")
	}
}

func (db *PostgresDB) InitTables() error {
	ctx := context.Background()
	
	queries := []string{
		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(255) UNIQUE NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'user',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS user_resources (
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL,
			resource_type VARCHAR(100) NOT NULL,
			resource_data JSONB,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS metrics (
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(255),
			metric_type VARCHAR(100) NOT NULL,
			metric_value DECIMAL,
			metadata JSONB,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		
		// Organization tables
		`CREATE TABLE IF NOT EXISTS organizations (
			id VARCHAR(255) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			slug VARCHAR(255) UNIQUE NOT NULL,
			description TEXT,
			plan VARCHAR(50) DEFAULT 'free',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		
		`CREATE TABLE IF NOT EXISTS organization_members (
			id VARCHAR(255) PRIMARY KEY,
			organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
			user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
			email VARCHAR(255) NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'member',
			status VARCHAR(50) NOT NULL DEFAULT 'active',
			joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			invited_by VARCHAR(255) REFERENCES users(user_id),
			UNIQUE(organization_id, user_id),
			UNIQUE(organization_id, email)
		)`,
		
		`CREATE TABLE IF NOT EXISTS organization_invitations (
			id VARCHAR(255) PRIMARY KEY,
			organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
			email VARCHAR(255) NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'member',
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			invited_by VARCHAR(255) REFERENCES users(user_id),
			invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			token VARCHAR(255) UNIQUE NOT NULL,
			project_access_type VARCHAR(50),
			specific_projects TEXT,
			message TEXT
		)`,
		
		`CREATE TABLE IF NOT EXISTS projects (
			id VARCHAR(255) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			last_activity TIMESTAMP WITH TIME ZONE,
			database_connected BOOLEAN DEFAULT FALSE,
			database_type VARCHAR(50),
			is_public BOOLEAN DEFAULT FALSE
		)`,
		
		// Indexes for performance
		`CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_user_resources_user_id ON user_resources(user_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_resources_user_type ON user_resources(user_id, resource_type)`,
		`CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_members_status ON organization_members(status)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_invitations_status ON organization_invitations(status)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at)`,
	}
	
	// Add triggers for updated_at columns
	triggerQueries := []string{
		`CREATE OR REPLACE FUNCTION update_updated_at_column()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ language 'plpgsql'`,
		
		`DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations`,
		`CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
		
		`DROP TRIGGER IF EXISTS update_projects_updated_at ON projects`,
		`CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
	}
	
	// Execute main queries
	for _, query := range queries {
		if err := db.Exec(ctx, query); err != nil {
			return fmt.Errorf("failed to execute query: %s, error: %w", query, err)
		}
	}
	
	// Execute trigger queries
	for _, query := range triggerQueries {
		if err := db.Exec(ctx, query); err != nil {
			log.Warn().Err(err).Str("query", query).Msg("Failed to create trigger, continuing...")
		}
	}
	
	log.Info().Msg("Database tables initialized")
	return nil
} 