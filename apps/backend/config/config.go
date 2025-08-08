package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	DatabaseURL  string
	RedisURL     string
	JWTSecret    string
	BetterAuthSecret string
	
	SSHHost     string
	SSHPort     string
	SSHUser     string
	SSHKeyPath  string
	
	RateLimitRPS int
	RateLimitBurst int
	
	LogLevel string
}

func Load() (*Config, error) {
	godotenv.Load()
	
	config := &Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://user:password@localhost/dbname?sslmode=disable"),
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:    getEnv("JWT_SECRET", ""),
		BetterAuthSecret: getEnv("BETTER_AUTH_SECRET", ""),
		
		SSHHost:     getEnv("SSH_HOST", ""),
		SSHPort:     getEnv("SSH_PORT", "22"),
		SSHUser:     getEnv("SSH_USER", ""),
		SSHKeyPath:  getEnv("SSH_KEY_PATH", ""),
		
		RateLimitRPS:   getEnvInt("RATE_LIMIT_RPS", 100),
		RateLimitBurst: getEnvInt("RATE_LIMIT_BURST", 200),
		
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
	
	return config, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
} 