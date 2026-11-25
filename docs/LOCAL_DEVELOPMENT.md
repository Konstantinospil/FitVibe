# Running FitVibe Locally (Without Docker)

This guide explains how to run the FitVibe application locally without Docker for development and testing.

## Quick Start

The easiest way to run everything locally is using the provided script:

```bash
./scripts/run-local.sh
```

This script will:

1. Stop any running Docker containers
2. Check that PostgreSQL is running
3. Create the database if needed
4. Run database migrations
5. Start both backend and frontend development servers

## Manual Setup

If you prefer to run the steps manually, follow these instructions:

### Prerequisites

1. **PostgreSQL 14+** must be installed and running locally
2. **Node.js 24+** and **PNPM 10** installed
3. All dependencies installed: `pnpm install`

### Step 1: Stop Docker Containers

If Docker containers are running and occupying ports, stop them:

```bash
# Stop Docker containers
docker compose -f infra/docker/dev/docker-compose.dev.yml down

# Or if using docker-compose (older versions)
docker-compose -f infra/docker/dev/docker-compose.dev.yml down
```

### Step 2: Start PostgreSQL

Ensure PostgreSQL is running on port 5432:

**macOS Options:**

1. **If PostgreSQL is already installed** (check with `which psql`):

   ```bash
   # Find your PostgreSQL data directory
   pg_config --sharedir

   # Start PostgreSQL manually (adjust path as needed)
   pg_ctl -D /usr/local/var/postgres start
   # or
   pg_ctl -D /Library/PostgreSQL/16/data start
   # or
   pg_ctl -D ~/Library/Application\ Support/Postgres/var-16 start
   ```

2. **Using Postgres.app** (GUI - recommended for macOS without Homebrew):
   - Download from: https://postgresapp.com/
   - Install and launch the app
   - Click "Initialize" to create a new server
   - The server will start automatically

3. **Using Docker (just for PostgreSQL):**

   ```bash
   docker run --name fitvibe-postgres \
     -e POSTGRES_USER=fitvibe \
     -e POSTGRES_PASSWORD=fitvibe \
     -e POSTGRES_DB=fitvibe \
     -p 5432:5432 \
     -d postgres:16-alpine
   ```

4. **Install via Homebrew** (if you want to install Homebrew first):
   ```bash
   # Install Homebrew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew services start postgresql@16
   ```

**Linux (systemd):**

```bash
sudo systemctl start postgresql
```

**Check if PostgreSQL is running:**

```bash
pg_isready -h localhost -p 5432
```

If `pg_isready` is not found, PostgreSQL may not be installed. You can:

- Install PostgreSQL from https://www.postgresql.org/download/
- Use Docker (option 3 above)
- Use Postgres.app (option 2 above)

### Step 3: Create Database (if needed)

The database should be created automatically, but you can create it manually:

```bash
createdb -h localhost -U fitvibe fitvibe
```

Or using psql:

```bash
psql -h localhost -U fitvibe -d postgres -c "CREATE DATABASE fitvibe;"
```

### Step 4: Configure Environment Variables

Ensure you have the necessary environment variables set. The backend will use defaults if not set:

**Backend defaults:**

- `PGHOST=localhost`
- `PGPORT=5432`
- `PGDATABASE=fitvibe`
- `PGUSER=fitvibe`
- `PGPASSWORD=fitvibe`
- `PORT=4000`

**Frontend defaults:**

- Vite dev server runs on port `5173`
- API proxy configured to `http://localhost:4000`

You can create `.env` files in `apps/backend/` and `apps/frontend/` to override defaults.

### Step 5: Run Database Migrations

```bash
pnpm --filter @fitvibe/backend run db:migrate
```

### Step 6: Start Development Servers

**Option A: Start both together (recommended)**

```bash
pnpm dev
```

This runs both backend and frontend in parallel using Turbo.

**Option B: Start separately**

Terminal 1 - Backend:

```bash
pnpm --filter @fitvibe/backend dev
```

Terminal 2 - Frontend:

```bash
pnpm --filter @fitvibe/frontend dev
```

### Step 7: Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **API Health Check**: http://localhost:4000/health

## Port Configuration

If you need to use different ports (e.g., if Docker is still running or ports are occupied):

### Backend Port

Set the `PORT` environment variable:

```bash
PORT=4001 pnpm --filter @fitvibe/backend dev
```

Or create `apps/backend/.env`:

```
PORT=4001
```

### Frontend Port

Edit `apps/frontend/vite.config.ts` or set via environment:

```bash
# In vite.config.ts, change:
server: {
  port: 5174,  // Change from 5173
}
```

### Database Port

If PostgreSQL is running on a different port, set:

```bash
PGPORT=5433 pnpm --filter @fitvibe/backend run db:migrate
```

Or in `apps/backend/.env`:

```
PGPORT=5433
```

## Optional Services

### Redis (Optional)

Redis is optional - the application will fall back to in-memory caching if Redis is not available.

