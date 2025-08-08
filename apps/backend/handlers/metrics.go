package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"go-backend/database"
	"go-backend/middleware"
	"go-backend/models"
	"github.com/rs/zerolog/log"
)

type MetricsHandler struct {
	db    *database.PostgresDB
	redis *database.RedisClient
}

func NewMetricsHandler(db *database.PostgresDB, redis *database.RedisClient) *MetricsHandler {
	return &MetricsHandler{
		db:    db,
		redis: redis,
	}
}

func (h *MetricsHandler) CreateMetric(w http.ResponseWriter, r *http.Request) {
	var req models.CreateMetricRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	if req.MetricType == "" {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "metric_type is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var userID *string
	if claims := middleware.GetUserClaims(r.Context()); claims != nil {
		userID = &claims.UserID
	}

	var metadataBytes []byte
	if req.Metadata != nil {
		var err error
		metadataBytes, err = json.Marshal(req.Metadata)
		if err != nil {
			middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid metadata")
			return
		}
	}

	query := `
		INSERT INTO metrics (user_id, metric_type, metric_value, metadata, created_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		RETURNING id, user_id, metric_type, metric_value, metadata, created_at
	`

	var metric models.Metric
	err := h.db.QueryRow(ctx, query, userID, req.MetricType, req.MetricValue, metadataBytes).Scan(
		&metric.ID, &metric.UserID, &metric.MetricType, &metric.MetricValue, &metric.Metadata, &metric.CreatedAt,
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to create metric")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to create metric")
		return
	}

	var metadata interface{}
	if len(metric.Metadata) > 0 {
		if err := json.Unmarshal(metric.Metadata, &metadata); err != nil {
			metadata = metric.Metadata
		}
	}

	response := models.MetricResponse{
		ID:          metric.ID,
		UserID:      metric.UserID,
		MetricType:  metric.MetricType,
		MetricValue: metric.MetricValue,
		Metadata:    metadata,
		CreatedAt:   metric.CreatedAt,
	}

	if h.redis != nil {
		go h.updateMetricCache(ctx, req.MetricType, userID)
	}

	middleware.WriteJSONResponse(w, http.StatusCreated, response)
}

