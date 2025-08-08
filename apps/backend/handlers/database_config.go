package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"go-backend/auth"
	"go-backend/database"
	"go-backend/middleware"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type DatabaseConfigHandler struct {
	db            *database.PostgresDB
	redis         *database.RedisClient
	encryption    *auth.ConfigEncryption
	userDBPools   map[string]*pgxpool.Pool
	userSSHTunnels map[string]*database.SSHTunnel
	mu            sync.RWMutex
}

type DatabaseConfig struct {
	ConnectionType string      `json:"connection_type"`
	DatabaseURL    string      `json:"database_url"`
	SSHConfig      *SSHConfig  `json:"ssh_config,omitempty"`
	WireguardConfig *WireguardConfig `json:"wireguard_config,omitempty"`
}

type SSHConfig struct {
	Host    string `json:"host"`
	Port    string `json:"port"`
	User    string `json:"user"`
	KeyPath string `json:"key_path"`
}

type WireguardConfig struct {
	Config        string `json:"config"`
	InternalDBURL string `json:"internal_db_url"`
}

func NewDatabaseConfigHandler(db *database.PostgresDB, redis *database.RedisClient) *DatabaseConfigHandler {
	// Initialize encryption service
	encryption, err := auth.NewConfigEncryption()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize encryption service")
	}

	return &DatabaseConfigHandler{
		db:            db,
		redis:         redis,
		encryption:    encryption,
		userDBPools:   make(map[string]*pgxpool.Pool),
		userSSHTunnels: make(map[string]*database.SSHTunnel),
	}
}

func (h *DatabaseConfigHandler) CreateDatabaseConfig(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only configure your own database")
		return
	}

	var config DatabaseConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	if config.ConnectionType == "" {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "connection_type is required")
		return
	}

	// Validate based on connection type
	switch config.ConnectionType {
	case "postgresql":
		if config.DatabaseURL == "" {
			middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "database_url is required for PostgreSQL connection")
			return
		}
	case "ssh":
		if config.DatabaseURL == "" || config.SSHConfig == nil {
			middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "database_url and ssh_config are required for SSH connection")
			return
		}
	case "wireguard":
		if config.WireguardConfig == nil || config.WireguardConfig.InternalDBURL == "" {
			middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "wireguard_config with internal_db_url is required for WireGuard connection")
			return
		}
	default:
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("invalid connection type"), "supported connection types: postgresql, ssh, wireguard")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Start transaction to update multiple tables atomically
	pool := h.db.GetPool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Ensure user exists in backend users table
	err = h.ensureUserExists(ctx, tx, userID, claims.Email)
	if err != nil {
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to create user record")
		return
	}

	// Save configuration to appropriate table and update user flags
	switch config.ConnectionType {
	case "postgresql":
		err = h.saveDatabaseConfig(ctx, tx, userID, &config)
	case "ssh":
		err = h.saveSSHConfig(ctx, tx, userID, &config)
	case "wireguard":
		err = h.saveWireguardConfig(ctx, tx, userID, &config)
	}

	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Str("connection_type", config.ConnectionType).Msg("Failed to save configuration")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to save database configuration")
		return
	}

	// Update user connection flags and active connection type
	err = h.updateUserConnectionFlags(ctx, tx, userID, config.ConnectionType)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to update user flags")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to update user configuration")
		return
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to commit configuration")
		return
	}

	// Close existing connection to force refresh
	h.closeExistingUserConnection(userID)

	response := map[string]interface{}{
		"message": "Database configuration saved successfully",
		"config": map[string]interface{}{
			"connection_type": config.ConnectionType,
			"configured_at":   time.Now().UTC(),
		},
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
}

