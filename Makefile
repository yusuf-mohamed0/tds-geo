# ──────────────────────────────────────────────────────────
# TDS Geo — DevOps Makefile
# Bottom-to-top: DB → Backend → Frontend → Infra → Deploy
# ──────────────────────────────────────────────────────────

SHELL := /bin/bash
.PHONY: help install dev test lint typecheck build db-%

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Layer 1: Database ───────────────────────────────────
db-migrate: ## Apply all database migrations
	@echo "=== Database: Applying schema ==="
	psql $(DATABASE_URL) -f backend/database/schema.sql -q
	@echo "=== Database: Applying migrations ==="
	@for f in backend/database/migration_*.sql; do \
		echo "  $$f"; \
		psql $(DATABASE_URL) -f "$$f" -q; \
	done
	@echo "✅ Database migrated"

db-seed: ## Load seed data (development only)
	psql $(DATABASE_URL) -f backend/database/seed.sql -q
	@echo "✅ Database seeded"

db-backup: ## Backup database to /tmp
	@mkdir -p /tmp/tdsgeo-backups
	pg_dump $(DATABASE_URL) -F c -f /tmp/tdsgeo-backups/tdsgeo-$$(date +%Y%m%d-%H%M%S).dump
	@echo "✅ Backup created"

db-restore: ## Restore database from file: make db-restore FILE=/path/to/dump.dump
	pg_restore $(DATABASE_URL) --clean --if-exists -F c $(FILE)
	@echo "✅ Database restored from $(FILE)"

db-reset: ## Drop, recreate, migrate, seed (dev only)
	dropdb $(DATABASE_URL) --if-exists 2>/dev/null; createdb $(DATABASE_URL)
	$(MAKE) db-migrate db-seed
	@echo "✅ Database reset complete"

db-shell: ## Open psql shell
	psql $(DATABASE_URL)

db-health: ## Check database connectivity
	@pg_isready -d $(DATABASE_URL) && echo "✅ Database healthy" || echo "❌ Database not reachable"

# ─── Layer 2: Backend ───────────────────────────────────
install: ## Install all dependencies
	npm ci
	cd frontend && npm ci

dev: ## Start development server with hot reload
	npx tsx watch backend/index.ts

build: ## Build backend TypeScript
	npx tsc
	@echo "✅ Backend built"

build-frontend: ## Build frontend SPA
	cd frontend && npm run build
	@echo "✅ Frontend built"

build-all: build build-frontend ## Build everything

start: ## Start production server (requires build)
	node dist/backend/index.js

worker: ## Start background worker
	npx tsx backend/workers/index.ts

# ─── Layer 3: Frontend ──────────────────────────────────
frontend-dev: ## Start frontend dev server
	cd frontend && npm run dev

frontend-build: build-frontend ## Alias

# ─── Layer 4: Quality Gates ────────────────────────────
typecheck: ## TypeScript type check
	npx tsc --noEmit

lint: ## ESLint
	npx eslint backend/ --ext .ts

test: ## Run all tests
	npx vitest run --reporter=verbose

test-watch: ## Run tests in watch mode
	npx vitest

test-e2e: ## Run E2E tests
	npx vitest run --config vitest.e2e.config.ts

test-all: test test-e2e ## Run all tests

security-audit: ## npm audit (high severity only)
	npm audit --audit-level=high

quality: typecheck lint test security-audit ## Full quality gate suite

# ─── Layer 5: Infrastructure ────────────────────────────
docker-build: ## Build Docker images
	docker compose build

docker-up: ## Start all services (development)
	docker compose up -d

docker-down: ## Stop all services
	docker compose down

docker-logs: ## Tail logs
	docker compose logs -f

docker-ps: ## List running services
	docker compose ps

docker-staging: ## Start staging environment
	docker compose -f docker-compose.yml -f docker/staging/docker-compose.override.yml up -d

docker-production: ## Start production environment
	docker compose -f docker-compose.yml -f docker/production/docker-compose.override.yml up -d

docker-clean: ## Remove all stopped containers and unused images
	docker compose down -v 2>/dev/null; docker system prune -f

# ─── Layer 6: Deployment ────────────────────────────────
smoke-test: ## Run smoke tests against local or specified URL
	./scripts/smoke-test.sh

rollback: ## Rollback to previous Docker image
	./scripts/rollback.sh

deploy-local: ## Build and deploy locally
	$(MAKE) build-all
	docker compose up -d --build --no-deps api worker nginx
	$(MAKE) smoke-test

# ─── Layer 7: Monitoring ────────────────────────────────
health: ## Check system health (API, DB, Redis, Services)
	@echo "=== System Health ==="
	@curl -sf http://localhost:3000/health | python3 -m json.tool 2>/dev/null || echo "❌ API health endpoint unreachable"
	@echo "---"
	@echo "Health dashboard: http://localhost:80/health.html (if docker up)"
	@echo "Grafana:          http://localhost:3001 (if production docker up)"
	@echo "Prometheus:       http://localhost:9090 (if production docker up)"

logs: ## Tail logs from all docker services
	docker compose logs -f --tail=100

metrics: ## View Prometheus metrics
	@curl -sf http://localhost:3000/metrics 2>/dev/null | head -30 || echo "Metrics endpoint: http://localhost:3000/metrics"

# ─── Layer 8: Utility ──────────────────────────────────
clean: ## Clean build artifacts
	rm -rf dist/
	rm -rf frontend/dist/
	@echo "✅ Cleaned"

env-check: ## Verify required environment variables
	@echo "=== Environment Check ==="
	@for var in DATABASE_URL JWT_SECRET; do \
		if [ -z "${${var}}" ]; then \
			echo "  ❌ $$var is not set"; \
		else \
			echo "  ✅ $$var is set"; \
		fi; \
	done

setup: install db-migrate build ## Full local setup (install, migrate, build)

ci: quality build docker-build ## CI pipeline (quality + build)

all: quality test-all build-all docker-build ## Full pipeline