func (h *MetricsHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil && r.URL.Query().Get("user_id") != "" {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "Authentication required to filter by user")
		return
	}

	var pagination models.PaginationQuery
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil {
			pagination.Page = page
		}
	}
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil {
			pagination.Limit = limit
		}
	}
	pagination.Normalize()

	metricType := r.URL.Query().Get("metric_type")
	userID := r.URL.Query().Get("user_id")

	if userID != "" && claims != nil && claims.UserID != userID && claims.Role != "admin" {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only access your own metrics")
		return
	}

	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if metricType != "" {
		whereClause += fmt.Sprintf(" AND metric_type = $%d", argIndex)
		args = append(args, metricType)
		argIndex++
	}

	if userID != "" {
		whereClause += fmt.Sprintf(" AND user_id = $%d", argIndex)
		args = append(args, userID)
		argIndex++
	} else if claims != nil && claims.Role != "admin" {
		whereClause += fmt.Sprintf(" AND user_id = $%d", argIndex)
		args = append(args, claims.UserID)
		argIndex++
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM metrics %s", whereClause)
	var total int64
	if err := h.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		log.Error().Err(err).Msg("Failed to count metrics")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve metrics")
		return
	}

	limitArgs := append(args, pagination.Limit, pagination.Offset())
	query := fmt.Sprintf(`
		SELECT id, user_id, metric_type, metric_value, metadata, created_at
		FROM metrics %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	rows, err := h.db.Query(ctx, query, limitArgs...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get metrics")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve metrics")
		return
	}
	defer rows.Close()

	var metrics []models.MetricResponse
	for rows.Next() {
		var metric models.Metric
		if err := rows.Scan(&metric.ID, &metric.UserID, &metric.MetricType, &metric.MetricValue, &metric.Metadata, &metric.CreatedAt); err != nil {
			log.Error().Err(err).Msg("Failed to scan metric")
			continue
		}

		var metadata interface{}
		if len(metric.Metadata) > 0 {
			if err := json.Unmarshal(metric.Metadata, &metadata); err != nil {
				metadata = metric.Metadata
			}
		}

		metrics = append(metrics, models.MetricResponse{
			ID:          metric.ID,
			UserID:      metric.UserID,
			MetricType:  metric.MetricType,
			MetricValue: metric.MetricValue,
			Metadata:    metadata,
			CreatedAt:   metric.CreatedAt,
		})
	}

	totalPages := int((total + int64(pagination.Limit) - 1) / int64(pagination.Limit))
	response := models.ListResponse{
		Data:       metrics,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		Total:      total,
		TotalPages: totalPages,
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
}

func (h *MetricsHandler) GetMetricsSummary(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil {
		middleware.WriteErrorResponse(w, http.StatusUnauthorized, fmt.Errorf("authentication required"), "Authentication required")
		return
	}

	cacheKey := fmt.Sprintf("metrics_summary:%s", claims.UserID)
	if h.redis != nil {
		var cached map[string]interface{}
		if err := h.redis.Get(ctx, cacheKey, &cached); err == nil {
			middleware.WriteJSONResponse(w, http.StatusOK, cached)
			return
		}
	}

	whereClause := "WHERE user_id = $1"
	if claims.Role == "admin" {
		whereClause = "WHERE 1=1"
	}

	var args []interface{}
	if claims.Role != "admin" {
		args = append(args, claims.UserID)
	}

	query := fmt.Sprintf(`
		SELECT 
			metric_type,
			COUNT(*) as count,
			AVG(COALESCE(metric_value, 0)) as avg_value,
			MIN(COALESCE(metric_value, 0)) as min_value,
			MAX(COALESCE(metric_value, 0)) as max_value,
			SUM(COALESCE(metric_value, 0)) as sum_value
		FROM metrics %s
		GROUP BY metric_type
		ORDER BY count DESC
	`, whereClause)

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get metrics summary")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve metrics summary")
		return
	}
	defer rows.Close()

	summary := make(map[string]interface{})
	for rows.Next() {
		var metricType string
		var count int64
		var avgValue, minValue, maxValue, sumValue float64

		if err := rows.Scan(&metricType, &count, &avgValue, &minValue, &maxValue, &sumValue); err != nil {
			log.Error().Err(err).Msg("Failed to scan metrics summary")
			continue
		}

		summary[metricType] = map[string]interface{}{
			"count":     count,
			"avg_value": avgValue,
			"min_value": minValue,
			"max_value": maxValue,
			"sum_value": sumValue,
		}
	}

	if h.redis != nil {
		if err := h.redis.Set(ctx, cacheKey, summary, 5*time.Minute); err != nil {
			log.Warn().Err(err).Str("cache_key", cacheKey).Msg("Failed to cache metrics summary")
		}
	}

	middleware.WriteJSONResponse(w, http.StatusOK, summary)
}

func (h *MetricsHandler) updateMetricCache(ctx context.Context, metricType string, userID *string) {
	if h.redis == nil {
		return
	}

	cacheKey := fmt.Sprintf("metric_count:%s", metricType)
	if userID != nil {
		cacheKey = fmt.Sprintf("metric_count:%s:%s", metricType, *userID)
	}

	if _, err := h.redis.Increment(ctx, cacheKey); err != nil {
		log.Warn().Err(err).Str("cache_key", cacheKey).Msg("Failed to increment metric cache")
	}

	if userID != nil {
		summaryKey := fmt.Sprintf("metrics_summary:%s", *userID)
		if err := h.redis.Delete(ctx, summaryKey); err != nil {
			log.Warn().Err(err).Str("cache_key", summaryKey).Msg("Failed to invalidate metrics summary cache")
		}
	}
} 