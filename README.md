# sqlbase






## API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /` - Service info
- `POST /api/v1/public/metrics` - Create anonymous metric

### Authenticated Endpoints (Bearer Token Required)
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{user_id}` - Get user profile
- `PUT /api/v1/users/{user_id}` - Update user profile
- `POST /api/v1/users/{user_id}/resources` - Create user resource (including database configs)
- `GET /api/v1/users/{user_id}/resources` - Get user resources
- `POST /api/v1/metrics` - Create metric
- `GET /api/v1/metrics` - Get metrics
- `GET /api/v1/metrics/summary` - Get metrics summary

### Database Configuration Endpoints
- `POST /api/v1/users/{user_id}/database-config` - Create/update database configuration
- `DELETE /api/v1/users/{user_id}/database-config` - Delete database configuration
- `POST /api/v1/users/{user_id}/database-config/test` - Test database connection

### SQL Playground Endpoints
- `POST /api/v1/users/{user_id}/sql/execute` - Execute SQL query on user's database
- `GET /api/v1/users/{user_id}/sql/schema` - Get database schema (tables, columns, etc.)
- `GET /api/v1/users/{user_id}/sql/history` - Get user's query execution history

### Admin Endpoints
- `POST /api/v1/admin/users` - Create user (admin only)

