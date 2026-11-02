# JWT Key Rotation Runbook

**Version:** 1.0
**Last Updated:** 2025-11-11
**Owner:** Security & DevOps Team
**Frequency:** Quarterly (every 90 days)

This runbook provides step-by-step procedures for rotating JWT signing keys in FitVibe production and staging environments.

---

## Table of Contents

- [Overview](#overview)
- [Pre-Rotation Checklist](#pre-rotation-checklist)
- [Rotation Procedure](#rotation-procedure)
- [Verification](#verification)
- [Rollback Procedure](#rollback-procedure)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

FitVibe uses RS256 (RSA asymmetric) JWT tokens for authentication. Per ADR-002 and security best practices, signing keys must be rotated quarterly to:

1. Limit the blast radius of key compromise
2. Comply with GDPR and security standards
3. Maintain crypto-agility

### Key Concepts

- **Access Token:** Short-lived (15 min), signed with current private key
- **Refresh Token:** Long-lived (14 days), stored hashed in database
- **Key Rotation Window:** 24-hour overlap period where both old and new keys are valid
- **JWKS Endpoint:** `/.well-known/jwks.json` publishes current public keys with `kid` (Key ID)

### Rotation Policy

- **Schedule:** Every 90 days
- **Alert Window:** 14 days before due date (warning), immediate at 105 days (critical)
- **Overlap Period:** 24 hours (both keys valid during transition)
- **Process:** Blue-green key deployment with zero downtime

---

## Pre-Rotation Checklist

### 1. Schedule and Notification

- [ ] Schedule rotation during low-traffic window (e.g., 2 AM UTC on a Wednesday)
- [ ] Notify engineering team 48 hours in advance via #eng-announcements
- [ ] Create maintenance ticket in JIRA/Linear
- [ ] Verify on-call engineer availability

### 2. Environment Preparation

- [ ] Verify current key age:

  ```bash
  # SSH to production server
  stat -c %Y /app/keys/jwt_rs256.key
  # Calculate age: (current_time - creation_time) / 86400 = days
  ```

- [ ] Check monitoring dashboard for baseline metrics:
  - Current request rate
  - Auth endpoint latency
  - Active user sessions

- [ ] Confirm staging environment is healthy and ready for testing

- [ ] Backup current keys:
  ```bash
  cp /app/keys/jwt_rs256.key /app/keys/backup/jwt_private_$(date +%Y%m%d).pem
  cp /app/keys/jwt_rs256.pub /app/keys/backup/jwt_public_$(date +%Y%m%d).pem
  ```

### 3. Access Verification

- [ ] Verify SSH access to production servers
- [ ] Verify access to mounted signing-key files or optional Vault
- [ ] Verify deployment permissions (CI/CD, K8s, etc.)

---

## Rotation Procedure

### Phase 1: Generate New Key Pair (Staging)

1. **Generate new RSA-4096 key pair:**

   ```bash
   # On secure workstation (not production server)
   openssl genrsa -out jwt_rs256_new.key 4096
   openssl rsa -in jwt_rs256_new.key -pubout -out jwt_rs256_new.pub

   # Verify key integrity
   openssl rsa -in jwt_rs256_new.key -check -noout
   # Expected output: RSA key ok
   ```

2. **Assign Key ID (kid):**

   ```bash
   # Generate unique kid (timestamp-based)
   export NEW_KID="key-$(date +%Y%m%d-%H%M%S)"
   echo $NEW_KID > jwt_kid_new.txt
   ```

3. **Store in Secrets Manager:**

   **Vault:**

   ```bash
   vault kv put secret/fitvibe/staging/jwt \
     private_key=@jwt_rs256_new.key \
     public_key=@jwt_rs256_new.pub \
     kid="$NEW_KID"
   ```

   **Self-hosted Docker deployment:** Keep the new private key in a restricted
   local key directory, with permissions suitable for the backend runtime.
   Do not upload a signing private key to an unconfigured cloud service.

4. **Deploy to staging:**

   ```bash
   # Update environment variables
   export JWT_PRIVATE_KEY_PATH=/app/keys/jwt_rs256_new.key
   export JWT_PUBLIC_KEY_PATH=/app/keys/jwt_rs256_new.pub
   export JWT_KEY_ID=$NEW_KID

   # Restart backend service
   kubectl rollout restart deployment/fitvibe-backend -n staging
   # OR for Docker Compose:
   docker-compose -f docker-compose.staging.yml restart backend
   ```

### Phase 2: Test in Staging

1. **Verify JWKS endpoint:**

   ```bash
   curl https://staging.fitvibe.app/.well-known/jwks.json | jq
   ```

   Expected output:

   ```json
   {
     "keys": [
       {
         "kty": "RSA",
         "kid": "key-20251111-020000",
         "use": "sig",
         "alg": "RS256",
         "n": "...",
         "e": "AQAB"
       }
     ]
   }
   ```

2. **Test authentication flow:**

   ```bash
   # Register new user
   curl -X POST https://staging.fitvibe.app/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "rotation-test@example.com",
       "username": "rotation-test",
       "password": "TestPassword123!@#"
     }'

   # Login and capture tokens
   curl -X POST https://staging.fitvibe.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "rotation-test@example.com",
       "password": "TestPassword123!@#"
     }' | jq -r '.accessToken' > access_token.txt

   # Verify token signature
   jwt decode $(cat access_token.txt)
   # Check "kid" field matches $NEW_KID
   ```

3. **Load test (optional but recommended):**

   ```bash
   k6 run tests/performance/auth-load-test.js --vus 10 --duration 2m
   ```

4. **Staging smoke test checklist:**
   - [ ] User can register
   - [ ] User can login
   - [ ] User can refresh token
   - [ ] User can access protected endpoints
   - [ ] Token signature validates correctly
   - [ ] JWKS endpoint returns new key ID

### Phase 3: Production Deployment (Blue-Green)

**During this phase, BOTH old and new keys are valid for 24 hours.**

1. **Deploy new key alongside old key:**

   ```bash
   # Store new key in secrets manager
   vault kv put secret/fitvibe/production/jwt-new \
     private_key=@jwt_rs256_new.key \
     public_key=@jwt_rs256_new.pub \
     kid="$NEW_KID"

   # Update application config to load BOTH keys
   # The application should publish both public keys in JWKS
   # but sign NEW tokens with the NEW key
   ```

2. **Update backend configuration:**

   Edit backend environment config to use new key for signing:

   ```bash
   export JWT_PRIVATE_KEY_PATH=/app/keys/jwt_rs256_new.key
   export JWT_PUBLIC_KEY_PATH=/app/keys/jwt_rs256_new.pub
   export JWT_KEY_ID=$NEW_KID

   # Keep old public key available for validation
   export JWT_PUBLIC_KEY_OLD_PATH=/app/keys/jwt_rs256.pub
   export JWT_KEY_ID_OLD="key-20250811-020000"  # Previous kid
   ```

3. **Rolling deployment:**

   **Kubernetes:**

   ```bash
   # Update deployment with new secret references
   kubectl set env deployment/fitvibe-backend \
     JWT_KEY_ID=$NEW_KID \
     -n production

   # Rolling restart (zero-downtime)
   kubectl rollout restart deployment/fitvibe-backend -n production
   kubectl rollout status deployment/fitvibe-backend -n production
   ```

   **Docker Swarm:**

   ```bash
   docker service update \
     --env-add JWT_KEY_ID=$NEW_KID \
     fitvibe_backend

   # Monitor rollout
   docker service ps fitvibe_backend
   ```

4. **Monitor during rollout:**

   Watch these metrics in Grafana:
   - `http_requests_total{route="/api/v1/auth/*", status_code="401"}` (should not spike)
   - `http_request_duration_seconds{route="/api/v1/auth/login"}` (should remain stable)
   - Error logs for "invalid signature" or "unknown kid"

### Phase 4: Grace Period (24 hours)

During the 24-hour overlap:

- New tokens are signed with NEW key (kid = $NEW_KID)
- Old tokens signed with OLD key are still accepted
- JWKS endpoint exposes BOTH public keys

**Monitor:**

1. **Check token distribution:**

   ```bash
   # Query backend metrics (if instrumented)
   curl -s http://localhost:4000/metrics | grep jwt_tokens_validated_total
   ```

2. **Watch for errors:**

   ```bash
   # Tail logs for JWT errors
   kubectl logs -f deployment/fitvibe-backend -n production | grep -i "jwt\|signature"
   ```

3. **User session analysis:**

   ```sql
   -- Count active sessions by key ID
   SELECT
     substring(access_token FROM 'kid.*?(key-[0-9-]+)') AS kid,
     COUNT(*) AS session_count
   FROM user_sessions
   WHERE expires_at > NOW()
   GROUP BY kid;
   ```

### Phase 5: Remove Old Key (After 24 Hours)

1. **Verify all active sessions use new key:**

   ```sql
   -- Ensure no sessions rely on old key
   SELECT COUNT(*)
   FROM user_sessions
   WHERE expires_at > NOW()
     AND access_token LIKE '%"kid":"key-20250811%';
   -- Expected: 0
   ```

2. **Remove old key from JWKS:**

   ```bash
   # Update backend config to remove old public key
   unset JWT_PUBLIC_KEY_OLD_PATH
   unset JWT_KEY_ID_OLD

   # Restart backend
   kubectl rollout restart deployment/fitvibe-backend -n production
   ```

3. **Archive old key (do NOT delete):**

   Archive superseded key material in a separate encrypted, access-restricted
   offline backup, following the applicable retention policy. Verify that all
   relevant tokens have expired before retiring a key. If Vault is used,
   follow its separately approved secret-version retention process; do not
   delete versions automatically in this generic procedure.

---

## Verification

### Post-Rotation Checks

1. **Verify JWKS endpoint:**

   ```bash
   curl https://api.fitvibe.app/.well-known/jwks.json | jq '.keys | length'
   # Expected: 1 (after grace period)
   ```

2. **End-to-end authentication test:**

   ```bash
   # Automated E2E test
   npm run test:e2e -- --grep "authentication flow"
   ```

3. **Check monitoring dashboards:**
   - [ ] No spike in 401 errors
   - [ ] Auth endpoint latency within SLO (< 200ms p95)
   - [ ] No alerts firing
   - [ ] Session creation rate normal

4. **Verify key age metric:**

   ```bash
   curl -s http://localhost:4000/metrics | grep jwt_key_created_timestamp
   # Should show current timestamp (within last 24 hours)
   ```

---

## Rollback Procedure

If issues arise during rotation (e.g., spike in 401s, users unable to login):

### Immediate Rollback (< 1 hour into rotation)

1. **Revert to old key:**

   ```bash
   kubectl set env deployment/fitvibe-backend \
     JWT_PRIVATE_KEY_PATH=/app/keys/jwt_rs256.key \
     JWT_PUBLIC_KEY_PATH=/app/keys/jwt_rs256.pub \
     JWT_KEY_ID="key-20250811-020000" \
     -n production

   kubectl rollout restart deployment/fitvibe-backend -n production
   ```

2. **Verify rollback:**

   ```bash
   curl https://api.fitvibe.app/.well-known/jwks.json | jq -r '.keys[0].kid'
   # Should show old key ID
   ```

3. **Communicate incident:**
   - Post in #engineering and #incidents channels
   - Update status page if user-facing impact
   - Schedule post-mortem

### Partial Rollback (During Grace Period)

If issues surface during the 24-hour grace period:

1. **Extend grace period:**
   - Keep both keys active for additional 24-48 hours
   - Monitor user sessions and error rates

2. **Force re-authentication:**
   - If necessary, invalidate all sessions and require re-login:
     ```sql
     UPDATE user_sessions SET expires_at = NOW() WHERE expires_at > NOW();
     ```

---

## Monitoring

### Dashboards

- **SLO Dashboard:** `/grafana/d/slo-overview`
  - Track availability and latency during rotation

- **Auth Metrics Dashboard:** `/grafana/d/auth-metrics`
  - Monitor login success rate, token issuance, refresh operations

- **Alerting Dashboard:** `/grafana/d/alerts`
  - Watch for JWT-related alerts

### Alerts

Pre-configured alerts (see `infra/observability/alert-rules.yml`):

- `JWTKeyRotationDue` (warning at 90 days)
- `JWTKeyRotationOverdue` (critical at 105 days)
- `HighErrorRate` (5xx errors > 0.5%)
- `AuthBruteForceSpike` (failed login spike)

### Metrics to Watch

```promql
# 401 Unauthorized rate (should not spike)
rate(http_requests_total{status_code="401"}[5m])

# Token validation errors (custom metric - needs instrumentation)
rate(jwt_validation_errors_total[5m])

# Active sessions by key ID (custom metric - needs instrumentation)
jwt_active_sessions_by_kid

# Auth endpoint latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{route="/api/v1/auth/login"}[5m]))
```

---

## Troubleshooting

### Issue: Users getting 401 errors after rotation

**Symptoms:**

- Spike in 401 responses
- Users reporting "session expired" or "unauthorized"

**Diagnosis:**

```bash
# Check if old tokens are being rejected
kubectl logs deployment/fitvibe-backend -n production | grep "unknown kid\|signature verification failed"

# Verify JWKS endpoint has both keys during grace period
curl https://api.fitvibe.app/.well-known/jwks.json | jq '.keys | length'
# Expected: 2 (during grace period), 1 (after)
```

**Resolution:**

1. If in grace period and old key missing: Re-add old public key to JWKS
2. If after grace period: Extend grace period by 24 hours
3. If persistent: Rollback to old key (see Rollback Procedure)

### Issue: JWKS endpoint not updating

**Symptoms:**

- New key ID not appearing in `/.well-known/jwks.json`
- Frontend still using old tokens

**Diagnosis:**

```bash
# Check backend logs for JWKS generation errors
kubectl logs deployment/fitvibe-backend -n production | grep -i jwks

# Verify environment variables
kubectl exec deployment/fitvibe-backend -n production -- env | grep JWT
```

**Resolution:**

1. Restart backend pods to reload JWKS
2. Clear CDN cache if using caching proxy
3. Verify public key file permissions (must be readable by app user)

### Issue: Key file not found

**Symptoms:**

- Backend fails to start
- Error: `ENOENT: no such file or directory, open '/app/keys/jwt_rs256_new.key'`

**Diagnosis:**

```bash
# Check if secret is mounted
kubectl describe pod <backend-pod> -n production | grep -A 10 Mounts
```

**Resolution:**

1. Verify secret exists in secrets manager
2. Ensure Kubernetes secret/configmap is created and referenced in deployment
3. Check file path in environment variable matches actual mount path

### Issue: Performance degradation after rotation

**Symptoms:**

- Auth endpoint latency increased
- Slower token validation

**Diagnosis:**

- RSA-4096 verification is compute-intensive; ensure adequate CPU allocation

**Resolution:**

1. Check CPU usage: `kubectl top pods -n production`
2. Scale horizontally if needed: `kubectl scale deployment/fitvibe-backend --replicas=6 -n production`
3. Consider implementing token caching (with TTL = token expiry)

---

## Appendix

### A. Key Generation Script

See `infra/scripts/generate-jwt-keys.sh`:

```bash
#!/bin/bash
set -euo pipefail

KID="key-$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${1:-.}"

echo "Generating RSA-4096 key pair with kid=$KID..."
openssl genrsa -out "$OUTPUT_DIR/jwt_rs256.key" 4096
openssl rsa -in "$OUTPUT_DIR/jwt_rs256.key" -pubout -out "$OUTPUT_DIR/jwt_rs256.pub"

echo "Verifying key integrity..."
openssl rsa -in "$OUTPUT_DIR/jwt_rs256.key" -check -noout

echo "$KID" > "$OUTPUT_DIR/jwt_kid.txt"
echo "Keys generated successfully:"
echo "  Private: $OUTPUT_DIR/jwt_rs256.key"
echo "  Public:  $OUTPUT_DIR/jwt_rs256.pub"
echo "  Key ID:  $KID"
```

### B. Rotation Schedule

| Quarter | Rotation Window | Alert Start | Critical Alert |
| ------- | --------------- | ----------- | -------------- |
| Q1      | Jan 15 - Jan 22 | Jan 1       | Jan 30         |
| Q2      | Apr 15 - Apr 22 | Apr 1       | Apr 30         |
| Q3      | Jul 15 - Jul 22 | Jul 1       | Jul 30         |
| Q4      | Oct 15 - Oct 22 | Oct 1       | Oct 30         |

### C. Contact Information

- **Primary:** DevOps On-Call (PagerDuty)
- **Secondary:** Security Team (#security-team Slack)
- **Escalation:** CTO / Engineering Lead

### D. References

- [ADR-002: Authentication Token Strategy](../docs/6.%20adr/ADR-002-authentication-token-strategy.md)
- [RFC 7517: JSON Web Key (JWK)](https://datatracker.ietf.org/doc/html/rfc7517)
- [RFC 7519: JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [NIST SP 800-57: Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
