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
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type UserHandler struct {
	db    *database.PostgresDB
	redis *database.RedisClient
}

func NewUserHandler(db *database.PostgresDB, redis *database.RedisClient) *UserHandler {
	return &UserHandler{
		db:    db,
		redis: redis,
	}
}

func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	if req.UserID == "" || req.Email == "" {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "user_id and email are required")
		return
	}

	if req.Role == "" {
		req.Role = "user"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	query := `
		INSERT INTO users (user_id, email, role, created_at, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, user_id, email, role, created_at, updated_at
	`

	var user models.User
	err := h.db.QueryRow(ctx, query, req.UserID, req.Email, req.Role).Scan(
		&user.ID, &user.UserID, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to create user")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to create user")
		return
	}

	if h.redis != nil {
		cacheKey := fmt.Sprintf("user:%s", user.UserID)
		if err := h.redis.Set(ctx, cacheKey, user, time.Hour); err != nil {
			log.Warn().Err(err).Str("cache_key", cacheKey).Msg("Failed to cache user")
		}
	}

	response := models.UserResponse{
		ID:        user.ID,
		UserID:    user.UserID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}

	middleware.WriteJSONResponse(w, http.StatusCreated, response)
}

func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	if userID == "" {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing user_id"), "user_id is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var user models.User
	cacheKey := fmt.Sprintf("user:%s", userID)

	if h.redis != nil {
		if err := h.redis.Get(ctx, cacheKey, &user); err == nil {
			response := models.UserResponse{
				ID:        user.ID,
				UserID:    user.UserID,
				Email:     user.Email,
				Role:      user.Role,
				CreatedAt: user.CreatedAt,
				UpdatedAt: user.UpdatedAt,
			}
			middleware.WriteJSONResponse(w, http.StatusOK, response)
			return
		}
	}

	query := `SELECT id, user_id, email, role, created_at, updated_at FROM users WHERE user_id = $1`
	err := h.db.QueryRow(ctx, query, userID).Scan(
		&user.ID, &user.UserID, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get user")
		middleware.WriteErrorResponse(w, http.StatusNotFound, err, "User not found")
		return
	}

	if h.redis != nil {
		if err := h.redis.Set(ctx, cacheKey, user, time.Hour); err != nil {
			log.Warn().Err(err).Str("cache_key", cacheKey).Msg("Failed to cache user")
		}
	}

	response := models.UserResponse{
		ID:        user.ID,
		UserID:    user.UserID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
}

func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only update your own profile")
		return
	}

	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.Email != "" {
		setParts = append(setParts, fmt.Sprintf("email = $%d", argIndex))
		args = append(args, req.Email)
		argIndex++
	}

	if req.Role != "" && claims.Role == "admin" {
		setParts = append(setParts, fmt.Sprintf("role = $%d", argIndex))
		args = append(args, req.Role)
		argIndex++
	}

	if len(setParts) == 0 {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("no fields to update"), "No valid fields provided for update")
		return
	}

	setParts = append(setParts, fmt.Sprintf("updated_at = CURRENT_TIMESTAMP"))
	args = append(args, userID)

	query := fmt.Sprintf(`
		UPDATE users SET %s
		WHERE user_id = $%d
		RETURNING id, user_id, email, role, created_at, updated_at
	`, fmt.Sprintf("%s", setParts[0]), argIndex)

	for i := 1; i < len(setParts); i++ {
		query = fmt.Sprintf(`
			UPDATE users SET %s, %s
			WHERE user_id = $%d
			RETURNING id, user_id, email, role, created_at, updated_at
		`, setParts[0], setParts[i], argIndex)
	}

	var user models.User
	err := h.db.QueryRow(ctx, query, args...).Scan(
		&user.ID, &user.UserID, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to update user")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to update user")
		return
	}

	if h.redis != nil {
		cacheKey := fmt.Sprintf("user:%s", userID)
		if err := h.redis.Set(ctx, cacheKey, user, time.Hour); err != nil {
			log.Warn().Err(err).Str("cache_key", cacheKey).Msg("Failed to update cache")
		}
	}

	response := models.UserResponse{
		ID:        user.ID,
		UserID:    user.UserID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
}

func (h *UserHandler) CreateUserResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only create resources for yourself")
		return
	}

	var req models.CreateResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	if req.ResourceType == "" || req.ResourceData == nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, fmt.Errorf("missing required fields"), "resource_type and resource_data are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	resourceDataBytes, err := json.Marshal(req.ResourceData)
	if err != nil {
		middleware.WriteErrorResponse(w, http.StatusBadRequest, err, "Invalid resource data")
		return
	}

	query := `
		INSERT INTO user_resources (user_id, resource_type, resource_data, created_at, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, user_id, resource_type, resource_data, created_at, updated_at
	`

	var resource models.UserResource
	err = h.db.QueryRow(ctx, query, userID, req.ResourceType, resourceDataBytes).Scan(
		&resource.ID, &resource.UserID, &resource.ResourceType, &resource.ResourceData, &resource.CreatedAt, &resource.UpdatedAt,
	)

	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to create user resource")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to create resource")
		return
	}

	var resourceData interface{}
	if err := json.Unmarshal(resource.ResourceData, &resourceData); err != nil {
		log.Error().Err(err).Msg("Failed to unmarshal resource data")
		resourceData = resource.ResourceData
	}

	response := models.ResourceResponse{
		ID:           resource.ID,
		UserID:       resource.UserID,
		ResourceType: resource.ResourceType,
		ResourceData: resourceData,
		CreatedAt:    resource.CreatedAt,
		UpdatedAt:    resource.UpdatedAt,
	}

	middleware.WriteJSONResponse(w, http.StatusCreated, response)
}

func (h *UserHandler) GetUserResources(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || (claims.UserID != userID && claims.Role != "admin") {
		middleware.WriteErrorResponse(w, http.StatusForbidden, fmt.Errorf("access denied"), "You can only access your own resources")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

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

	countQuery := `SELECT COUNT(*) FROM user_resources WHERE user_id = $1`
	var total int64
	if err := h.db.QueryRow(ctx, countQuery, userID).Scan(&total); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to count user resources")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve resources")
		return
	}

	query := `
		SELECT id, user_id, resource_type, resource_data, created_at, updated_at
		FROM user_resources
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := h.db.Query(ctx, query, userID, pagination.Limit, pagination.Offset())
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get user resources")
		middleware.WriteErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve resources")
		return
	}
	defer rows.Close()

	var resources []models.ResourceResponse
	for rows.Next() {
		var resource models.UserResource
		if err := rows.Scan(&resource.ID, &resource.UserID, &resource.ResourceType, &resource.ResourceData, &resource.CreatedAt, &resource.UpdatedAt); err != nil {
			log.Error().Err(err).Msg("Failed to scan user resource")
			continue
		}

		var resourceData interface{}
		if err := json.Unmarshal(resource.ResourceData, &resourceData); err != nil {
			resourceData = resource.ResourceData
		}

		resources = append(resources, models.ResourceResponse{
			ID:           resource.ID,
			UserID:       resource.UserID,
			ResourceType: resource.ResourceType,
			ResourceData: resourceData,
			CreatedAt:    resource.CreatedAt,
			UpdatedAt:    resource.UpdatedAt,
		})
	}

	totalPages := int((total + int64(pagination.Limit) - 1) / int64(pagination.Limit))
	response := models.ListResponse{
		Data:       resources,
		Page:       pagination.Page,
		Limit:      pagination.Limit,
		Total:      total,
		TotalPages: totalPages,
	}

	middleware.WriteJSONResponse(w, http.StatusOK, response)
} 