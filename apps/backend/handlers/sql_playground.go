package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go-backend/database"
	"go-backend/middleware"
	"go-backend/models"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type SQLPlaygroundHandler struct {
	db              *database.PostgresDB
	redis           *database.RedisClient
	dbConfigHandler *DatabaseConfigHandler
}

type QueryRequest struct {
	SQL      string            `json:"sql"`
	Params   []interface{}     `json:"params,omitempty"`
	Options  QueryOptions      `json:"options,omitempty"`
}

type QueryOptions struct {
	Limit         int  `json:"limit,omitempty"`
	Timeout       int  `json:"timeout,omitempty"`
	ExplainPlan   bool `json:"explain_plan,omitempty"`
	DryRun        bool `json:"dry_run,omitempty"`
}

type QueryResult struct {
	Columns      []string        `json:"columns"`
	Rows         [][]interface{} `json:"rows"`
	RowCount     int64           `json:"row_count"`
	ExecutionTime float64        `json:"execution_time_ms"`
	ExplainPlan  []map[string]interface{} `json:"explain_plan,omitempty"`
	Warnings     []string        `json:"warnings,omitempty"`
}

type SchemaInfo struct {
	Tables []TableInfo `json:"tables"`
	Views  []ViewInfo  `json:"views"`
}

type TableInfo struct {
	Name        string       `json:"name"`
	Schema      string       `json:"schema"`
	Columns     []ColumnInfo `json:"columns"`
	RowCount    int64        `json:"row_count,omitempty"`
	Size        string       `json:"size,omitempty"`
}

type ViewInfo struct {
	Name       string       `json:"name"`
	Schema     string       `json:"schema"`
	Definition string       `json:"definition"`
	Columns    []ColumnInfo `json:"columns"`
}

type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Nullable     bool   `json:"nullable"`
	DefaultValue string `json:"default_value,omitempty"`
	IsPrimaryKey bool   `json:"is_primary_key"`
	IsForeignKey bool   `json:"is_foreign_key"`
}

func NewSQLPlaygroundHandler(db *database.PostgresDB, redis *database.RedisClient, dbConfigHandler *DatabaseConfigHandler) *SQLPlaygroundHandler {
	return &SQLPlaygroundHandler{
		db:              db,
		redis:           redis,
		dbConfigHandler: dbConfigHandler,
	}
}

func (h *SQLPlaygroundHandler) ExecuteQuery(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only execute queries on your own database")
		return
	}

	var req QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	if req.SQL == "" {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing SQL query"), "SQL query is required")
		return
	}

	// Security: Prevent dangerous operations
	if h.isDangerousQuery(req.SQL) {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("dangerous query detected"), "DROP, DELETE, TRUNCATE, and other destructive operations are restricted")
		return
	}

	// Set default options
	if req.Options.Limit == 0 {
		req.Options.Limit = 1000
	}
	if req.Options.Timeout == 0 {
		req.Options.Timeout = 30
	}

	// Get user's database connection
	userPool, err := h.dbConfigHandler.GetUserDatabaseConnection(userID)
	if err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Failed to connect to your database")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(req.Options.Timeout)*time.Second)
	defer cancel()

	startTime := time.Now()

	// Execute query
	result, err := h.executeSQL(ctx, userPool, req)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Str("sql", req.SQL).Msg("Query execution failed")
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Query execution failed")
		return
	}

	result.ExecutionTime = float64(time.Since(startTime).Nanoseconds()) / 1e6

	// Log the query execution
	go h.logQueryExecution(userID, req.SQL, result.RowCount, result.ExecutionTime)

	middleware.WriteJSONResponse(w, http.StatusOK, result)
}

func (h *SQLPlaygroundHandler) GetDatabaseSchema(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only access your own database schema")
		return
	}

	userPool, err := h.dbConfigHandler.GetUserDatabaseConnection(userID)
	if err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Failed to connect to your database")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	schema, err := h.getDatabaseSchema(ctx, userPool)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get database schema")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve database schema")
		return
	}

	middleware.WriteJSONResponse(w, http.StatusOK, schema)
}

