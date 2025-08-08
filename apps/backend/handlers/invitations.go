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

type InvitationHandler struct {
	db *database.PostgresDB
}

func NewInvitationHandler(db *database.PostgresDB) *InvitationHandler {
	return &InvitationHandler{db: db}
}

// GET /api/v1/users/{userId}/organizations/{orgId}/invitations
func (h *InvitationHandler) GetOrganizationInvitations(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]

	if userID == "" || orgID == "" {
		http.Error(w, "User ID and Organization ID are required", http.StatusBadRequest)
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

	query := `
		SELECT oi.id, oi.organization_id, oi.email, oi.role, oi.status, oi.invited_by, 
			oi.invited_at, oi.expires_at, oi.token, oi.project_access_type, 
			oi.specific_projects, oi.message,
			u.email as inviter_email, u.user_id as inviter_user_id,
			o.name as org_name, o.slug as org_slug
		FROM organization_invitations oi
		LEFT JOIN users u ON oi.invited_by = u.user_id
		LEFT JOIN organizations o ON oi.organization_id = o.id
		WHERE oi.organization_id = $1
		ORDER BY oi.invited_at DESC
	`

	rows, err := h.db.Query(ctx, query, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query organization invitations")
		http.Error(w, "Failed to fetch invitations", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var invitations []models.OrganizationInvitationWithDetails
	for rows.Next() {
		var inv models.OrganizationInvitationWithDetails
		var inviterEmail, inviterUserID, orgName, orgSlug *string
		
		inv.OrganizationInvitation = &models.OrganizationInvitation{}
		
		err := rows.Scan(
			&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Role, &inv.Status,
			&inv.InvitedBy, &inv.InvitedAt, &inv.ExpiresAt, &inv.Token,
			&inv.ProjectAccessType, &inv.SpecificProjects, &inv.Message,
			&inviterEmail, &inviterUserID, &orgName, &orgSlug,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan invitation")
			continue
		}

		// Add inviter details
		if inviterEmail != nil && inviterUserID != nil {
			inv.Inviter = &models.InviterDetails{
				UserID: *inviterUserID,
				Email:  *inviterEmail,
			}
		}

		// Add organization details
		if orgName != nil && orgSlug != nil {
			inv.Organization = &models.Organization{
				ID:   inv.OrganizationID,
				Name: *orgName,
				Slug: *orgSlug,
			}
		}

		invitations = append(invitations, inv)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": invitations,
	})
}

// POST /api/v1/invitations/{token}/accept
func (h *InvitationHandler) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	token := vars["token"]

	if token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	var req models.AcceptInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Find the invitation
	var inv models.OrganizationInvitation
	err := h.db.QueryRow(ctx, `
		SELECT id, organization_id, email, role, status, invited_by, invited_at, 
			expires_at, token, project_access_type, specific_projects, message
		FROM organization_invitations
		WHERE token = $1 AND status = 'pending'
	`, token).Scan(
		&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Role, &inv.Status,
		&inv.InvitedBy, &inv.InvitedAt, &inv.ExpiresAt, &inv.Token,
		&inv.ProjectAccessType, &inv.SpecificProjects, &inv.Message,
	)

	if err != nil {
		http.Error(w, "Invalid or expired invitation", http.StatusNotFound)
		return
	}

	// Check if invitation is expired
	if time.Now().After(inv.ExpiresAt) {
		http.Error(w, "Invitation has expired", http.StatusGone)
		return
	}

	// Get user ID from the request context (set by auth middleware)
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Check if user is already a member
	var memberCount int
	h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM organization_members 
		WHERE organization_id = $1 AND user_id = $2
	`, inv.OrganizationID, userID).Scan(&memberCount)

	if memberCount > 0 {
		http.Error(w, "User is already a member of this organization", http.StatusConflict)
		return
	}

	// Begin transaction
	tx, err := h.db.GetPool().Begin(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to begin transaction")
		http.Error(w, "Failed to accept invitation", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Add user to organization
	memberID := uuid.New().String()
	now := time.Now()
	_, err = tx.Exec(ctx, `
		INSERT INTO organization_members 
		(id, organization_id, user_id, email, role, status, joined_at, invited_at, invited_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, memberID, inv.OrganizationID, userID, inv.Email, inv.Role, "active", 
		now, inv.InvitedAt, inv.InvitedBy)

	if err != nil {
		log.Error().Err(err).Msg("Failed to add user to organization")
		http.Error(w, "Failed to accept invitation", http.StatusInternalServerError)
		return
	}

	// Update invitation status
	_, err = tx.Exec(ctx, `
		UPDATE organization_invitations 
		SET status = 'accepted' 
		WHERE id = $1
	`, inv.ID)

	if err != nil {
		log.Error().Err(err).Msg("Failed to update invitation status")
		http.Error(w, "Failed to accept invitation", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to commit transaction")
		http.Error(w, "Failed to accept invitation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Invitation accepted successfully",
		"organization_id": inv.OrganizationID,
	})
}

// GET /api/v1/invitations/{token}
func (h *InvitationHandler) GetInvitationDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	token := vars["token"]

	if token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	query := `
		SELECT oi.id, oi.organization_id, oi.email, oi.role, oi.status, oi.invited_by, 
			oi.invited_at, oi.expires_at, oi.token, oi.project_access_type, 
			oi.specific_projects, oi.message,
			u.email as inviter_email, u.user_id as inviter_user_id,
			o.name as org_name, o.slug as org_slug
		FROM organization_invitations oi
		LEFT JOIN users u ON oi.invited_by = u.user_id
		LEFT JOIN organizations o ON oi.organization_id = o.id
		WHERE oi.token = $1
	`

	var inv models.OrganizationInvitationWithDetails
	var inviterEmail, inviterUserID, orgName, orgSlug *string
	
	inv.OrganizationInvitation = &models.OrganizationInvitation{}
	
	err := h.db.QueryRow(ctx, query, token).Scan(
		&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Role, &inv.Status,
		&inv.InvitedBy, &inv.InvitedAt, &inv.ExpiresAt, &inv.Token,
		&inv.ProjectAccessType, &inv.SpecificProjects, &inv.Message,
		&inviterEmail, &inviterUserID, &orgName, &orgSlug,
	)

	if err != nil {
		http.Error(w, "Invitation not found", http.StatusNotFound)
		return
	}

	// Add inviter details
	if inviterEmail != nil && inviterUserID != nil {
		inv.Inviter = &models.InviterDetails{
			UserID: *inviterUserID,
			Email:  *inviterEmail,
		}
	}

	// Add organization details
	if orgName != nil && orgSlug != nil {
		inv.Organization = &models.Organization{
			ID:   inv.OrganizationID,
			Name: *orgName,
			Slug: *orgSlug,
		}
	}

	// If specific projects are mentioned, get project details
	if inv.SpecificProjects != nil {
		var projectIDs []string
		if err := json.Unmarshal([]byte(*inv.SpecificProjects), &projectIDs); err == nil {
			// Query projects
			projectQuery := `
				SELECT id, name FROM projects 
				WHERE id = ANY($1) AND organization_id = $2
			`
			rows, err := h.db.Query(ctx, projectQuery, projectIDs, inv.OrganizationID)
			if err == nil {
				defer rows.Close()
				var projects []models.Project
				for rows.Next() {
					var project models.Project
					rows.Scan(&project.ID, &project.Name)
					projects = append(projects, project)
				}
				inv.Projects = projects
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": inv,
	})
}

// DELETE /api/v1/users/{userId}/organizations/{orgId}/invitations/{invitationId}
func (h *InvitationHandler) CancelInvitation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]
	invitationID := vars["invitationId"]

	if userID == "" || orgID == "" || invitationID == "" {
		http.Error(w, "User ID, Organization ID, and Invitation ID are required", http.StatusBadRequest)
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

	// Cancel the invitation
	err = h.db.Exec(ctx, `
		UPDATE organization_invitations 
		SET status = 'cancelled' 
		WHERE id = $1 AND organization_id = $2 AND status = 'pending'
	`, invitationID, orgID)

	if err != nil {
		log.Error().Err(err).Msg("Failed to cancel invitation")
		http.Error(w, "Failed to cancel invitation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Invitation cancelled successfully",
	})
}

// POST /api/v1/users/{userId}/organizations/{orgId}/invitations/{invitationId}/resend
func (h *InvitationHandler) ResendInvitation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	orgID := vars["orgId"]
	invitationID := vars["invitationId"]

	if userID == "" || orgID == "" || invitationID == "" {
		http.Error(w, "User ID, Organization ID, and Invitation ID are required", http.StatusBadRequest)
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

	// Update invitation timestamp and extend expiry
	now := time.Now()
	expiresAt := now.AddDate(0, 0, 7) // 7 days from now
	
	err = h.db.Exec(ctx, `
		UPDATE organization_invitations 
		SET invited_at = $1, expires_at = $2
		WHERE id = $3 AND organization_id = $4 AND status = 'pending'
	`, now, expiresAt, invitationID, orgID)

	if err != nil {
		log.Error().Err(err).Msg("Failed to resend invitation")
		http.Error(w, "Failed to resend invitation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Invitation resent successfully",
	})
}
