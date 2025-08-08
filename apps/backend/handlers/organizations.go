package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"go-backend/database"
	"go-backend/models"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type OrganizationHandler struct {
	db *database.PostgresDB
}

func NewOrganizationHandler(db *database.PostgresDB) *OrganizationHandler {
	return &OrganizationHandler{db: db}
}

// GET /api/v1/users/{userId}/organizations
func (h *OrganizationHandler) GetUserOrganizations(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]

	if userID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	query := `
		SELECT DISTINCT o.id, o.name, o.slug, o.description, o.created_at, o.updated_at, o.plan,
			(SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id AND om.status = 'active') as member_count,
			(SELECT COUNT(*) FROM projects p WHERE p.organization_id = o.id) as project_count
		FROM organizations o
		INNER JOIN organization_members om ON o.id = om.organization_id
		WHERE om.user_id = $1 AND om.status = 'active'
		ORDER BY o.created_at DESC
	`

	ctx := context.Background()
	rows, err := h.db.Query(ctx, query, userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query user organizations")
		http.Error(w, "Failed to fetch organizations", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var organizations []models.Organization
	for rows.Next() {
		var org models.Organization
		err := rows.Scan(
			&org.ID, &org.Name, &org.Slug, &org.Description,
			&org.CreatedAt, &org.UpdatedAt, &org.Plan,
			&org.MemberCount, &org.ProjectCount,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan organization")
			continue
		}
		organizations = append(organizations, org)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": organizations,
	})
}

// POST /api/v1/users/{userId}/organizations
func (h *OrganizationHandler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]

	if userID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var req models.CreateOrganizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate unique IDs
	orgID := uuid.New().String()
	memberID := uuid.New().String()

	ctx := context.Background()
	tx, err := h.db.GetPool().Begin(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to begin transaction")
		http.Error(w, "Failed to create organization", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Create organization
	now := time.Now()
	_, err = tx.Exec(ctx, `
		INSERT INTO organizations (id, name, slug, description, created_at, updated_at, plan)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, orgID, req.Name, req.Slug, req.Description, now, now, "free")

	if err != nil {
		log.Error().Err(err).Msg("Failed to create organization")
		http.Error(w, "Failed to create organization", http.StatusInternalServerError)
		return
	}

	// Add user as owner
	_, err = tx.Exec(ctx, `
		INSERT INTO organization_members (id, organization_id, user_id, email, role, status, joined_at, invited_at, invited_by)
		VALUES ($1, $2, $3, (SELECT email FROM users WHERE user_id = $3), $4, $5, $6, $7, $8)
	`, memberID, orgID, userID, "owner", "active", now, now, userID)

	if err != nil {
		log.Error().Err(err).Msg("Failed to add user as organization owner")
		http.Error(w, "Failed to create organization", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to commit transaction")
		http.Error(w, "Failed to create organization", http.StatusInternalServerError)
		return
	}

	// Return the created organization
	org := models.Organization{
		ID:           orgID,
		Name:         req.Name,
		Slug:         req.Slug,
		Description:  req.Description,
		CreatedAt:    now,
		UpdatedAt:    now,
		MemberCount:  1,
		ProjectCount: 0,
		Plan:         "free",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": org,
	})
}

// GET /api/v1/users/{userId}/organizations/{orgId}
func (h *OrganizationHandler) GetOrganization(w http.ResponseWriter, r *http.Request) {
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
		SELECT o.id, o.name, o.slug, o.description, o.created_at, o.updated_at, o.plan,
			(SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id AND om.status = 'active') as member_count,
			(SELECT COUNT(*) FROM projects p WHERE p.organization_id = o.id) as project_count
		FROM organizations o
		WHERE o.id = $1
	`

	var org models.Organization
	err = h.db.QueryRow(ctx, query, orgID).Scan(
		&org.ID, &org.Name, &org.Slug, &org.Description,
		&org.CreatedAt, &org.UpdatedAt, &org.Plan,
		&org.MemberCount, &org.ProjectCount,
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch organization")
		http.Error(w, "Organization not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": org,
	})
}

// GET /api/v1/users/{userId}/organizations/{orgId}/usage
func (h *OrganizationHandler) GetOrganizationUsage(w http.ResponseWriter, r *http.Request) {
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

	// Get organization plan
	var plan string
	err = h.db.QueryRow(ctx, "SELECT plan FROM organizations WHERE id = $1", orgID).Scan(&plan)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get organization plan")
		http.Error(w, "Failed to fetch usage data", http.StatusInternalServerError)
		return
	}

	// Define limits based on plan
	limits := map[string]map[string]int{
		"free": {
			"ai_queries": 40,
			"projects": 2,
			"members": 3,
			"db_connections": 2,
			"query_history_days": 7,
		},
		"pro": {
			"ai_queries": 1000,
			"projects": 25,
			"members": 25,
			"db_connections": 25,
			"query_history_days": 90,
		},
		"enterprise": {
			"ai_queries": 10000,
			"projects": 100,
			"members": 100,
			"db_connections": 100,
			"query_history_days": 365,
		},
	}

	planLimits := limits[plan]
	if planLimits == nil {
		planLimits = limits["free"] // default to free
		plan = "free"
	}

	// Get actual usage counts
	var aiQueriesUsed, projectsCount, membersCount, dbConnections int

	// AI queries used (from metrics table)
	h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM metrics 
		WHERE user_id IN (
			SELECT user_id FROM organization_members 
			WHERE organization_id = $1 AND status = 'active'
		) AND metric_type = 'ai_query_executed'
		AND created_at >= date_trunc('month', CURRENT_DATE)
	`, orgID).Scan(&aiQueriesUsed)

	// Projects count
	h.db.QueryRow(ctx, "SELECT COUNT(*) FROM projects WHERE organization_id = $1", orgID).Scan(&projectsCount)

	// Members count
	h.db.QueryRow(ctx, "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND status = 'active'", orgID).Scan(&membersCount)

	// Database connections count
	h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM user_resources ur
		INNER JOIN organization_members om ON ur.user_id = om.user_id
		WHERE om.organization_id = $1 AND om.status = 'active' 
		AND ur.resource_type = 'database_config'
	`, orgID).Scan(&dbConnections)

	usage := models.OrganizationUsage{
		OrganizationID:              orgID,
		Plan:                        plan,
		BillingCycleEnd:            time.Now().AddDate(0, 1, 0), // Next month
		AIQueriesUsed:              aiQueriesUsed,
		AIQueriesLimit:             planLimits["ai_queries"],
		ProjectsCount:              projectsCount,
		ProjectsLimit:              planLimits["projects"],
		MembersCount:               membersCount,
		MembersLimit:               planLimits["members"],
		DatabaseConnections:        dbConnections,
		DatabaseConnectionsLimit:   planLimits["db_connections"],
		QueryHistoryLimitDays:      planLimits["query_history_days"],
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": usage,
	})
}

