# ADR-033: Secrets provider contract

- **Status:** Accepted (amended 2026-11-02)
- **Date:** 2026-09-26
- **Issue:** #265

## Context

FitVibe's active private deployment uses local environment variables and mounted key files. HashiCorp Vault is optional. The previously retained AWS Secrets Manager adapter was not selected by application startup and added an unnecessary startup dependency on a cloud SDK. The cloud adapter and its associated runtime package have been retired.

## Decision

1. `SecretConfig.provider` supports `"vault"` and `"env"` only. Unsupported providers are rejected explicitly.
2. Vault is the only optional external secrets provider. Vault stores structured object values and wraps string writes as `{ value }`; reads return the stored string or structured JSON.
3. A Vault read can fall back to environment variables if the requested secret or field is missing or Vault is unavailable.
4. Known runtime secrets use `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, and `DATABASE_URL`. Generic secrets may use normalized `FITVIBE_SECRET_<KEY>[_<FIELD>]` variables.
5. Writes must not silently switch providers or write to environment variables. Environment-only mode is read-only. A failed Vault write returns failure.
6. Secret values must never be logged. Startup must not require a remote secrets service or its SDK when Vault is disabled.
7. Production JWT signing keys must be persistent: use protected environment configuration or mounted key files. Changing the secrets provider does not replace backup, rotation, or access-control obligations.

## Consequences

The runtime has no AWS cloud service dependency. Local Docker Compose and private deployments operate from environment variables and mounted files, while an explicitly selected Vault deployment can still read and write secrets. Unselected cloud-provider clients cannot break backend startup.
