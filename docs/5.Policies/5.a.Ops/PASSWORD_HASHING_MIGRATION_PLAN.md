# Password Hashing Migration Plan: bcrypt → Argon2id

**Status**: **Approved target; implementation pending verification**  
**Priority**: Medium  
**Estimated Effort**: 2-3 weeks  
**Risk Level**: Medium (requires careful migration strategy)

---

## Executive Summary

This document outlines the migration plan from bcrypt to Argon2id password hashing as specified in `PASSWORD_AND_AUTHENTICATION_POLICY.md`. The migration must be performed without disrupting existing users or requiring mass password resets.

---

## Current State

- **Algorithm**: bcrypt with 12 salt rounds
- **Security**: ✅ Secure (bcrypt is still considered secure)
- **Policy Requirement**: Argon2id with memory ≥64 MiB, iterations ≥3, parallelism ≥1
- **Reason for Migration**: Policy compliance and improved resistance to GPU/ASIC attacks

---

## Migration Strategy

### Phase 1: Dual Support (2-4 weeks)

1. **Install Argon2id Library**

   ```bash
   pnpm add argon2
   pnpm add -D @types/argon2
   ```

2. **Create Password Hashing Service**
   - Support both bcrypt and Argon2id
   - Detect hash format on verification
   - Use Argon2id for new passwords
   - Support bcrypt for existing passwords

3. **Update All Password Hashing Locations**
   - `apps/backend/src/modules/auth/auth.service.ts` (registration, password reset)
   - `apps/backend/src/modules/users/users.service.ts` (password change, admin user creation)

### Phase 2: Gradual Migration (3-6 months)

1. **On Successful Login**
   - Verify password with existing hash (bcrypt or Argon2id)
   - If verified with bcrypt, re-hash with Argon2id
   - Update database with new hash
   - Log migration event

2. **On Password Reset**
   - Always use Argon2id for new password

3. **On Password Change**
   - Always use Argon2id for new password

### Phase 3: Cleanup (After 6 months)

1. **Identify Remaining bcrypt Hashes**
   - Query users with bcrypt hashes
   - Send reminder emails to users who haven't logged in
   - Force password reset for inactive accounts

2. **Remove bcrypt Support**
   - Remove bcrypt dependency
   - Remove bcrypt verification code
   - Update documentation

---

## Implementation Details

### Hash Format Detection

```typescript
function detectHashAlgorithm(hash: string): "bcrypt" | "argon2id" {
  // bcrypt hashes start with $2a$, $2b$, or $2y$
  if (hash.startsWith("$2")) {
    return "bcrypt";
  }
  // Argon2id hashes start with $argon2id$
  if (hash.startsWith("$argon2id$")) {
    return "argon2id";
  }
  throw new Error("Unknown hash format");
}
```

### Password Verification with Auto-Migration

```typescript
async function verifyPassword(password: string, hash: string, userId: string): Promise<boolean> {
  const algorithm = detectHashAlgorithm(hash);

  let isValid: boolean;
  if (algorithm === "bcrypt") {
    isValid = await bcrypt.compare(password, hash);

    // Auto-migrate on successful verification
    if (isValid) {
      const newHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MiB
        timeCost: 3,
        parallelism: 1,
      });

      await updatePasswordHash(userId, newHash);
      await logPasswordMigration(userId, "bcrypt", "argon2id");
    }
  } else {
    isValid = await argon2.verify(hash, password);
  }

  return isValid;
}
```

### Database Migration

Add migration to track hash algorithm:

```typescript
// Migration: add password_hash_algorithm column
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.enum("password_hash_algorithm", ["bcrypt", "argon2id"]).defaultTo("bcrypt").notNullable();
  });

  // Set existing users to bcrypt
  await knex("users").update({ password_hash_algorithm: "bcrypt" });
}
```

---

## Testing Strategy

1. **Unit Tests**
   - Test hash format detection
   - Test password verification with both algorithms
   - Test auto-migration on login
   - Test new password hashing uses Argon2id

2. **Integration Tests**
   - Test login with bcrypt hash (should migrate)
   - Test login with Argon2id hash (should not migrate)
   - Test password reset uses Argon2id
   - Test password change uses Argon2id

3. **Performance Tests**
   - Verify Argon2id performance is acceptable
   - Test concurrent login performance
   - Monitor migration impact on login times

---

## Rollback Plan

If issues arise:

1. **Immediate Rollback**
   - Revert code changes
   - All existing bcrypt hashes still work
   - No user impact

2. **Partial Rollback**
   - Disable auto-migration
   - Continue supporting both algorithms
   - Investigate issues

---

## Monitoring

1. **Metrics to Track**
   - Number of bcrypt hashes remaining
   - Migration success rate
   - Login performance impact
   - Error rates during migration

2. **Alerts**
   - High migration failure rate
   - Performance degradation
   - Unusual error patterns

---

## Timeline

- **Week 1-2**: Implementation and testing
- **Week 3**: Staged rollout (10% → 50% → 100%)
- **Month 2-6**: Gradual migration as users log in
- **Month 6+**: Cleanup and force migration for inactive users

---

## Risk Assessment

| Risk               | Likelihood | Impact   | Mitigation                              |
| ------------------ | ---------- | -------- | --------------------------------------- |
| Migration bugs     | Low        | High     | Thorough testing, staged rollout        |
| Performance impact | Medium     | Medium   | Monitor, adjust Argon2id parameters     |
| User disruption    | Low        | High     | Transparent migration, no forced resets |
| Data loss          | Very Low   | Critical | Backup strategy, rollback plan          |

---

## Success Criteria

- ✅ All new passwords use Argon2id
- ✅ 95%+ of active users migrated within 6 months
- ✅ No increase in login failures
- ✅ No performance degradation
- ✅ All tests passing

---

## References

- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- `PASSWORD_AND_AUTHENTICATION_POLICY.md` - Policy requirements

---

**Last Updated**: 2025-12-18  
**Owner**: Security Team  
**Status**: Approved target - implementation state to be verified against live `dev`
