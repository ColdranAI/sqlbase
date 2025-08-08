package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID        int       `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Email     string    `json:"email" db:"email"`
	Role      string    `json:"role" db:"role"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type UserResource struct {
	ID           int             `json:"id" db:"id"`
	UserID       string          `json:"user_id" db:"user_id"`
	ResourceType string          `json:"resource_type" db:"resource_type"`
	ResourceData json.RawMessage `json:"resource_data" db:"resource_data"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at" db:"updated_at"`
}

type Metric struct {
	ID          int             `json:"id" db:"id"`
	UserID      *string         `json:"user_id" db:"user_id"`
	MetricType  string          `json:"metric_type" db:"metric_type"`
	MetricValue *float64        `json:"metric_value" db:"metric_value"`
	Metadata    json.RawMessage `json:"metadata" db:"metadata"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
}

type CreateUserRequest struct {
	UserID string `json:"user_id" validate:"required"`
	Email  string `json:"email" validate:"required,email"`
	Role   string `json:"role,omitempty"`
}

type UpdateUserRequest struct {
	Email string `json:"email,omitempty" validate:"omitempty,email"`
	Role  string `json:"role,omitempty"`
}

type CreateResourceRequest struct {
	ResourceType string      `json:"resource_type" validate:"required"`
	ResourceData interface{} `json:"resource_data" validate:"required"`
}

type UpdateResourceRequest struct {
	ResourceType string      `json:"resource_type,omitempty"`
	ResourceData interface{} `json:"resource_data,omitempty"`
}

type CreateMetricRequest struct {
	MetricType  string      `json:"metric_type" validate:"required"`
	MetricValue *float64    `json:"metric_value,omitempty"`
	Metadata    interface{} `json:"metadata,omitempty"`
}

type UserResponse struct {
	ID        int       `json:"id"`
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ResourceResponse struct {
	ID           int         `json:"id"`
	UserID       string      `json:"user_id"`
	ResourceType string      `json:"resource_type"`
	ResourceData interface{} `json:"resource_data"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

type MetricResponse struct {
	ID          int         `json:"id"`
	UserID      *string     `json:"user_id"`
	MetricType  string      `json:"metric_type"`
	MetricValue *float64    `json:"metric_value"`
	Metadata    interface{} `json:"metadata"`
	CreatedAt   time.Time   `json:"created_at"`
}

type ListResponse struct {
	Data       interface{} `json:"data"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	Total      int64       `json:"total"`
	TotalPages int         `json:"total_pages"`
}

type PaginationQuery struct {
	Page  int `json:"page" form:"page"`
	Limit int `json:"limit" form:"limit"`
}

func (p *PaginationQuery) Normalize() {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Limit < 1 {
		p.Limit = 10
	}
	if p.Limit > 100 {
		p.Limit = 100
	}
}

func (p *PaginationQuery) Offset() int {
	return (p.Page - 1) * p.Limit
} 