// POST /api/v1/users/{userId}/organizations/{orgId}/invitations
func (h *OrganizationHandler) InviteToOrganization(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]

	if userID == "" || orgID == "" {
		http.Error(w, "User ID and Organization ID are required", http.StatusBadRequest)
		return
	}

	var req models.InviteToOrganizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Check if user is admin/owner of organization
	var role string
	err := h.db.QueryRow(ctx, `
		SELECT role FROM organization_members 
		WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
	`, orgID, userID).Scan(&role)

	if err != nil || (role != "owner" && role != "admin") {
		http.Error(w, "Insufficient permissions", http.StatusForbidden)
		return
	}

	// Check if user is already a member or has pending invitation
	var existingCount int
	h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM (
			SELECT 1 FROM organization_members WHERE organization_id = $1 AND email = $2
			UNION
			SELECT 1 FROM organization_invitations WHERE organization_id = $1 AND email = $2 AND status = 'pending'
		) as existing
	`, orgID, req.Email).Scan(&existingCount)

	if existingCount > 0 {
		http.Error(w, "User is already a member or has a pending invitation", http.StatusConflict)
		return
	}

	// Create invitation
	invitationID := uuid.New().String()
	token := uuid.New().String()
	now := time.Now()
	expiresAt := now.AddDate(0, 0, 7) // 7 days

	var specificProjectsJSON *string
	if req.ProjectAccessType != nil && *req.ProjectAccessType == "specific" && len(req.SpecificProjects) > 0 {
		projectsBytes, _ := json.Marshal(req.SpecificProjects)
		projectsStr := string(projectsBytes)
		specificProjectsJSON = &projectsStr
	}

	err = h.db.Exec(ctx, `
		INSERT INTO organization_invitations 
		(id, organization_id, email, role, status, invited_by, invited_at, expires_at, token, project_access_type, specific_projects, message)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, invitationID, orgID, req.Email, req.Role, "pending", userID, now, expiresAt, token, req.ProjectAccessType, specificProjectsJSON, req.Message)

	if err != nil {
		log.Error().Err(err).Msg("Failed to create invitation")
		http.Error(w, "Failed to create invitation", http.StatusInternalServerError)
		return
	}

	invitation := models.OrganizationInvitation{
		ID:                invitationID,
		OrganizationID:    orgID,
		Email:             req.Email,
		Role:              req.Role,
		Status:            "pending",
		InvitedBy:         userID,
		InvitedAt:         now,
		ExpiresAt:         expiresAt,
		Token:             token,
		ProjectAccessType: req.ProjectAccessType,
		SpecificProjects:  specificProjectsJSON,
		Message:           req.Message,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": invitation,
	})
}

// POST /api/v1/users/{userId}/organizations/{orgId}/projects/{projectId}/invitations
func (h *OrganizationHandler) InviteToProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]
	projectID := vars["projectId"]

	if userID == "" || orgID == "" || projectID == "" {
		http.Error(w, "User ID, Organization ID, and Project ID are required", http.StatusBadRequest)
		return
	}

	var req models.InviteToOrganizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Check if user has access to the project
	var accessCount int
	err := h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM organization_members om
		INNER JOIN projects p ON p.organization_id = om.organization_id
		WHERE om.user_id = $1 AND om.status = 'active' AND p.id = $2
		AND (om.role IN ('owner', 'admin') OR p.organization_id = om.organization_id)
	`, userID, projectID).Scan(&accessCount)

	if err != nil || accessCount == 0 {
		http.Error(w, "Insufficient permissions", http.StatusForbidden)
		return
	}

	// Set project-specific invitation data
	req.ProjectAccessType = stringPtr("specific")
	req.SpecificProjects = []string{projectID}

	// Reuse the organization invitation logic
	h.InviteToOrganization(w, r)
}

func stringPtr(s string) *string {
	return &s
}
