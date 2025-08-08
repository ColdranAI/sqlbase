package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go-backend/database"
	"go-backend/models"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type ProjectHandler struct {
	db *database.PostgresDB
}

func NewProjectHandler(db *database.PostgresDB) *ProjectHandler {
	return &ProjectHandler{db: db}
}

// GET /api/v1/users/{userId}/organizations/{orgId}/projects
func (h *ProjectHandler) GetOrganizationProjects(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]

	if userID == "" || orgID == "" {
		http.Error(w, "User ID and Organization ID are required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Check if user is member of organization
	var memberCount int
	err := h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM organization_members 
		WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
	`, orgID, userID).Scan(&memberCount)

	if err != nil || memberCount == 0 {
		http.Error(w, "Organization not found or access denied", http.StatusNotFound)
		return
	}

	query := `
		SELECT p.id, p.name, p.description, p.organization_id, p.created_at, p.updated_at, 
			p.last_activity, p.database_connected, p.database_type, p.is_public
		FROM projects p
		WHERE p.organization_id = $1
		ORDER BY p.created_at DESC
	`

	rows, err := h.db.Query(ctx, query, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query organization projects")
		http.Error(w, "Failed to fetch projects", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var project models.Project
		err := rows.Scan(
			&project.ID, &project.Name, &project.Description, &project.OrganizationID,
			&project.CreatedAt, &project.UpdatedAt, &project.LastActivity,
			&project.DatabaseConnected, &project.DatabaseType, &project.IsPublic,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan project")
			continue
		}
		projects = append(projects, project)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": projects,
	})
}

// POST /api/v1/users/{userId}/organizations/{orgId}/projects
func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]

	if userID == "" || orgID == "" {
		http.Error(w, "User ID and Organization ID are required", http.StatusBadRequest)
		return
	}

	var req models.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Check if user is member of organization
	var memberCount int
	err := h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM organization_members 
		WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
	`, orgID, userID).Scan(&memberCount)

	if err != nil || memberCount == 0 {
		http.Error(w, "Organization not found or access denied", http.StatusForbidden)
		return
	}

	// Check organization project limit
	var projectCount, projectLimit int
	h.db.QueryRow(ctx, "SELECT COUNT(*) FROM projects WHERE organization_id = $1", orgID).Scan(&projectCount)
	
	var plan string
	h.db.QueryRow(ctx, "SELECT plan FROM organizations WHERE id = $1", orgID).Scan(&plan)
	
	switch plan {
	case "pro":
		projectLimit = 25
	case "enterprise":
		projectLimit = 100
	default:
		projectLimit = 2
	}

	if projectCount >= projectLimit {
		http.Error(w, "Project limit reached for your plan", http.StatusForbidden)
		return
	}

	// Create project
	projectID := uuid.New().String()
	now := time.Now()
	isPublic := false
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}

	err = h.db.Exec(ctx, `
		INSERT INTO projects (id, name, description, organization_id, created_at, updated_at, 
			database_connected, is_public)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, projectID, req.Name, req.Description, orgID, now, now, false, isPublic)

	if err != nil {
		log.Error().Err(err).Msg("Failed to create project")
		http.Error(w, "Failed to create project", http.StatusInternalServerError)
		return
	}

	project := models.Project{
		ID:                projectID,
		Name:              req.Name,
		Description:       req.Description,
		OrganizationID:    orgID,
		CreatedAt:         now,
		UpdatedAt:         now,
		DatabaseConnected: false,
		IsPublic:          isPublic,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": project,
	})
}

// GET /api/v1/users/{userId}/organizations/{orgId}/projects/{projectId}
func (h *ProjectHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]
	projectID := vars["projectId"]

	if userID == "" || orgID == "" || projectID == "" {
		http.Error(w, "User ID, Organization ID, and Project ID are required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Check if user has access to the project
	var accessCount int
	err := h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM organization_members om
		INNER JOIN projects p ON p.organization_id = om.organization_id
		WHERE om.user_id = $1 AND om.status = 'active' AND p.id = $2
	`, userID, projectID).Scan(&accessCount)

	if err != nil || accessCount == 0 {
		http.Error(w, "Project not found or access denied", http.StatusNotFound)
		return
	}

	query := `
		SELECT p.id, p.name, p.description, p.organization_id, p.created_at, p.updated_at, 
			p.last_activity, p.database_connected, p.database_type, p.is_public
		FROM projects p
		WHERE p.id = $1 AND p.organization_id = $2
	`

	var project models.Project
	err = h.db.QueryRow(ctx, query, projectID, orgID).Scan(
		&project.ID, &project.Name, &project.Description, &project.OrganizationID,
		&project.CreatedAt, &project.UpdatedAt, &project.LastActivity,
		&project.DatabaseConnected, &project.DatabaseType, &project.IsPublic,
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch project")
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": project,
	})
}

// PUT /api/v1/users/{userId}/organizations/{orgId}/projects/{projectId}
func (h *ProjectHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]
	projectID := vars["projectId"]

	if userID == "" || orgID == "" || projectID == "" {
		http.Error(w, "User ID, Organization ID, and Project ID are required", http.StatusBadRequest)
		return
	}

	var req models.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Check if user has access to the project
	var role string
	err := h.db.QueryRow(ctx, `
		SELECT om.role FROM organization_members om
		INNER JOIN projects p ON p.organization_id = om.organization_id
		WHERE om.user_id = $1 AND om.status = 'active' AND p.id = $2
	`, userID, projectID).Scan(&role)

	if err != nil || (role != "owner" && role != "admin") {
		http.Error(w, "Insufficient permissions", http.StatusForbidden)
		return
	}

	// Build dynamic update query
	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.Name != nil {
		setParts = append(setParts, fmt.Sprintf("name = $%d", argIndex))
		args = append(args, *req.Name)
		argIndex++
	}

	if req.Description != nil {
		setParts = append(setParts, fmt.Sprintf("description = $%d", argIndex))
		args = append(args, *req.Description)
		argIndex++
	}

	if req.IsPublic != nil {
		setParts = append(setParts, fmt.Sprintf("is_public = $%d", argIndex))
		args = append(args, *req.IsPublic)
		argIndex++
	}

	if len(setParts) == 0 {
		http.Error(w, "No fields to update", http.StatusBadRequest)
		return
	}

	// Add updated_at
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE clause parameters
	args = append(args, projectID, orgID)

	query := fmt.Sprintf(`
		UPDATE projects SET %s
		WHERE id = $%d AND organization_id = $%d
	`, joinStrings(setParts, ", "), argIndex, argIndex+1)

	err = h.db.Exec(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update project")
		http.Error(w, "Failed to update project", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Project updated successfully",
	})
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	if len(strs) == 1 {
		return strs[0]
	}
	
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