func (h *SQLPlaygroundHandler) GetQueryHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only access your own query history")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var pagination models.PaginationQuery
	if err := r.ParseForm(); err == nil {
		if page := r.Form.Get("page"); page != "" {
			if p, err := strconv.Atoi(page); err == nil {
				pagination.Page = p
			}
		}
		if limit := r.Form.Get("limit"); limit != "" {
			if l, err := strconv.Atoi(limit); err == nil {
				pagination.Limit = l
			}
		}
	}
	pagination.Normalize()

	// Get query history from metrics table
	query := `
		SELECT metadata, created_at 
		FROM metrics 
		WHERE user_id = $1 AND metric_type = 'sql_query'
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := h.db.Query(ctx, query, userID, pagination.Limit, pagination.Offset())
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get query history")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve query history")
		return
	}
	defer rows.Close()

	var history []map[string]interface{}
	for rows.Next() {
		var metadata []byte
		var createdAt time.Time
		
		if err := rows.Scan(&metadata, &createdAt); err != nil {
			continue
		}

		var queryData map[string]interface{}
		if err := json.Unmarshal(metadata, &queryData); err == nil {
			queryData["executed_at"] = createdAt
			history = append(history, queryData)
		}
	}

	middleware.WriteJSONResponse(w, http.StatusOK, map[string]interface{}{
		"history": history,
		"page":    pagination.Page,
		"limit":   pagination.Limit,
	})
}

func (h *SQLPlaygroundHandler) executeSQL(ctx context.Context, pool *pgxpool.Pool, req QueryRequest) (*QueryResult, error) {
	sql := strings.TrimSpace(req.SQL)
	
	// Add EXPLAIN if requested
	if req.Options.ExplainPlan {
		sql = "EXPLAIN (FORMAT JSON, ANALYZE true) " + sql
	}

	// Add LIMIT if not present and it's a SELECT
	if strings.HasPrefix(strings.ToUpper(sql), "SELECT") && !strings.Contains(strings.ToUpper(sql), "LIMIT") {
		sql = fmt.Sprintf("%s LIMIT %d", sql, req.Options.Limit)
	}

	rows, err := pool.Query(ctx, sql, req.Params...)
	if err != nil {
		return nil, fmt.Errorf("query execution error: %w", err)
	}
	defer rows.Close()

	return h.parseQueryResult(rows, req.Options.ExplainPlan)
}

func (h *SQLPlaygroundHandler) parseQueryResult(rows pgx.Rows, isExplain bool) (*QueryResult, error) {
	fieldDescriptions := rows.FieldDescriptions()
	columns := make([]string, len(fieldDescriptions))
	for i, fd := range fieldDescriptions {
		columns[i] = string(fd.Name)
	}

	var data [][]interface{}
	var explainPlan []map[string]interface{}

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		if isExplain && len(values) > 0 {
			// Parse EXPLAIN JSON output
			if jsonStr, ok := values[0].(string); ok {
				var plan []map[string]interface{}
				if err := json.Unmarshal([]byte(jsonStr), &plan); err == nil {
					explainPlan = plan
				}
			}
		}

		data = append(data, values)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	result := &QueryResult{
		Columns:     columns,
		Rows:        data,
		RowCount:    int64(len(data)),
		ExplainPlan: explainPlan,
	}

	return result, nil
}

func (h *SQLPlaygroundHandler) getDatabaseSchema(ctx context.Context, pool *pgxpool.Pool) (*SchemaInfo, error) {
	schema := &SchemaInfo{}

	// Get tables
	tablesQuery := `
		SELECT 
			t.table_name,
			t.table_schema,
			COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) as row_count
		FROM information_schema.tables t
		LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
		WHERE t.table_type = 'BASE TABLE' 
		AND t.table_schema NOT IN ('information_schema', 'pg_catalog')
		ORDER BY t.table_schema, t.table_name
	`

	rows, err := pool.Query(ctx, tablesQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to get tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var table TableInfo
		var rowCount int64
		
		if err := rows.Scan(&table.Name, &table.Schema, &rowCount); err != nil {
			continue
		}
		
		table.RowCount = rowCount
		
		// Get columns for this table
		columns, err := h.getTableColumns(ctx, pool, table.Schema, table.Name)
		if err == nil {
			table.Columns = columns
		}
		
		schema.Tables = append(schema.Tables, table)
	}

	// Get views
	viewsQuery := `
		SELECT table_name, table_schema, view_definition
		FROM information_schema.views
		WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
		ORDER BY table_schema, table_name
	`

	viewRows, err := pool.Query(ctx, viewsQuery)
	if err == nil {
		defer viewRows.Close()
		
		for viewRows.Next() {
			var view ViewInfo
			
			if err := viewRows.Scan(&view.Name, &view.Schema, &view.Definition); err != nil {
				continue
			}
			
			// Get columns for this view
			columns, err := h.getTableColumns(ctx, pool, view.Schema, view.Name)
			if err == nil {
				view.Columns = columns
			}
			
			schema.Views = append(schema.Views, view)
		}
	}

	return schema, nil
}

func (h *SQLPlaygroundHandler) getTableColumns(ctx context.Context, pool *pgxpool.Pool, schemaName, tableName string) ([]ColumnInfo, error) {
	query := `
		SELECT 
			c.column_name,
			c.data_type,
			c.is_nullable = 'YES' as nullable,
			c.column_default,
			CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
			CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
		FROM information_schema.columns c
		LEFT JOIN information_schema.table_constraints tc ON tc.table_name = c.table_name AND tc.table_schema = c.table_schema AND tc.constraint_type = 'PRIMARY KEY'
		LEFT JOIN information_schema.key_column_usage pk ON pk.constraint_name = tc.constraint_name AND pk.column_name = c.column_name
		LEFT JOIN information_schema.key_column_usage fk ON fk.table_name = c.table_name AND fk.table_schema = c.table_schema AND fk.column_name = c.column_name
		LEFT JOIN information_schema.table_constraints fkc ON fkc.constraint_name = fk.constraint_name AND fkc.constraint_type = 'FOREIGN KEY'
		WHERE c.table_schema = $1 AND c.table_name = $2
		ORDER BY c.ordinal_position
	`

	rows, err := pool.Query(ctx, query, schemaName, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var defaultValue *string
		
		if err := rows.Scan(&col.Name, &col.Type, &col.Nullable, &defaultValue, &col.IsPrimaryKey, &col.IsForeignKey); err != nil {
			continue
		}
		
		if defaultValue != nil {
			col.DefaultValue = *defaultValue
		}
		
		columns = append(columns, col)
	}

	return columns, nil
}

func (h *SQLPlaygroundHandler) isDangerousQuery(sql string) bool {
	dangerous := []string{
		"DROP ", "DELETE ", "TRUNCATE ", "ALTER ", "CREATE USER", "DROP USER",
		"GRANT ", "REVOKE ", "INSERT ", "UPDATE ", "COPY ",
	}

	upperSQL := strings.ToUpper(strings.TrimSpace(sql))
	for _, keyword := range dangerous {
		if strings.Contains(upperSQL, keyword) {
			return true
		}
	}
	return false
}

func (h *SQLPlaygroundHandler) logQueryExecution(userID, sql string, rowCount int64, executionTime float64) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	metadata := map[string]interface{}{
		"sql":            sql[:min(1000, len(sql))], // Truncate long queries
		"row_count":      rowCount,
		"execution_time": executionTime,
	}

	metadataBytes, _ := json.Marshal(metadata)

	query := `
		INSERT INTO metrics (user_id, metric_type, metric_value, metadata, created_at)
		VALUES ($1, 'sql_query', $2, $3, CURRENT_TIMESTAMP)
	`

	h.db.Exec(ctx, query, userID, executionTime, metadataBytes)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
} 