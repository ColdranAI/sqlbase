# 🔧 Complete PostgreSQL Setup for SQLBase

## 🔗 GitHub OAuth Callback URL
```
http://localhost:3000/api/auth/callback/github
```

## 1. Set up PostgreSQL Database

### Option A: Local PostgreSQL
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql
createdb sqlbase_db
```

### Option B: Docker PostgreSQL
```bash
# Run PostgreSQL in Docker
docker run --name sqlbase-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=sqlbase_db -p 5432:5432 -d postgres:15

# Or use docker-compose (create docker-compose.yml):
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: sqlbase_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
```

### Option C: Cloud PostgreSQL
Use any cloud provider:
- **Neon**: https://neon.tech (free tier)
- **Supabase**: https://supabase.com (free tier)
- **Railway**: https://railway.app (free tier)
- **Vercel Postgres**: https://vercel.com/storage/postgres

## 2. Create `.env.local` file

```bash
# Better Auth Configuration
BETTER_AUTH_SECRET=M95I83VxF38niZaZNJIIGhNhyYI50H1gD/ljlgrb8Fg=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# PostgreSQL Database
DATABASE_URL=postgresql://username:password@localhost:5432/sqlbase_db

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

## 3. Set up GitHub OAuth App

1. Go to: https://github.com/settings/applications/new
2. Fill in:
   - **Application name**: SQLBase
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Click "Register application"
4. Copy the **Client ID** and **Client Secret** to your `.env.local` file

## 4. Initialize Database

```bash
# Push schema to database (creates tables)
pnpm db:push

# Start development server
pnpm dev
```

## 5. Database Management Commands

```bash
# Generate migrations after schema changes
pnpm db:generate

# Push changes to database
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

## 6. Test Your Setup

1. Visit: http://localhost:3000
2. Click "Sign Up" in the navbar
3. Try both authentication methods:
   - GitHub OAuth
   - Email/password registration
4. Access your dashboard at: http://localhost:3000/dashboard

## 🛢️ Database Schema

Your PostgreSQL database includes:
- **`user`** - User profiles with timestamps
- **`session`** - Secure session management
- **`account`** - OAuth + password authentication
- **`verification`** - Email verification tokens

All using native PostgreSQL types (boolean, timestamp, text) for optimal performance!

You're all set with PostgreSQL! 🚀 