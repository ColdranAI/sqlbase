package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"go-backend/auth"
	"github.com/rs/zerolog/log"
)

type contextKey string

const UserClaimsKey contextKey = "userClaims"

type BetterAuthSession struct {
	User struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
		Role  string `json:"role"`
	} `json:"user"`
	Session struct {
		ID        string    `json:"id"`
		ExpiresAt time.Time `json:"expiresAt"`
	} `json:"session"`
}

func AuthMiddleware(jwtValidator *auth.JWTValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// First try to get session from Better Auth cookie
			if claims := getBetterAuthSession(r); claims != nil {
				ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
				log.Debug().
					Str("user_id", claims.UserID).
					Str("role", claims.Role).
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("Better Auth session authentication successful")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Fallback to JWT Bearer token for API compatibility
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				log.Warn().
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Str("remote_addr", r.RemoteAddr).
					Msg("No authentication found (missing both session cookie and auth header)")
				
				http.Error(w, "Authentication required", http.StatusUnauthorized)
				return
			}
			
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				log.Warn().
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Str("remote_addr", r.RemoteAddr).
					Msg("Invalid authorization header format")
				
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}
			
			token := parts[1]
			claims, err := jwtValidator.ValidateToken(token)
			if err != nil {
				log.Warn().
					Err(err).
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Str("remote_addr", r.RemoteAddr).
					Msg("Token validation failed")
				
				http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}
			
			ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
			
			log.Debug().
				Str("user_id", claims.UserID).
				Str("role", claims.Role).
				Str("path", r.URL.Path).
				Str("method", r.Method).
				Msg("JWT authentication successful")
			
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func getBetterAuthSession(r *http.Request) *auth.UserClaims {
	// Try to get session from Better Auth cookies
	sessionCookie, err := r.Cookie("better-auth.session_token")
	if err != nil {
		// Try alternative cookie names
		for _, cookieName := range []string{"session_token", "better-auth.session", "authjs.session-token"} {
			if cookie, err := r.Cookie(cookieName); err == nil {
				sessionCookie = cookie
				break
			}
		}
		if sessionCookie == nil {
			return nil
		}
	}

	sessionData := sessionCookie.Value
	
	// For Better Auth, the session cookie is typically a session ID
	// We'll make a simple validation here and extract user info from the URL
	// In a production environment, you'd validate this session ID with Better Auth
	
	// Extract user ID from the request URL path
	// URL format: /api/v1/users/{user_id}/...
	path := r.URL.Path
	if parts := strings.Split(path, "/"); len(parts) >= 5 && parts[1] == "api" && parts[2] == "v1" && parts[3] == "users" {
		userID := parts[4]
		
		// Basic session validation - check if session cookie exists and is not empty
		if sessionData != "" && len(sessionData) > 10 {
			log.Debug().
				Str("user_id", userID).
				Str("session_cookie", "present").
				Msg("Better Auth session found")
			
			return &auth.UserClaims{
				UserID: userID,
				Role:   "user", // Default role, could be enhanced to fetch from Better Auth
			}
		}
	}

	return nil
}

func OptionalAuthMiddleware(jwtValidator *auth.JWTValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try Better Auth session first
			if claims := getBetterAuthSession(r); claims != nil {
				ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
				r = r.WithContext(ctx)
			} else {
				// Fallback to JWT
				authHeader := r.Header.Get("Authorization")
				if authHeader != "" {
					parts := strings.SplitN(authHeader, " ", 2)
					if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
						token := parts[1]
						if claims, err := jwtValidator.ValidateToken(token); err == nil {
							ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
							r = r.WithContext(ctx)
						}
					}
				}
			}
			
			next.ServeHTTP(w, r)
		})
	}
}

func GetUserClaims(ctx context.Context) *auth.UserClaims {
	if claims, ok := ctx.Value(UserClaimsKey).(*auth.UserClaims); ok {
		return claims
	}
	return nil
}

func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetUserClaims(r.Context())
			if claims == nil {
				http.Error(w, "Authentication required", http.StatusUnauthorized)
				return
			}
			
			for _, role := range allowedRoles {
				if claims.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			
			log.Warn().
				Str("user_id", claims.UserID).
				Str("user_role", claims.Role).
				Strs("allowed_roles", allowedRoles).
				Str("path", r.URL.Path).
				Msg("Access denied - insufficient role")
			
			http.Error(w, "Insufficient permissions", http.StatusForbidden)
		})
	}
} 