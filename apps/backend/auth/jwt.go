package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTValidator struct {
	secret []byte
}

type UserClaims struct {
	UserID string `json:"sub"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func NewJWTValidator(betterAuthSecret string) (*JWTValidator, error) {
	if betterAuthSecret == "" {
		return nil, errors.New("better auth secret is required")
	}
	
	return &JWTValidator{
		secret: []byte(betterAuthSecret),
	}, nil
}

func (v *JWTValidator) ValidateToken(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return v.secret, nil
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}
	
	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
			return nil, errors.New("token has expired")
		}
		
		// Map the sub claim to UserID for compatibility
		if claims.UserID == "" && claims.Subject != "" {
			claims.UserID = claims.Subject
		}
		
		return claims, nil
	}
	
	return nil, errors.New("invalid token")
} 