# ADR-033: Secrets provider contract

- **Status:** Accepted
- **Date:** 2026-09-26
- **Issue:** #265

## Context

FitVibe supports Vault, AWS Secrets Manager, and environment variables. The previous service did not expose one stable application contract: Vault wrapped string writes in an object, AWS stored strings raw but attempted to parse every read as JSON, and the documented environment fallback was not implemented by `getSecret()`.

## Decision

1. `SecretConfig.provider` selects the authoritative external provider. Enabling multiple clients does not create an implicit Vault-to-AWS failover chain.
2. Plain string secrets round-trip as the same string through every retained external provider.
3. Structured secrets are stored as provider-native object data in Vault and JSON text in AWS. An unfielded read returns their JSON representation; a fielded read returns only string-valued fields.
4. Reads fall back to environment variables only when the authoritative provider is unavailable, missing the requested secret, or cannot supply the requested field.
5. Known runtime secrets retain their established environment names (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `DATABASE_URL`). Other secrets may use the deterministic `FITVIBE_SECRET_<KEY>[_<FIELD>]` form, with non-alphanumeric characters normalized to underscores.
6. Writes never fall back to environment variables and never switch providers. Failure to write to the authoritative provider is reported as failure.
7. Secret values must never be logged.

## Consequences

Provider behavior is predictable and can be covered by provider-independent contract tests. Environment fallback remains useful for runtime recovery/configuration without silently copying or mutating secrets. Explicit provider selection prevents an outage or configuration error from reading a different provider unexpectedly.
