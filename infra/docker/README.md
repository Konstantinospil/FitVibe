# Docker Configurations

This directory contains Docker Compose files and Dockerfiles for different environments (development, staging, production) and services.

## Directory Structure

| Directory  | Purpose                 | Contents                                                    |
| ---------- | ----------------------- | ----------------------------------------------------------- |
| `dev/`     | Development environment | Docker Compose for local development with hot-reload        |
| `staging/` | Staging environment     | Docker Compose for staging deployments                      |
| `prod/`    | Production environment  | Docker Compose and Dockerfiles for production               |
| `keys/`    | JWT keys                | Public keys for JWT verification (private keys not in repo) |

## Environments

### Development (`dev/`)

The development stack includes:

- **Backend**: Express API with hot-reload via TSX
- **Frontend**: Vite dev server with HMR
- **PostgreSQL**: Database with persistent volumes
- **NGINX**: Reverse proxy and static file serving
- **ClamAV**: Optional antivirus scanning service

**Usage:**

```bash
docker compose -f infra/docker/dev/compose.dev.yml up --build
```

**Features:**

- Hot module replacement for frontend
- TypeScript watch mode for backend
- Development-friendly logging
- Local database with seed data support

### Staging (`staging/`)

Staging environment configuration for pre-production testing.

**Usage:**

```bash
docker compose -f infra/docker/staging/docker-compose.staging.yml up --build
```

**Features:**

- Production-like configuration
- Staging-specific environment variables
- Integration with staging services

### Production (`prod/`)

Production-ready Docker configurations.

**Files:**

- `compose.yml` - Single authoritative production Compose contract
- `README.md` - Production stack/runtime contract
- `Dockerfile.backend` - Backend production image
- `Dockerfile.frontend` - Frontend production image
- `nginx.conf` - Production NGINX configuration

Production deployment is performed by `.github/workflows/cd.yml`, which installs the canonical template as `/srv/stacks/fitvibe/compose.yml`. Validate changes with:

```bash
bash scripts/validate-production-compose.sh
```

**Features:**

- Optimized production builds
- Multi-stage builds for smaller images
- Security hardening
- Production logging and monitoring

## Dockerfiles

### Backend Dockerfile

Located in `dev/Dockerfile.backend` and `prod/Dockerfile.backend`.

**Key Features:**

- Node.js 24 LTS base image
- Multi-stage build for optimization
- TypeScript compilation
- Production dependencies only in final stage
- Non-root user for security

### Frontend Dockerfile

Located in `dev/Dockerfile.frontend` and `prod/Dockerfile.frontend`.

**Key Features:**

- Node.js 24 LTS base image
- Vite build process
- NGINX for serving static assets
- Optimized production bundle
- Security headers configured

## NGINX Configuration

NGINX configurations are environment-specific:

- `dev/nginx.conf` - Development proxy configuration
- `dev/nginx-frontend.conf` - Frontend-specific dev config
- `prod/nginx.conf` - Production NGINX configuration

See [`../nginx/README.md`](../nginx/README.md) for detailed NGINX documentation.

## Environment Variables

Each environment requires specific environment variables. Copy and customize:

```bash
# Development
cp .env.example .env
# Edit .env with your local settings
```

Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_PRIVATE_KEY_PATH` - Path to JWT private key
- `JWT_PUBLIC_KEY_PATH` - Path to JWT public key
- `NODE_ENV` - Environment (development, staging, production)

## Volumes and Persistence

### Development Volumes

- `postgres_data` - PostgreSQL data persistence
- `backend_node_modules` - Shared node_modules (optional)
- `frontend_node_modules` - Shared node_modules (optional)

### Production Volumes

- `db_data` - PostgreSQL data (backed up regularly)
- `clamav_signatures` - persisted ClamAV signature database
- `redis_data` - Redis AOF/background-job durability
- Static assets served via NGINX

## Networking

Services communicate via Docker networks:

- **Default network**: Services on the same network can communicate by service name
- **External networks**: For connecting to external services (Redis, etc.)

## Building Images

### Development

```bash
docker compose -f infra/docker/dev/compose.dev.yml build
```

### Production

```bash
# Build backend
docker build -f infra/docker/prod/Dockerfile.backend -t fitvibe-backend:latest apps/backend

# Build frontend
docker build -f infra/docker/prod/Dockerfile.frontend -t fitvibe-frontend:latest apps/frontend
```

## Health Checks

All services include health checks:

- **Backend**: `GET /health` (includes queue adapter/health)
- **Frontend**: HTTP 200 on root
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`
- **ClamAV**: `clamdscan --version`

## Security Considerations

1. **Never commit secrets**: Use environment variables or secrets management
2. **Use non-root users**: All containers run as non-root
3. **Keep images updated**: Regularly update base images for security patches
4. **Scan images**: Use tools like Trivy or Snyk to scan images
5. **JWT keys**: Private keys should never be in the repository

## Troubleshooting

### Container Won't Start

1. Check logs: `docker compose logs <service-name>`
2. Verify environment variables are set
3. Check port conflicts
4. Verify Docker has sufficient resources

### Database Connection Issues

1. Ensure PostgreSQL container is healthy
2. Verify `DATABASE_URL` is correct
3. Check network connectivity between containers
4. Review PostgreSQL logs

### Build Failures

1. Clear Docker cache: `docker builder prune`
2. Rebuild without cache: `docker compose build --no-cache`
3. Check Dockerfile syntax
4. Verify all dependencies are available

## Related Documentation

- [Infrastructure README](../README.md)
- [NGINX Configuration](../nginx/README.md)
- [Kubernetes Configurations](../kubernetes/README.md)
- [Backend README](../../apps/backend/README.md)
- [Frontend README](../../apps/frontend/README.md)
