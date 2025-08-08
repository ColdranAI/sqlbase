package models

import (
	"time"
)

type Organization struct {
	ID           string    `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Slug         string    `json:"slug" db:"slug"`
	Description  *string   `json:"description" db:"description"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
	MemberCount  int       `json:"member_count" db:"member_count"`
	ProjectCount int       `json:"project_count" db:"project_count"`
	Plan         string    `json:"plan" db:"plan"`
}

type OrganizationMember struct {
	ID             string     `json:"id" db:"id"`
	OrganizationID string     `json:"organization_id" db:"organization_id"`
	UserID         string     `json:"user_id" db:"user_id"`
	Email          string     `json:"email" db:"email"`
	Role           string     `json:"role" db:"role"`
	Status         string     `json:"status" db:"status"`
	JoinedAt       time.Time  `json:"joined_at" db:"joined_at"`
	InvitedAt      time.Time  `json:"invited_at" db:"invited_at"`
	InvitedBy      string     `json:"invited_by" db:"invited_by"`
}

type OrganizationInvitation struct {
	ID                  string     `json:"id" db:"id"`
	OrganizationID      string     `json:"organization_id" db:"organization_id"`
	Email               string     `json:"email" db:"email"`
	Role                string     `json:"role" db:"role"`
	Status              string     `json:"status" db:"status"`
	InvitedBy           string     `json:"invited_by" db:"invited_by"`
	InvitedAt           time.Time  `json:"invited_at" db:"invited_at"`
	ExpiresAt           time.Time  `json:"expires_at" db:"expires_at"`
	Token               string     `json:"token" db:"token"`
	ProjectAccessType   *string    `json:"project_access_type" db:"project_access_type"`
	SpecificProjects    *string    `json:"specific_projects" db:"specific_projects"` // JSON array of project IDs
	Message             *string    `json:"message" db:"message"`
}

type Project struct {
	ID                string     `json:"id" db:"id"`
	Name              string     `json:"name" db:"name"`
	Description       *string    `json:"description" db:"description"`
	OrganizationID    string     `json:"organization_id" db:"organization_id"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`
	LastActivity      *time.Time `json:"last_activity" db:"last_activity"`
	DatabaseConnected bool       `json:"database_connected" db:"database_connected"`
	DatabaseType      *string    `json:"database_type" db:"database_type"`
	IsPublic          bool       `json:"is_public" db:"is_public"`
}

type OrganizationUsage struct {
	OrganizationID              string    `json:"organization_id"`
	Plan                        string    `json:"plan"`
	BillingCycleEnd            time.Time `json:"billing_cycle_end"`
	AIQueriesUsed              int       `json:"ai_queries_used"`
	AIQueriesLimit             int       `json:"ai_queries_limit"`
	ProjectsCount              int       `json:"projects_count"`
	ProjectsLimit              int       `json:"projects_limit"`
	MembersCount               int       `json:"members_count"`
	MembersLimit               int       `json:"members_limit"`
	DatabaseConnections        int       `json:"database_connections"`
	DatabaseConnectionsLimit   int       `json:"database_connections_limit"`
	QueryHistoryLimitDays      int       `json:"query_history_limit_days"`
}

// Request/Response types
type CreateOrganizationRequest struct {
	Name        string  `json:"name" validate:"required,min=2,max=100"`
	Slug        string  `json:"slug" validate:"required,min=2,max=50"`
	Description *string `json:"description,omitempty"`
}

type UpdateOrganizationRequest struct {
	Name        *string `json:"name,omitempty" validate:"omitempty,min=2,max=100"`
	Description *string `json:"description,omitempty"`
}

type InviteToOrganizationRequest struct {
	Email               string   `json:"email" validate:"required,email"`
	Role                string   `json:"role" validate:"required,oneof=admin member"`
	Message             *string  `json:"message,omitempty"`
	ProjectAccessType   *string  `json:"project_access_type,omitempty" validate:"omitempty,oneof=all specific"`
	SpecificProjects    []string `json:"specific_projects,omitempty"`
}

type CreateProjectRequest struct {
	Name        string  `json:"name" validate:"required,min=2,max=100"`
	Description *string `json:"description,omitempty"`
	IsPublic    *bool   `json:"is_public,omitempty"`
}

type UpdateProjectRequest struct {
	Name        *string `json:"name,omitempty" validate:"omitempty,min=2,max=100"`
	Description *string `json:"description,omitempty"`
	IsPublic    *bool   `json:"is_public,omitempty"`
}

type AcceptInvitationRequest struct {
	Token string `json:"token" validate:"required"`
}

// Response types with nested data
type OrganizationWithMembers struct {
	*Organization
	Members []OrganizationMember `json:"members,omitempty"`
}

type OrganizationMemberWithUser struct {
	*OrganizationMember
	User *UserResponse `json:"user,omitempty"`
}

type OrganizationInvitationWithDetails struct {
	*OrganizationInvitation
	Inviter      *InviterDetails `json:"inviter,omitempty"`
	Organization *Organization `json:"organization,omitempty"`
	Projects     []Project     `json:"projects,omitempty"`
}

type ProjectWithOrganization struct {
	*Project
	Organization *Organization `json:"organization,omitempty"`
}

type InviterDetails struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}