# ADR-037: Require Durable Redis/BullMQ Background Work in Production

**Status:** Accepted  
**Date:** 2026-09-27  
**Issue:** #279

## Context

FitVibe has a common background-job interface with an in-memory adapter and a BullMQ/Redis adapter. The in-memory adapter is useful for local development and isolated tests, but queued work and retry state disappear on process restart. Production previously allowed `REDIS_ENABLED=false`, which made that volatile adapter an implicit production option.

The shared job catalogue includes retention cleanup, leaderboard refresh, streak and seasonal-event evaluation, gamification projection reconciliation, audit-outbox flushing, and vibe-level decay.

## Decision

Production requires Redis/BullMQ.

- `REDIS_ENABLED=true` is mandatory in production.
- Production startup fails if the durable adapter is disabled or Redis cannot answer the queue health probe.
- The production Compose contract provides Redis with AOF persistence and a persistent `redis_data` volume.
- All shared job types use the durable adapter in production. No production-critical shared job may silently downgrade to process memory.
- The in-memory queue remains available only for development and test environments.
- Queue health is included in the application health response.
- CI runs a real Redis/BullMQ integration contract covering enqueue/worker processing and retry-to-failure behavior.

## Job classification

All current `SHARED_JOB_TYPES` are routed through the durable production adapter.

- Retention and audit-outbox jobs protect compliance/audit invariants.
- Gamification, streak, seasonal-event, and vibe-decay jobs are derived/reconcilable state, but restart loss would delay correctness and therefore still use the durable adapter.
- Leaderboard refresh is fully derivable but uses the same durable path for operational consistency.

No current production shared job is intentionally lossy.

## Rate limiting

The current deployment is a single backend replica, so the existing process-local generic rate limiter remains acceptable at this stage. Before multiple backend replicas or broader public exposure are introduced, rate-limit state must move to shared infrastructure (Redis or equivalent). This scaling trigger is separate from background-job durability and must not block the current single-node deployment.

## Consequences

- Redis becomes a production startup dependency.
- A Redis outage makes the backend unhealthy/fail-closed instead of silently dropping to memory.
- Queued jobs and retry state survive backend restart/redeploy.
- Operations must back up/monitor the Redis volume and queue health in addition to PostgreSQL and ClamAV.
- Development remains simple because Redis is not mandatory outside production.
