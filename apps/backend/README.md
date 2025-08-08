# Secure Go Backend

A comprehensive, production-ready Go backend with JWT authentication, PostgreSQL database, Redis caching, and advanced security features.

## Features

### 🔐 Authentication & Security
- **BetterAuth JWT Integration**: Validates Bearer tokens with RSA signature verification
- **Role-based Access Control**: Support for user roles and permissions
- **Rate Limiting**: IP-based and user-based rate limiting
- **CORS Support**: Configurable cross-origin resource sharing
- **Input Validation**: Request payload validation and sanitization

### 🗄️ Database & Storage
- **PostgreSQL**: Primary database with pgx driver and connection pooling
- **Redis**: Optional caching layer for improved performance
- **Auto-reconnection**: Automatic database connection management
- **Health Checks**: Continuous database connection monitoring
- **Migration Support**: Automatic table initialization

### 🌐 Networking & Connectivity
- **SSH Tunneling**: Secure remote database connections
- **WireGuard Support**: (Framework ready for VPN integration)
- **Connection Pooling**: Optimized database connection management
- **Graceful Shutdown**: Clean server shutdown with resource cleanup

### 📊 API Features
- **RESTful Design**: Clean, consistent API endpoints
- **User Management**: CRUD operations for user profiles
- **Resource Management**: User-specific resource handling
- **Metrics & Analytics**: Comprehensive tracking and reporting
- **Pagination**: Efficient data retrieval with pagination support

### 🛡️ Middleware Stack
- **Request Logging**: Detailed request/response logging with zerolog
- **Error Handling**: Comprehensive error handling and recovery
- **Panic Recovery**: Graceful panic recovery with stack traces
- **Memory Management**: Leak prevention and resource cleanup

## API Endpoints

### Authentication Required
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{user_id}` - Get user profile
- `PUT /api/v1/users/{user_id}` - Update user profile
- `POST /api/v1/users/{user_id}/resources` - Create user resource
- `GET /api/v1/users/{user_id}/resources` - Get user resources
- `POST /api/v1/metrics` - Create metric
- `GET /api/v1/metrics` - Get metrics
- `GET /api/v1/metrics/summary` - Get metrics summary

### Public Endpoints
- `GET /health` - Health check
- `GET /` - Service info
- `POST /api/v1/public/metrics` - Create anonymous metric

### Admin Only
- `POST /api/v1/admin/users` - Create user (admin)

## Quick Start

### Using Docker Compose

1. **Clone and setup**:
```bash
git clone <repository>
cd go-backend
cp env.template .env
# Edit .env with your configuration
```

2. **Start services**:
```bash
docker-compose up -d
```

3. **Verify health**:
```bash
curl http://localhost:8080/health
```

### Manual Setup

1. **Install dependencies**:
```bash
go mod tidy
```

2. **Setup environment**:
```bash
cp env.template .env
# Configure your .env file
```

3. **Start PostgreSQL and Redis**:
```bash
# Using Docker
docker run -d --name postgres -p 5432:5432 -e POSTGRES_DB=go_backend -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password postgres:15
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

4. **Run the server**:
```bash
go run main.go
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | No | - |
| `BETTER_AUTH_PUBLIC_KEY` | BetterAuth RSA public key (base64) | Yes | - |
| `SSH_HOST` | SSH tunnel host | No | - |
| `SSH_PORT` | SSH tunnel port | No | `22` |
| `SSH_USER` | SSH tunnel username | No | - |
| `SSH_KEY_PATH` | SSH private key path | No | - |
| `RATE_LIMIT_RPS` | Requests per second limit | No | `100` |
| `RATE_LIMIT_BURST` | Rate limit burst capacity | No | `200` |
| `LOG_LEVEL` | Logging level | No | `info` |

### Database Configuration

The backend automatically creates the following tables:
- `users` - User profiles and authentication data
- `user_resources` - User-specific resources with JSONB data
- `metrics` - Analytics and tracking data

### SSH Tunnel Setup

For secure remote database connections:

1. **Generate SSH key pair**:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/go_backend_key
```

2. **Add public key to remote server**:
```bash
ssh-copy-id -i ~/.ssh/go_backend_key.pub user@remote-server.com
```

3. **Configure environment**:
```bash
SSH_HOST=remote-server.com
SSH_USER=user
SSH_KEY_PATH=/path/to/go_backend_key
DATABASE_URL=postgres://user:pass@localhost:5433/dbname
```

## Security Considerations

### JWT Token Validation
- Tokens must be issued by BetterAuth
- RSA signature verification required
- Automatic expiration checking
- Role-based access control

### Rate Limiting
- IP-based rate limiting for all endpoints
- User-based rate limiting for authenticated endpoints
- Configurable limits per endpoint group
- Automatic cleanup of stale limiters

### Database Security
- Connection pooling with limits
- Prepared statements for SQL injection prevention
- Automatic connection health monitoring
- Graceful degradation on connection failures

### Network Security
- SSH tunneling for remote connections
- CORS configuration for browser security
- TLS support ready (configure reverse proxy)

## Monitoring & Observability

### Health Checks
```bash
curl http://localhost:8080/health
```

Response includes:
- Overall service status
- Database connectivity
- Redis connectivity (if configured)
- Service version and timestamp

### Logging
- Structured logging with zerolog
- Request/response logging
- Error tracking with stack traces
- Performance metrics

### Metrics
- Built-in metrics collection
- User activity tracking
- Performance monitoring
- Custom metric support

## Development

### Project Structure
```
go-backend/
├── auth/           # JWT validation and authentication
├── config/         # Configuration management
├── database/       # Database connections and SSH tunneling
├── handlers/       # HTTP request handlers
├── middleware/     # HTTP middleware stack
├── models/         # Data models and DTOs
├── main.go         # Application entry point
├── go.mod          # Go module definition
├── docker-compose.yml
├── Dockerfile
└── env.template    # Environment configuration template
```

### Building

```bash
# Development build
go build -o go-backend

# Production build
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o go-backend

# Docker image
docker build -t go-backend .
```

### Testing

```bash
# Run tests
go test ./...

# Run with coverage
go test -cover ./...

# Benchmark tests
go test -bench=. ./...
```

## Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Scale the service
docker-compose up -d --scale go-backend=3
```

### Production Deployment
1. Use environment-specific configuration
2. Configure TLS termination (nginx/traefik)
3. Set up monitoring and logging
4. Configure database backups
5. Set up health checks and restart policies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

