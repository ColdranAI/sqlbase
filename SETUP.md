## Prerequisites
- Go 1.21+
- Node.js 18+
- PostgreSQL 13+
- Redis (optional)
- pnpm

## Quick Setup

### 1. Backend Setup
```bash
cd backend
cp env.template .env
# Edit .env with your configuration
go mod tidy
go run main.go
```

### 2. Frontend Setup
```bash
cd frontend
cp env.example .env
# Edit .env with your configuration
pnpm install
pnpm db:push
pnpm dev
```

## Environment Configuration

### Backend (.env)
```env
# Server
PORT=8080
LOG_LEVEL=info

# System Database (for user management, app data)
DATABASE_URL=postgresql://username:password@localhost:5432/fullstack_app

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Better Auth JWT Validation
BETTER_AUTH_PUBLIC_KEY=your-better-auth-public-key-base64

# Encryption for sensitive data (32 bytes for AES-256)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef

# Rate Limiting
RATE_LIMIT_RPS=100
RATE_LIMIT_BURST=200

# Note: Per-user database connections (DATABASE_URL, SSH configs) are managed 
# through the dashboard and stored encrypted in user_resources table
```

### Frontend (.env)
```env
# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# System Database (for authentication and app data)
DATABASE_URL=postgresql://username:password@localhost:5432/fullstack_app

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8080

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Per-User Database Configuration

This application supports per-user database connections configured through the dashboard:

### How It Works
1. **System Database**: Backend uses a system PostgreSQL database for user management, authentication, and storing user database configurations
2. **User Database Configs**: Each user configures their own database connection through the dashboard UI
3. **Storage**: Database configurations are stored in the `user_resources` table with `resource_type: "database_config"`
4. **Dynamic Connections**: Backend creates database connections dynamically based on user configuration
5. **Connection Types**: Supports direct PostgreSQL, SSH tunneling, and WireGuard VPN connections

### Database Configuration Storage
User database configurations are stored as JSON in the `user_resources` table:

```json
{
  "resource_type": "database_config",
  "resource_data": {
    "connection_type": "postgresql|ssh|wireguard",
    "database_url": "postgresql://user:pass@host:5432/db",
    "ssh_config": {
      "host": "ssh-server.com",
      "port": 22,
      "user": "ubuntu",
      "key_path": "/path/to/key"
    },
    "wireguard_config": {
      "config": "wireguard config content",
      "internal_db_url": "postgresql://user:pass@internal-ip:5432/db"
    }
  }
}
```

### Dashboard Integration
The dashboard provides a UI for users to:
- Configure PostgreSQL connection strings
- Set up SSH tunnel parameters
- Upload WireGuard configurations
- Test database connections
- Manage multiple database connections

