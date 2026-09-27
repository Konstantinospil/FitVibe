# ADR-038: Superadmin privilege and sudo model

- Status: Accepted
- Date: 2026-09-27
- Related: #301, #304

## Context

FitVibe requires a distinction between normal administration and privileged system administration. Normal admins must not be able to change governed system settings or privileged roles. Privileged operations must be auditable and require explicit reauthentication.

## Decision

### Roles

- `admin` retains ordinary administration/moderation authority.
- `superadmin` inherits all `admin` capabilities and adds privileged authority.
- Role inheritance is one-way: admin never satisfies a superadmin requirement.

### Sudo

- Privileged operations require password reauthentication.
- A successful sudo grant is scoped to the authenticated session.
- A grant lasts five minutes.
- Sudo grants are persisted and revocable.
- Sudo does not replace the final authenticator approval.

### Fresh TOTP

- Every committed privileged role change requires a fresh authenticator-app TOTP.
- Backup/recovery codes are not valid for privileged commits.
- Privileged TOTP codes are consumed once during their validity window to prevent one code authorizing multiple changes.

### Role changes

Promotion from admin to superadmin requires:
- active account;
- verified authenticator TOTP;
- active sudo grant for the acting superadmin;
- fresh TOTP from the acting superadmin;
- non-blank justification.

Demotion requires the same acting-superadmin controls. The final remaining superadmin cannot be demoted.

Every successful role change revokes the target user's existing sessions and refresh tokens so authorization is re-evaluated immediately.

A superadmin cannot disable 2FA while retaining the superadmin role.

### Initial bootstrap

The first superadmin is created with a local server CLI only when no superadmin exists.

The target must already be:
- an active admin;
- configured with verified authenticator TOTP.

Bootstrap requires a non-blank justification, writes an audit record, changes the role atomically, and revokes existing sessions. Once any superadmin exists, the bootstrap command refuses to run. Subsequent promotions/demotions occur only through the privileged application workflow.

The bootstrap command does not accept a TOTP secret or recovery code.

## Consequences

- Privileged authorization has a separate lifecycle from ordinary login.
- Role changes invalidate current sessions by design.
- The bootstrap mechanism is not a permanent alternate privilege-escalation path.
- #303 may depend on this sudo/TOTP mechanism for governed application-setting commits.