To use Redis:

1. Install and start Redis locally
2. Set `REDIS_ENABLED=true` in backend environment
3. Configure `REDIS_HOST` and `REDIS_PORT` if different from defaults

### Email and the test mailbox (sign-up)

Registration is email-first (ADR-039): `/register` asks only for an address, and the link to finish creating the account is sent by email. Without SMTP, enable the in-memory test mailbox:

1. Set `EMAIL_CAPTURE_ENABLED=true` in the backend environment (refused when `NODE_ENV=production`).
2. Submit the address on `/register`.
3. Open `http://localhost:4000/api/v1/dev/mail?to=<address>` and follow the `/register/complete?token=…` link in the newest message.

`DELETE /api/v1/dev/mail` clears the mailbox. Captured mail lives in backend memory and is lost on restart.

### ClamAV (Optional)

ClamAV is only needed if you want antivirus scanning. It's disabled by default.

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

1. **Find what's using the port:**

   ```bash
   lsof -i :4000  # Backend
   lsof -i :5173  # Frontend
   lsof -i :5432  # PostgreSQL
   ```

2. **Kill the process:**

   ```bash
   kill -9 <PID>
   ```

3. **Or use different ports** (see Port Configuration above)

### Database Connection Errors

1. **Verify PostgreSQL is running:**

   ```bash
   pg_isready -h localhost -p 5432
   ```

2. **Check credentials:**

   ```bash
   psql -h localhost -U fitvibe -d fitvibe
   ```

3. **Verify environment variables:**
   ```bash
   # In apps/backend directory
   # Database connection settings
   echo $PGHOST
   echo $PGPORT
   echo $PGDATABASE
   echo $PGUSER
   ```

### Database SSL/TLS Configuration

For production deployments, SSL/TLS encryption is required for database connections. In development, SSL is optional.

**Environment Variables for SSL:**

- `PGSSL=true` - Enable SSL/TLS for database connections
- `PGSSL_REJECT_UNAUTHORIZED=true` - (Optional) Verify the server certificate even when not in production
- `PGSSL_CA=/path/to/ca-cert.pem` - (Optional) Path or PEM for CA certificate
- `PGSSL_CERT=/path/to/client-cert.pem` - (Optional) Path or PEM for client certificate (for mutual TLS)
- `PGSSL_KEY=/path/to/client-key.pem` - (Optional) Path or PEM for client key (for mutual TLS)

**Development (Local):**

```bash
# SSL is optional in development
# If you want to test SSL locally, you can use:
PGSSL=true
# This will use relaxed SSL (allows self-signed certificates)
```

**Production:**

```bash
# SSL is required in production with certificate verification
NODE_ENV=production
PGSSL=true
PGSSL_CA=/path/to/ca-cert.pem
# Optional: For mutual TLS
PGSSL_CERT=/path/to/client-cert.pem
PGSSL_KEY=/path/to/client-key.pem
```

**Note:** In production (`NODE_ENV=production`), SSL connections require certificate verification (`rejectUnauthorized: true`). In development/test environments, self-signed certificates are allowed.

### Database Connection Errors

cat .env # Check if .env exists and has correct values

````

### Migration Errors

1. **Check database exists:**
```bash
psql -h localhost -U fitvibe -l | grep fitvibe
````

2. **Check migration status:**
   ```bash
   # The migrate script will show which migrations were applied
   pnpm --filter @fitvibe/backend run db:migrate
   ```

### Frontend Can't Reach Backend

1. **Check backend is running:**

   ```bash
   curl http://localhost:4000/health
   ```

2. **Check Vite proxy configuration** in `apps/frontend/vite.config.ts`:

   ```typescript
   server: {
     proxy: {
       "/api": "http://localhost:4000",
     },
   }
   ```

3. **Check CORS settings** - backend should allow `http://localhost:5173`

## Development Workflow

1. **Make code changes** - Both servers run in watch mode and will auto-reload
2. **Run tests:**
   ```bash
   pnpm test              # All tests
   pnpm test:backend       # Backend only
   pnpm test:frontend      # Frontend only
   pnpm test:integration   # Backend integration tests (requires Postgres; see apps/backend/README.md)
   ```
3. **Check types:**
   ```bash
   pnpm typecheck
   ```
4. **Lint code:**
   ```bash
   pnpm lint
   ```

## Seeding Data (Optional)

To seed the database with test data:

```bash
pnpm --filter @fitvibe/backend run db:seed
```

## Stopping the Application

Press `Ctrl+C` in the terminal where `pnpm dev` is running, or:

```bash
# Find and kill processes
pkill -f "tsx watch src/server.ts"  # Backend
pkill -f "vite"                     # Frontend
```

## Next Steps

- See [Backend README](../apps/backend/README.md) for backend-specific details
- See [Frontend README](../apps/frontend/README.md) for frontend-specific details
- See [Contributing Guide](CONTRIBUTING.md) for development guidelines
