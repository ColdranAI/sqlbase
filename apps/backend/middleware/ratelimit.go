package middleware

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
	"github.com/rs/zerolog/log"
)

type IPRateLimiter struct {
	ips map[string]*rate.Limiter
	mu  *sync.RWMutex
	r   rate.Limit
	b   int
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	return &IPRateLimiter{
		ips: make(map[string]*rate.Limiter),
		mu:  &sync.RWMutex{},
		r:   r,
		b:   b,
	}
}

func (i *IPRateLimiter) AddIP(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	limiter := rate.NewLimiter(i.r, i.b)
	i.ips[ip] = limiter

	return limiter
}

func (i *IPRateLimiter) GetLimiterForIP(ip string) *rate.Limiter {
	i.mu.Lock()
	limiter, exists := i.ips[ip]

	if !exists {
		i.mu.Unlock()
		return i.AddIP(ip)
	}

	i.mu.Unlock()
	return limiter
}

func (i *IPRateLimiter) CleanupStaleIPs() {
	i.mu.Lock()
	defer i.mu.Unlock()
	
	for ip, limiter := range i.ips {
		if limiter.AllowN(time.Now(), 0) {
			continue
		}
		
		if time.Since(time.Now()) > time.Hour {
			delete(i.ips, ip)
		}
	}
}

func RateLimitMiddleware(rps int, burst int) func(http.Handler) http.Handler {
	limiter := NewIPRateLimiter(rate.Limit(rps), burst)
	
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		
		for range ticker.C {
			limiter.CleanupStaleIPs()
		}
	}()
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			limiter := limiter.GetLimiterForIP(ip)
			
			if !limiter.Allow() {
				log.Warn().
					Str("ip", ip).
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("Rate limit exceeded")
				
				w.Header().Set("Retry-After", "60")
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
}

func UserRateLimitMiddleware(rps int, burst int) func(http.Handler) http.Handler {
	limiters := make(map[string]*rate.Limiter)
	mu := &sync.RWMutex{}
	
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		
		for range ticker.C {
			mu.Lock()
			for userID, limiter := range limiters {
				if limiter.AllowN(time.Now(), 0) {
					continue
				}
				if time.Since(time.Now()) > time.Hour {
					delete(limiters, userID)
				}
			}
			mu.Unlock()
		}
	}()
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetUserClaims(r.Context())
			if claims == nil {
				next.ServeHTTP(w, r)
				return
			}
			
			userID := claims.UserID
			mu.RLock()
			limiter, exists := limiters[userID]
			mu.RUnlock()
			
			if !exists {
				mu.Lock()
				limiter = rate.NewLimiter(rate.Limit(rps), burst)
				limiters[userID] = limiter
				mu.Unlock()
			}
			
			if !limiter.Allow() {
				log.Warn().
					Str("user_id", userID).
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("User rate limit exceeded")
				
				w.Header().Set("Retry-After", "60")
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
}

func getClientIP(r *http.Request) string {
	xForwardedFor := r.Header.Get("X-Forwarded-For")
	if xForwardedFor != "" {
		return xForwardedFor
	}
	
	xRealIP := r.Header.Get("X-Real-IP")
	if xRealIP != "" {
		return xRealIP
	}
	
	return r.RemoteAddr
} 