// ensureUserExists creates a user record in the backend users table if it doesn't exist
func (h *DatabaseConfigHandler) ensureUserExists(ctx context.Context, tx pgx.Tx, userID, email string) error {
	// Check if user exists
	var exists bool
	err := tx.QueryRow(ctx, 
		"SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1)", userID).Scan(&exists)
	
	if err != nil {
		return fmt.Errorf("failed to check user existence: %w", err)
	}

	if !exists {
		// Create user record
		_, err = tx.Exec(ctx, `
			INSERT INTO users (user_id, email, role, created_at, updated_at)
			VALUES ($1, $2, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			userID, email)
		
		if err != nil {
			return fmt.Errorf("failed to create user record: %w", err)
		}
		
		log.Info().Str("user_id", userID).Msg("Created new user record")
	}

	return nil
}

// saveDatabaseConfig saves PostgreSQL direct connection configuration
func (h *DatabaseConfigHandler) saveDatabaseConfig(ctx context.Context, tx pgx.Tx, userID string, config *DatabaseConfig) error {
	// Encrypt sensitive database URL
	encryptedURL, err := h.encryption.EncryptConfig(userID, "postgresql", []byte(config.DatabaseURL))
	if err != nil {
		return fmt.Errorf("failed to encrypt database URL: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO database_configs (user_id, database_url_encrypted, is_active, created_at, updated_at)
		VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) 
		DO UPDATE SET 
			database_url_encrypted = EXCLUDED.database_url_encrypted,
			is_active = true,
			updated_at = CURRENT_TIMESTAMP`,
		userID, encryptedURL)

	if err == nil {
		log.Info().
			Str("user_id", userID).
			Msg("PostgreSQL configuration saved with AES-256-GCM encryption")
	}

	return err
}

// saveSSHConfig saves SSH tunnel configuration
func (h *DatabaseConfigHandler) saveSSHConfig(ctx context.Context, tx pgx.Tx, userID string, config *DatabaseConfig) error {
	// Encrypt sensitive SSH configuration data
	encryptedHost, err := h.encryption.EncryptConfig(userID, "ssh", []byte(config.SSHConfig.Host))
	if err != nil {
		return fmt.Errorf("failed to encrypt SSH host: %w", err)
	}

	encryptedUsername, err := h.encryption.EncryptConfig(userID, "ssh", []byte(config.SSHConfig.User))
	if err != nil {
		return fmt.Errorf("failed to encrypt SSH username: %w", err)
	}

	encryptedKeyPath, err := h.encryption.EncryptConfig(userID, "ssh", []byte(config.SSHConfig.KeyPath))
	if err != nil {
		return fmt.Errorf("failed to encrypt SSH key path: %w", err)
	}

	encryptedDBURL, err := h.encryption.EncryptConfig(userID, "ssh", []byte(config.DatabaseURL))
	if err != nil {
		return fmt.Errorf("failed to encrypt SSH database URL: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO ssh_configs (user_id, host_encrypted, port, username_encrypted, key_path_encrypted, database_url_encrypted, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) 
		DO UPDATE SET 
			host_encrypted = EXCLUDED.host_encrypted,
			port = EXCLUDED.port,
			username_encrypted = EXCLUDED.username_encrypted,
			key_path_encrypted = EXCLUDED.key_path_encrypted,
			database_url_encrypted = EXCLUDED.database_url_encrypted,
			is_active = true,
			tunnel_status = 'disconnected',
			updated_at = CURRENT_TIMESTAMP`,
		userID, encryptedHost, config.SSHConfig.Port, encryptedUsername, 
		encryptedKeyPath, encryptedDBURL)

	if err == nil {
		log.Info().
			Str("user_id", userID).
			Msg("SSH configuration saved with AES-256-GCM encryption")
	}

	return err
}

// saveWireguardConfig saves WireGuard VPN configuration
func (h *DatabaseConfigHandler) saveWireguardConfig(ctx context.Context, tx pgx.Tx, userID string, config *DatabaseConfig) error {
	// Encrypt sensitive WireGuard configuration data
	encryptedConfig, err := h.encryption.EncryptConfig(userID, "wireguard", []byte(config.WireguardConfig.Config))
	if err != nil {
		return fmt.Errorf("failed to encrypt WireGuard config: %w", err)
	}

	encryptedDBURL, err := h.encryption.EncryptConfig(userID, "wireguard", []byte(config.WireguardConfig.InternalDBURL))
	if err != nil {
		return fmt.Errorf("failed to encrypt WireGuard internal DB URL: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO wireguard_configs (user_id, config_content_encrypted, internal_db_url_encrypted, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) 
		DO UPDATE SET 
			config_content_encrypted = EXCLUDED.config_content_encrypted,
			internal_db_url_encrypted = EXCLUDED.internal_db_url_encrypted,
			is_active = true,
			vpn_status = 'disconnected',
			updated_at = CURRENT_TIMESTAMP`,
		userID, encryptedConfig, encryptedDBURL)

	if err == nil {
		log.Info().
			Str("user_id", userID).
			Msg("WireGuard configuration saved with AES-256-GCM encryption")
	}

	return err
}

// updateUserConnectionFlags updates the boolean flags on the users table
func (h *DatabaseConfigHandler) updateUserConnectionFlags(ctx context.Context, tx pgx.Tx, userID, connectionType string) error {
	var setFlag string
	switch connectionType {
	case "postgresql":
		setFlag = "has_database_url_config = true"
	case "ssh":
		setFlag = "has_ssh_config = true"
	case "wireguard":
		setFlag = "has_wireguard_config = true"
	default:
		return fmt.Errorf("unknown connection type: %s", connectionType)
	}

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		UPDATE users SET 
			%s,
			active_connection_type = $2,
			total_connections = total_connections + 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1`, setFlag),
		userID, connectionType)

	return err
}

func (h *DatabaseConfigHandler) TestDatabaseConnection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only test your own database connection")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	config, err := h.getUserDatabaseConfig(ctx, userID)
	if err != nil {
		middleware.WriteErrorResponse(w, http.StatusNotFound, err, "Database configuration not found")
		return
	}

	pool, sshTunnel, err := h.createUserConnection(ctx, userID, config)
	if err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Failed to connect to database")
		return
	}

	defer func() {
		if pool != nil {
			pool.Close()
		}
		if sshTunnel != nil {
			sshTunnel.Close()
		}
	}()

	if err := pool.Ping(ctx); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Database connection test failed")
		return
	}

	response := map[string]interface{}{
		"message":         "Database connection successful",
		"connection_type": config.ConnectionType,
		"tested_at":       time.Now().UTC(),
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
}

// TestDatabaseURL tests a database configuration without saving it
func (h *DatabaseConfigHandler) TestDatabaseURL(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only test your own database connection")
		return
	}

	var config DatabaseConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	if config.ConnectionType == "" {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "connection_type is required")
		return
	}

	// Validate based on connection type
	switch config.ConnectionType {
	case "postgresql":
		if config.DatabaseURL == "" {
			middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "database_url is required for PostgreSQL connection")
			return
		}
	case "ssh":
		if config.DatabaseURL == "" || config.SSHConfig == nil {
			middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "database_url and ssh_config are required for SSH connection")
			return
		}
	case "wireguard":
		if config.WireguardConfig == nil || config.WireguardConfig.InternalDBURL == "" {
			middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "wireguard_config with internal_db_url is required for WireGuard connection")
			return
		}
	default:
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("invalid connection type"), "supported connection types: postgresql, ssh, wireguard")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	log.Info().
		Str("user_id", userID).
		Str("connection_type", config.ConnectionType).
		Str("database_url", maskPassword(config.DatabaseURL)).
		Msg("Testing database connection")

	pool, sshTunnel, err := h.createUserConnection(ctx, userID, &config)
	if err != nil {
		log.Warn().
			Err(err).
			Str("user_id", userID).
			Str("database_url", maskPassword(config.DatabaseURL)).
			Msg("Database connection test failed")
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Failed to connect to database")
		return
	}

	defer func() {
		if pool != nil {
			pool.Close()
		}
		if sshTunnel != nil {
			sshTunnel.Close()
		}
	}()

	if err := pool.Ping(ctx); err != nil {
		log.Warn().
			Err(err).
			Str("user_id", userID).
			Str("database_url", maskPassword(config.DatabaseURL)).
			Msg("Database ping failed")
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Database connection test failed")
		return
	}

	log.Info().
		Str("user_id", userID).
		Str("connection_type", config.ConnectionType).
		Str("database_url", maskPassword(config.DatabaseURL)).
		Msg("Database connection test successful")

	response := map[string]interface{}{
		"message":         "Database connection successful",
		"connection_type": config.ConnectionType,
		"tested_at":       time.Now().UTC(),
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
}

// maskPassword masks the password in database URL for logging
func maskPassword(url string) string {
	if strings.Contains(url, "@") {
		parts := strings.Split(url, "@")
		if len(parts) == 2 {
			userInfo := strings.Split(parts[0], ":")
			if len(userInfo) >= 2 {
				userInfo[len(userInfo)-1] = "***"
				return strings.Join(userInfo, ":") + "@" + parts[1]
			}
		}
	}
	return url
}

func (h *DatabaseConfigHandler) DeleteDatabaseConfig(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only delete your own database configuration")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	query := `DELETE FROM user_resources WHERE user_id = $1 AND resource_type = 'database_config'`
	
	if err := h.db.Exec(ctx, query, userID); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to delete database configuration")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to delete database configuration")
		return
	}

	h.closeExistingUserConnection(userID)

	response := map[string]interface{}{
		"message": "Database configuration deleted successfully",
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
}

func (h *DatabaseConfigHandler) GetUserDatabaseConnection(userID string) (*pgxpool.Pool, error) {
	h.mu.RLock()
	if pool, exists := h.userDBPools[userID]; exists {
		h.mu.RUnlock()
		return pool, nil
	}
	h.mu.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	config, err := h.getUserDatabaseConfig(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user database config: %w", err)
	}

	pool, sshTunnel, err := h.createUserConnection(ctx, userID, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create user database connection: %w", err)
	}

	h.mu.Lock()
	h.userDBPools[userID] = pool
	if sshTunnel != nil {
		h.userSSHTunnels[userID] = sshTunnel
	}
	h.mu.Unlock()

	return pool, nil
}

func (h *DatabaseConfigHandler) getUserDatabaseConfig(ctx context.Context, userID string) (*DatabaseConfig, error) {
	// First check which connection type is active for this user
	var activeConnectionType string
	err := h.db.QueryRow(ctx, 
		"SELECT active_connection_type FROM users WHERE user_id = $1", userID).Scan(&activeConnectionType)
	
	if err != nil {
		return nil, fmt.Errorf("user configuration not found for user %s", userID)
	}

	if activeConnectionType == "" {
		return nil, fmt.Errorf("no active connection configured for user %s", userID)
	}

	// Load configuration based on active connection type
	switch activeConnectionType {
	case "postgresql":
		return h.loadDatabaseConfig(ctx, userID)
	case "ssh":
		return h.loadSSHConfig(ctx, userID)
	case "wireguard":
		return h.loadWireguardConfig(ctx, userID)
	default:
		return nil, fmt.Errorf("unknown connection type: %s", activeConnectionType)
	}
}

// loadDatabaseConfig loads PostgreSQL direct connection configuration
func (h *DatabaseConfigHandler) loadDatabaseConfig(ctx context.Context, userID string) (*DatabaseConfig, error) {
	var encryptedDBURL string
	err := h.db.QueryRow(ctx, 
		"SELECT database_url_encrypted FROM database_configs WHERE user_id = $1 AND is_active = true", 
		userID).Scan(&encryptedDBURL)
	
	if err != nil {
		return nil, fmt.Errorf("database configuration not found: %w", err)
	}

	// Decrypt the database URL
	decryptedURL, err := h.encryption.DecryptConfig(userID, "postgresql", encryptedDBURL)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt database URL: %w", err)
	}
	defer auth.ZeroBytes(decryptedURL) // Securely clear from memory

	return &DatabaseConfig{
		ConnectionType: "postgresql",
		DatabaseURL:    string(decryptedURL),
	}, nil
}

// loadSSHConfig loads SSH tunnel configuration
func (h *DatabaseConfigHandler) loadSSHConfig(ctx context.Context, userID string) (*DatabaseConfig, error) {
	var encryptedHost, encryptedUsername, encryptedKeyPath, encryptedDBURL string
	var port int
	
	err := h.db.QueryRow(ctx, `
		SELECT host_encrypted, port, username_encrypted, key_path_encrypted, database_url_encrypted 
		FROM ssh_configs 
		WHERE user_id = $1 AND is_active = true`, 
		userID).Scan(&encryptedHost, &port, &encryptedUsername, &encryptedKeyPath, &encryptedDBURL)
	
	if err != nil {
		return nil, fmt.Errorf("SSH configuration not found: %w", err)
	}

	// Decrypt all sensitive SSH configuration data
	decryptedHost, err := h.encryption.DecryptConfig(userID, "ssh", encryptedHost)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt SSH host: %w", err)
	}
	defer auth.ZeroBytes(decryptedHost)

	decryptedUsername, err := h.encryption.DecryptConfig(userID, "ssh", encryptedUsername)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt SSH username: %w", err)
	}
	defer auth.ZeroBytes(decryptedUsername)

	decryptedKeyPath, err := h.encryption.DecryptConfig(userID, "ssh", encryptedKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt SSH key path: %w", err)
	}
	defer auth.ZeroBytes(decryptedKeyPath)

	decryptedDBURL, err := h.encryption.DecryptConfig(userID, "ssh", encryptedDBURL)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt SSH database URL: %w", err)
	}
	defer auth.ZeroBytes(decryptedDBURL)

	return &DatabaseConfig{
		ConnectionType: "ssh",
		DatabaseURL:    string(decryptedDBURL),
		SSHConfig: &SSHConfig{
			Host:    string(decryptedHost),
			Port:    fmt.Sprintf("%d", port),
			User:    string(decryptedUsername),
			KeyPath: string(decryptedKeyPath),
		},
	}, nil
}

// loadWireguardConfig loads WireGuard VPN configuration
func (h *DatabaseConfigHandler) loadWireguardConfig(ctx context.Context, userID string) (*DatabaseConfig, error) {
	var encryptedConfigContent, encryptedInternalDBURL string
	
	err := h.db.QueryRow(ctx, `
		SELECT config_content_encrypted, internal_db_url_encrypted 
		FROM wireguard_configs 
		WHERE user_id = $1 AND is_active = true`, 
		userID).Scan(&encryptedConfigContent, &encryptedInternalDBURL)
	
	if err != nil {
		return nil, fmt.Errorf("WireGuard configuration not found: %w", err)
	}

	// Decrypt sensitive WireGuard configuration data
	decryptedConfig, err := h.encryption.DecryptConfig(userID, "wireguard", encryptedConfigContent)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt WireGuard config: %w", err)
	}
	defer auth.ZeroBytes(decryptedConfig)

	decryptedDBURL, err := h.encryption.DecryptConfig(userID, "wireguard", encryptedInternalDBURL)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt WireGuard internal DB URL: %w", err)
	}
	defer auth.ZeroBytes(decryptedDBURL)

	return &DatabaseConfig{
		ConnectionType: "wireguard",
		DatabaseURL:    "", // Not used for WireGuard
		WireguardConfig: &WireguardConfig{
			Config:        string(decryptedConfig),
			InternalDBURL: string(decryptedDBURL),
		},
	}, nil
}

func (h *DatabaseConfigHandler) createUserConnection(ctx context.Context, userID string, config *DatabaseConfig) (*pgxpool.Pool, *database.SSHTunnel, error) {
	var dbURL string
	var sshTunnel *database.SSHTunnel

	switch config.ConnectionType {
	case "postgresql":
		dbURL = config.DatabaseURL

	case "ssh":
		if config.SSHConfig == nil {
			return nil, nil, fmt.Errorf("SSH configuration is required for SSH connection type")
		}

		localPort := 15432 + len(h.userSSHTunnels)
		localAddr := fmt.Sprintf("localhost:%d", localPort)
		remoteAddr := "localhost:5432"

		tunnel, err := database.NewSSHTunnel(
			config.SSHConfig.Host,
			config.SSHConfig.Port,
			config.SSHConfig.User,
			config.SSHConfig.KeyPath,
			localAddr,
			remoteAddr,
		)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create SSH tunnel: %w", err)
		}

		sshTunnel = tunnel
		
		// Parse the original URL to extract credentials and database name
		originalURL := config.DatabaseURL
		poolConfig, err := pgxpool.ParseConfig(originalURL)
		if err != nil {
			sshTunnel.Close()
			return nil, nil, fmt.Errorf("failed to parse original database URL: %w", err)
		}
		
		// Construct new URL using local tunnel endpoint
		dbURL = fmt.Sprintf("postgresql://%s:%s@localhost:%d/%s",
			poolConfig.ConnConfig.User,
			poolConfig.ConnConfig.Password,
			localPort,
			poolConfig.ConnConfig.Database,
		)
		
		// Add any additional parameters from original URL
		if len(poolConfig.ConnConfig.RuntimeParams) > 0 {
			dbURL += "?"
			var params []string
			for key, value := range poolConfig.ConnConfig.RuntimeParams {
				params = append(params, fmt.Sprintf("%s=%s", key, value))
			}
			dbURL += strings.Join(params, "&")
		}

	case "wireguard":
		if config.WireguardConfig == nil {
			return nil, nil, fmt.Errorf("WireGuard configuration is required for WireGuard connection type")
		}
		if config.WireguardConfig.InternalDBURL == "" {
			return nil, nil, fmt.Errorf("internal database URL is required for WireGuard connection")
		}
		// Note: This is a simplified implementation. A full WireGuard implementation
		// would require setting up the WireGuard interface and routing.
		// For now, we assume the WireGuard connection is already established
		// and we can connect to the internal database URL directly.
		dbURL = config.WireguardConfig.InternalDBURL

	default:
		return nil, nil, fmt.Errorf("unsupported connection type: %s", config.ConnectionType)
	}

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		if sshTunnel != nil {
			sshTunnel.Close()
		}
		return nil, nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	poolConfig.MaxConns = 10
	poolConfig.MinConns = 2
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnIdleTime = time.Minute * 15

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		if sshTunnel != nil {
			sshTunnel.Close()
		}
		return nil, nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		if sshTunnel != nil {
			sshTunnel.Close()
		}
		return nil, nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, sshTunnel, nil
}

func (h *DatabaseConfigHandler) closeExistingUserConnection(userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if pool, exists := h.userDBPools[userID]; exists {
		pool.Close()
		delete(h.userDBPools, userID)
	}

	if tunnel, exists := h.userSSHTunnels[userID]; exists {
		tunnel.Close()
		delete(h.userSSHTunnels, userID)
	}
}

func (h *DatabaseConfigHandler) CleanupUserConnections() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for userID, pool := range h.userDBPools {
		pool.Close()
		delete(h.userDBPools, userID)
	}

	for userID, tunnel := range h.userSSHTunnels {
		tunnel.Close()
		delete(h.userSSHTunnels, userID)
	}
} 