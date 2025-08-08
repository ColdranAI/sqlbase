package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/rs/zerolog/log"
)

var encryptionKey []byte

func init() {
	// Load encryption key from environment
	keyStr := os.Getenv("ENCRYPTION_KEY")
	if keyStr == "" {
		// In production, this should fail or use a secrets manager
		// For development, generate a default key
		keyStr = "0123456789abcdef0123456789abcdef" // 32 bytes for AES-256
	}
	
	encryptionKey = []byte(keyStr)
	if len(encryptionKey) != 32 {
		panic("ENCRYPTION_KEY must be exactly 32 bytes for AES-256")
	}
}

// Encrypt encrypts plaintext using AES-GCM
func Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64 encoded ciphertext using AES-GCM
func Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(data) < aesGCM.NonceSize() {
		return "", errors.New("ciphertext too short")
	}

	nonce, cipherData := data[:aesGCM.NonceSize()], data[aesGCM.NonceSize():]
	plaintext, err := aesGCM.Open(nil, nonce, cipherData, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// EncryptSensitiveConfig encrypts sensitive parts of database configuration
func EncryptSensitiveConfig(config map[string]interface{}) (map[string]interface{}, error) {
	encryptedConfig := make(map[string]interface{})
	
	for key, value := range config {
		// Encrypt sensitive fields
		if isSensitiveField(key) {
			if strValue, ok := value.(string); ok {
				encrypted, err := Encrypt(strValue)
				if err != nil {
					return nil, err
				}
				encryptedConfig[key] = encrypted
			} else {
				encryptedConfig[key] = value
			}
		} else {
			encryptedConfig[key] = value
		}
	}
	
	return encryptedConfig, nil
}

// DecryptSensitiveConfig decrypts sensitive parts of database configuration
func DecryptSensitiveConfig(config map[string]interface{}) (map[string]interface{}, error) {
	decryptedConfig := make(map[string]interface{})
	
	for key, value := range config {
		// Decrypt sensitive fields
		if isSensitiveField(key) {
			if strValue, ok := value.(string); ok {
				decrypted, err := Decrypt(strValue)
				if err != nil {
					return nil, err
				}
				decryptedConfig[key] = decrypted
			} else {
				decryptedConfig[key] = value
			}
		} else {
			decryptedConfig[key] = value
		}
	}
	
	return decryptedConfig, nil
}

// isSensitiveField returns true if the field contains sensitive data that should be encrypted
func isSensitiveField(fieldName string) bool {
	sensitiveFields := []string{
		"database_url",
		"password",
		"private_key",
		"key_path",
		"ssh_key",
		"internal_db_url",
		"config", // WireGuard config
	}
	
	for _, sensitive := range sensitiveFields {
		if fieldName == sensitive {
			return true
		}
	}
	
	return false
}

// ConfigEncryption handles encryption/decryption of sensitive configuration data
type ConfigEncryption struct {
	masterKey []byte
}

// NewConfigEncryption creates a new encryption handler with the master key from environment
func NewConfigEncryption() (*ConfigEncryption, error) {
	masterKeyEnv := os.Getenv("ENCRYPTION_KEY")
	if masterKeyEnv == "" {
		return nil, fmt.Errorf("ENCRYPTION_KEY environment variable is required")
	}

	// Use SHA256 to ensure we have exactly 32 bytes for AES-256
	hash := sha256.Sum256([]byte(masterKeyEnv))
	masterKey := hash[:]

	return &ConfigEncryption{
		masterKey: masterKey,
	}, nil
}

// EncryptConfig encrypts configuration data using AES-256-GCM
func (ce *ConfigEncryption) EncryptConfig(userID, configType string, data []byte) (string, error) {
	// Create user-specific key by combining master key with user ID
	userKey := ce.deriveUserKey(userID, configType)

	// Create AES cipher
	block, err := aes.NewCipher(userKey)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt data (nonce is prepended to ciphertext by Seal)
	ciphertext := gcm.Seal(nonce, nonce, data, nil)

	// Encode to base64 for database storage
	encoded := base64.StdEncoding.EncodeToString(ciphertext)

	log.Debug().
		Str("user_id", userID).
		Str("config_type", configType).
		Int("original_size", len(data)).
		Int("encrypted_size", len(encoded)).
		Msg("Configuration encrypted successfully")

	return encoded, nil
}

// DecryptConfig decrypts configuration data using AES-256-GCM
func (ce *ConfigEncryption) DecryptConfig(userID, configType, encryptedData string) ([]byte, error) {
	// Decode from base64
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	// Create user-specific key
	userKey := ce.deriveUserKey(userID, configType)

	// Create AES cipher
	block, err := aes.NewCipher(userKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Check minimum length (nonce + tag)
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and encrypted data
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt config: %w", err)
	}

	log.Debug().
		Str("user_id", userID).
		Str("config_type", configType).
		Int("decrypted_size", len(plaintext)).
		Msg("Configuration decrypted successfully")

	return plaintext, nil
}

// deriveUserKey creates a user-specific encryption key by combining master key with user data
func (ce *ConfigEncryption) deriveUserKey(userID, configType string) []byte {
	// Combine master key with user ID and config type for unique per-user-per-config keys
	combined := fmt.Sprintf("%s:%s:%s", string(ce.masterKey), userID, configType)
	hash := sha256.Sum256([]byte(combined))
	return hash[:]
}

// ZeroBytes securely zeros out byte slice from memory (for sensitive data)
func ZeroBytes(data []byte) {
	for i := range data {
		data[i] = 0
	}
}

// ValidateConfigTypes ensures only known config types are encrypted
func ValidateConfigType(configType string) error {
	validTypes := map[string]bool{
		"postgresql": true,
		"ssh":        true,
		"wireguard":  true,
	}

	if !validTypes[configType] {
		return fmt.Errorf("invalid config type: %s", configType)
	}

	return nil
}

// GetSensitiveFields returns list of fields that should be encrypted for each config type
func GetSensitiveFields(configType string) []string {
	switch configType {
	case "postgresql":
		return []string{"database_url"} // Contains credentials
	case "ssh":
		return []string{"database_url", "key_path", "host", "username"} // SSH credentials
	case "wireguard":
		return []string{"config_content", "internal_db_url"} // VPN config and internal URL
	default:
		return []string{}
	}
} 