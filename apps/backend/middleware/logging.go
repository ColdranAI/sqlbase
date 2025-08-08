package middleware

import (
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	bytesWritten int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.bytesWritten += n
	return n, err
}

func LoggingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			
			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}
			
			next.ServeHTTP(rw, r)
			
			duration := time.Since(start)
			
			logEvent := log.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("query", r.URL.RawQuery).
				Str("remote_addr", r.RemoteAddr).
				Str("user_agent", r.UserAgent()).
				Int("status_code", rw.statusCode).
				Int("bytes_written", rw.bytesWritten).
				Dur("duration", duration).
				Str("protocol", r.Proto)
			
			if referer := r.Header.Get("Referer"); referer != "" {
				logEvent = logEvent.Str("referer", referer)
			}
			
			if rw.statusCode >= 400 {
				logEvent = log.Warn().
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Str("query", r.URL.RawQuery).
					Str("remote_addr", r.RemoteAddr).
					Int("status_code", rw.statusCode).
					Dur("duration", duration)
			}
			
			logEvent.Msg("HTTP request processed")
		})
	}
}

func HealthCheckLoggingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}
			
			LoggingMiddleware()(next).ServeHTTP(w, r)
		})
	}
} 