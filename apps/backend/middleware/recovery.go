package middleware

import (
	"encoding/json"
	"net/http"
	"runtime"

	"github.com/rs/zerolog/log"
)

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    int    `json:"code"`
}

func RecoveryMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					stack := make([]byte, 4096)
					stack = stack[:runtime.Stack(stack, false)]
					
					log.Error().
						Interface("panic", err).
						Str("stack", string(stack)).
						Str("method", r.Method).
						Str("path", r.URL.Path).
						Str("remote_addr", r.RemoteAddr).
						Msg("Panic recovered")
					
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					
					response := ErrorResponse{
						Error:   "Internal server error",
						Message: "An unexpected error occurred",
						Code:    http.StatusInternalServerError,
					}
					
					json.NewEncoder(w).Encode(response)
				}
			}()
			
			next.ServeHTTP(w, r)
		})
	}
}

func ErrorHandlerMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}
}

func WriteErrorResponse(w http.ResponseWriter, statusCode int, err error, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	
	response := ErrorResponse{
		Error:   err.Error(),
		Message: message,
		Code:    statusCode,
	}
	
	if encodeErr := json.NewEncoder(w).Encode(response); encodeErr != nil {
		log.Error().Err(encodeErr).Msg("Failed to encode error response")
	}
}

func WriteJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Error().Err(err).Msg("Failed to encode JSON response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
} 