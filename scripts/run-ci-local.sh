#!/usr/bin/env bash
set -euo pipefail

# Run CI workflow locally
# This script mimics the CI workflow steps locally

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED_JOBS=()

log() {
    echo -e "${GREEN}[CI]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v pnpm &> /dev/null; then
        error "pnpm is not installed. Please install pnpm 9.14.4"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        error "docker is not installed. Please install Docker"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        error "node is not installed. Please install Node.js >=18.19"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Start test services
start_services() {
    log "Starting test services (PostgreSQL and ClamAV)..."
    
    COMPOSE_FILE="$PROJECT_ROOT/infra/docker/test/docker-compose.test.yml"
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Docker compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Start PostgreSQL (required)
    docker compose -f "$COMPOSE_FILE" up -d postgres
    
    # Try to start ClamAV (optional)
    if docker compose -f "$COMPOSE_FILE" --profile clamav up -d clamav 2>/dev/null; then
        log "ClamAV container started"
    else
        warn "ClamAV container failed to start (may not be available on this platform)"
    fi
    
    # Wait for PostgreSQL
    log "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            log "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 2
    done
    
    # Create integration database and user if they don't exist
    log "Setting up integration database..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -c "CREATE USER fitvibe WITH PASSWORD 'fitvibe';" 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -c "CREATE DATABASE fitvibe OWNER fitvibe;" 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE fitvibe TO fitvibe;" 2>/dev/null || true
    
    # Wait for ClamAV (optional - continue if it fails)
    log "Waiting for ClamAV..."
    CLAMAV_READY=false
    for i in {1..30}; do
        if docker compose -f "$COMPOSE_FILE" --profile clamav exec -T clamav clamdscan --version >/dev/null 2>&1; then
            log "ClamAV is ready"
            CLAMAV_READY=true
            break
        fi
        sleep 2
    done
    
    if [ "$CLAMAV_READY" = "false" ]; then
        warn "ClamAV failed to start or is not available. Some tests may be skipped."
        export CLAMAV_ENABLED="false"
    fi
    
    log "All test services are ready"
    
    # Export for use in other functions
    export COMPOSE_FILE="$COMPOSE_FILE"
}

# Stop test services
stop_services() {
    log "Stopping test services..."
    local compose_file="${COMPOSE_FILE:-$PROJECT_ROOT/infra/docker/test/docker-compose.test.yml}"
    docker compose -f "$compose_file" down -v 2>/dev/null || true
}

# Set up environment variables
setup_env() {
    export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/fitvibe_test"
    export PGHOST="127.0.0.1"
    export PGPORT="5432"
    export PGUSER="postgres"
    export PGPASSWORD="postgres"
    export PGDATABASE="fitvibe_test"
    export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/fitvibe_test"
    export CLAMAV_ENABLED="true"
    export CLAMAV_HOST="127.0.0.1"
    export CLAMAV_PORT="3310"
    export REAL_CLAMD="1"
    export CI="true"
    export NODE_ENV="test"
}

# Run a job and track failures
run_job() {
    local job_name="$1"
    shift
    local command="$*"
    
    log "Running job: $job_name"
    if eval "$command"; then
        log "✅ $job_name passed"
        return 0
    else
        error "❌ $job_name failed"
        FAILED_JOBS+=("$job_name")
        return 1
    fi
}

# Quality gates
run_quality() {
    log "=== Quality Gates (Lint & Type Check) ==="
    
    run_job "Lint" "pnpm lint:check" || return 1
    run_job "Type Check" "pnpm typecheck" || return 1
    
    log "✅ Quality gates passed"
}

# Backend tests
run_backend_tests() {
    log "=== Backend Tests ==="
    
    run_job "Backend Unit Tests" \
        "pnpm --filter @fitvibe/backend test -- --coverage --maxWorkers=2 --testPathIgnorePatterns='migrations/migrations\\.test\\.ts|seeds/seeds\\.test\\.ts|.*\\.integration\\.test\\.ts$|src/db/utils/__tests__/scripts\\.test\\.ts'" || return 1
    
    log "✅ Backend tests passed"
}

# Frontend tests
run_frontend_tests() {
    log "=== Frontend Tests ==="
    
    run_job "Frontend Unit Tests" \
        "pnpm --filter @fitvibe/frontend test -- --coverage --maxWorkers=2" || return 1
    
    log "✅ Frontend tests passed"
}

# Database tests
run_database_tests() {
    log "=== Database Tests ==="
    
    run_job "Migration Tests" \
        "pnpm --filter @fitvibe/backend exec jest migrations/migrations.test.ts --maxWorkers=1" || return 1
    
    run_job "Seed Tests" \
        "pnpm --filter @fitvibe/backend exec jest seeds/seeds.test.ts --maxWorkers=1" || return 1
    
    log "✅ Database tests passed"
}

# Coverage gate
run_coverage() {
    log "=== Coverage Gate ==="
    
    run_job "Coverage Gate" "pnpm test:coverage:gate" || return 1
    
    log "✅ Coverage gate passed"
}

# Lighthouse CI
run_lighthouse() {
    log "=== Lighthouse CI ==="
    
    run_job "Build Frontend SSR" \
        "pnpm --filter @fitvibe/frontend run build:ssr" || return 1
    
    # Start SSR server in background
    log "Starting SSR server..."
    cd apps/frontend
    pnpm start:ssr > /tmp/ssr-server.log 2>&1 &
    SSR_PID=$!
    cd "$PROJECT_ROOT"
    
    # Wait for server
    for i in {1..30}; do
        if curl -fsS http://127.0.0.1:4173 >/dev/null 2>&1; then
            log "SSR server started"
            break
        fi
        if [ $i -eq 30 ]; then
            error "SSR server did not start in time"
            kill $SSR_PID 2>/dev/null || true
            return 1
        fi
        sleep 2
    done
    
    # Run Lighthouse
    run_job "Lighthouse CI" \
        "pnpm exec lhci autorun --config=tests/perf/lighthouserc.json --exit-on-error" || {
        kill $SSR_PID 2>/dev/null || true
        return 1
    }
    
    # Stop SSR server
    kill $SSR_PID 2>/dev/null || true
    pkill -f "tsx server.ts" || pkill -f "start:ssr" || true
    
    log "✅ Lighthouse CI passed"
}

# i18n check
run_i18n() {
    log "=== i18n Coverage Check ==="
    
    run_job "i18n Check" "pnpm i18n:check" || return 1
    
    log "✅ i18n check passed"
}

# Contract tests
run_contract_tests() {
    log "=== API Contract Tests ==="
    
    run_job "Generate OpenAPI Spec" "pnpm -w openapi:build" || return 1
    
    run_job "OpenAPI Contract Tests" \
        "pnpm --filter @fitvibe/backend exec jest tests/backend/contract/openapi.contract.test.ts --maxWorkers=1" || return 1
    
    log "✅ Contract tests passed"
}

# Excluded tests (integration and scripts)
run_excluded_tests() {
    log "=== Excluded Tests (Integration & Scripts) ==="
    
    run_job "Run Database Migrations" \
        "pnpm --filter @fitvibe/backend exec tsx src/db/utils/migrateAll.ts" || return 1
    
    run_job "Scripts Test" \
        "pnpm --filter @fitvibe/backend exec jest tests/backend/db/utils/scripts.test.ts --maxWorkers=1" || return 1
    
    run_job "Integration Tests" \
        "pnpm --filter @fitvibe/backend exec jest --maxWorkers=2 --testMatch='**/integration/**/*.integration.test.ts' --testPathIgnorePatterns='/node_modules/'" || return 1
    
    log "✅ Excluded tests passed"
}

# Integration tests (with seeded database)
run_integration_tests() {
    log "=== Backend Integration Tests ==="
    
    # Use integration database (same PostgreSQL instance, different database)
    export DATABASE_URL="postgresql://fitvibe:fitvibe@127.0.0.1:5432/fitvibe"
    export PGHOST="127.0.0.1"
    export PGPORT="5432"
    export PGUSER="fitvibe"
    export PGPASSWORD="fitvibe"
    export PGDATABASE="fitvibe"
    
    # Wait for integration database to be ready
    local compose_file="${COMPOSE_FILE:-$PROJECT_ROOT/infra/docker/test/docker-compose.test.yml}"
    log "Waiting for integration database to be ready..."
    for i in {1..30}; do
        if docker compose -f "$compose_file" exec -T postgres psql -U fitvibe -d fitvibe -c "SELECT 1;" >/dev/null 2>&1; then
            log "Integration database is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "Integration database failed to become ready"
            return 1
        fi
        sleep 2
    done
    
    run_job "Run Database Migrations (Integration)" \
        "pnpm --filter @fitvibe/backend exec tsx src/db/utils/migrateAll.ts" || return 1
    
    run_job "Seed Database" \
        "pnpm --filter @fitvibe/backend exec tsx src/db/utils/seedAll.ts" || return 1
    
    run_job "Integration Tests" \
        "pnpm --filter @fitvibe/backend exec jest --maxWorkers=2 --testMatch='**/integration/**/*.integration.test.ts' --testPathIgnorePatterns='/node_modules/'" || return 1
    
    # Reset to test database
    setup_env
    
    log "✅ Integration tests passed"
}

# Metrics contract
run_metrics_contract() {
    log "=== Metrics Contract ==="
    
    run_job "Validate Metrics Exposure" "node tests/metrics/assert-prom.cjs" || return 1
    
    log "✅ Metrics contract passed"
}

# Security scans (simplified - skip some external tools)
run_security() {
    log "=== Security Scans ==="
    
    run_job "Dependency Audit" "pnpm audit --prod --audit-level=high" || warn "Dependency audit found issues (non-blocking)"
    
    run_job "Static Secret Scan" "node tests/security/secret-scan.cjs" || return 1
    
    log "✅ Security scans completed"
}

# Performance tests
run_performance() {
    log "=== Performance Budgets ==="
    
    run_job "Build Frontend" "pnpm --filter @fitvibe/frontend run build" || return 1
    
    # Start mock server
    log "Starting mock server..."
    node tests/perf/mock-server.mjs > /tmp/mock-server.log 2>&1 &
    MOCK_PID=$!
    
    # Wait for server
    for i in {1..20}; do
        if curl -fsS http://127.0.0.1:4173/health >/dev/null 2>&1; then
            log "Mock server started"
            break
        fi
        if [ $i -eq 20 ]; then
            error "Mock server did not start in time"
            kill $MOCK_PID 2>/dev/null || true
            return 1
        fi
        sleep 3
    done
    
    # Run k6 tests (if k6 is installed)
    if command -v k6 &> /dev/null; then
        export API_BASE_URL="http://127.0.0.1:4173/health"
        run_job "k6 Smoke Test" \
            "k6 run --summary-export=tests/perf/k6-summary.json tests/perf/k6-smoke.js" || {
            kill $MOCK_PID 2>/dev/null || true
            return 1
            }
        
        run_job "Assert k6 Performance Budgets" \
            "node tests/perf/assert-budgets.cjs tests/perf/k6-summary.json" || {
            kill $MOCK_PID 2>/dev/null || true
            return 1
            }
    else
        warn "k6 is not installed, skipping performance tests"
    fi
    
    # Stop mock server
    kill $MOCK_PID 2>/dev/null || true
    pkill -f "mock-server.mjs" || true
    
    log "✅ Performance tests passed"
}

# Accessibility tests
run_accessibility() {
    log "=== Accessibility (axe) ==="
    
    run_job "Build Frontend Bundle" "pnpm --filter @fitvibe/frontend run build" || return 1
    
    run_job "Install Playwright Browsers" "pnpm exec playwright install --with-deps" || return 1
    
    run_job "Run axe Accessibility Suite" "pnpm test:a11y" || return 1
    
    log "✅ Accessibility tests passed"
}

# Visual regression tests
run_visual_regression() {
    log "=== Visual Regression Tests ==="
    
    run_job "Build Frontend" "pnpm --filter @fitvibe/frontend run build" || return 1
    
    run_job "Install Playwright Browsers" "pnpm exec playwright install --with-deps chromium" || return 1
    
    # Start preview server
    log "Starting preview server..."
    cd apps/frontend
    pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort > /tmp/preview-server.log 2>&1 &
    PREVIEW_PID=$!
    cd "$PROJECT_ROOT"
    
    # Wait for server
    for i in {1..30}; do
        if curl -fsS http://127.0.0.1:4173 >/dev/null 2>&1; then
            log "Preview server started"
            break
        fi
        if [ $i -eq 30 ]; then
            error "Preview server did not start in time"
            kill $PREVIEW_PID 2>/dev/null || true
            return 1
        fi
        sleep 1
    done
    
    # Run visual tests
    export APP_URL="http://127.0.0.1:4173"
    export CI="true"
    export DISABLE_WEBSERVER="true"
    run_job "Visual Regression Tests" \
        "pnpm exec playwright test --config tests/frontend/visual/config/playwright.config.ts" || {
        kill $PREVIEW_PID 2>/dev/null || true
        return 1
        }
    
    # Stop preview server
    kill $PREVIEW_PID 2>/dev/null || true
    
    log "✅ Visual regression tests passed"
}

# OpenAPI spec
run_openapi_spec() {
    log "=== Build OpenAPI spec ==="
    
    run_job "Generate OpenAPI JSON" "pnpm -w openapi:build" || return 1
    
    run_job "Validate OpenAPI Schema" \
        "node -e \"JSON.parse(require('fs').readFileSync('apps/backend/openapi/openapi.json', 'utf8'))\"" || return 1
    
    log "✅ OpenAPI spec passed"
}

# Main execution
main() {
    log "Starting local CI workflow execution..."
    
    # Trap to ensure cleanup
    trap 'stop_services; exit' INT TERM EXIT
    
    check_prerequisites
    start_services
    setup_env
    
    # Install dependencies
    log "Installing dependencies..."
    pnpm install --frozen-lockfile --no-offline
    
    # Run jobs in order (matching CI workflow dependencies)
    run_quality || true
    run_backend_tests || true
    run_frontend_tests || true
    run_database_tests || true
    run_coverage || true
    run_lighthouse || true
    run_i18n || true
    run_contract_tests || true
    run_excluded_tests || true
    run_integration_tests || true
    run_metrics_contract || true
    run_security || true
    run_performance || true
    run_accessibility || true
    run_visual_regression || true
    run_openapi_spec || true
    
    # Summary
    echo ""
    log "=== CI Workflow Summary ==="
    
    if [ ${#FAILED_JOBS[@]} -eq 0 ]; then
        log "✅ All quality gates passed!"
        stop_services
        exit 0
    else
        error "❌ The following jobs failed:"
        for job in "${FAILED_JOBS[@]}"; do
            error "  - $job"
        done
        stop_services
        exit 1
    fi
}

# Run main
main
