# FitVibe Data Map (GDPR Article 30 Snapshot)

| Domain / Dataset               | Tables & Storage                                                                                | Lawful Basis                                 | Retention / Purge                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Accounts & authentication      | `users`, `auth_sessions`, `refresh_tokens`                                                      | Contractual necessity                        | Active account lifetime; sessions ≤ 120d                            |
| Identity verification          | `auth_tokens` (reset/verify)                                                                    | Legitimate interests / consent               | Auto-purge on expiry (≤ 24h)                                        |
| Profile & preferences          | `user_static`, `user_contacts`, `user_metrics`                                                  | Contractual necessity                        | Lifetime of account; purge on DSR                                   |
| Workout planning & logs        | `plans`, `sessions`, `session_exercises`, `exercise_sets`, `planned/actual_exercise_attributes` | Contractual necessity                        | Lifetime of account; cascade delete on DSR                          |
| Exercise catalog               | `exercises`, `exercise_tags`, media assets                                                      | Contractual necessity / legitimate interests | User-owned data deleted on DSR; global catalog archived             |
| Gamification                   | `user_points`, `badge_catalog`, `badges`                                                        | Legitimate interests                         | Lifetime of account; points partitioned monthly                     |
| Social features                | `feed_items`, `feed_likes`, `feed_comments`, `followers`, `share_links`                         | Consent (public/link scopes)                 | Soft delete supported; purge on DSR                                 |
| Moderation & safety            | `feed_reports`, `user_blocks`, audit log                                                        | Legitimate interests / legal obligation      | Reports retained 180d or until resolved                             |
| Communications & notifications | `notifications` (planned), email provider logs                                                  | Legitimate interests / consent               | Notifications 90d rolling, provider logs 30d                        |
| Security & compliance          | `audit_log`, `idempotency_keys`, `user_tombstones`                                              | Legitimate interests / legal obligation      | Audit log 180d, idempotency keys 24h, tombstones until backup purge |
| Observability                  | Metrics/log pipelines (Prometheus, Loki)                                                        | Legitimate interests                         | Metrics 14d, logs 30d with PII redaction                            |
| Backups                        | Encrypted local database archives (off-host replication not yet configured)                                                              | Legal obligation                             | 14d rolling, purge accelerated for DSR                              |

## Data residency

- Active deployment is a self-hosted Raspberry Pi in Germany, not a cloud region.
- Off-host backup replication is not yet configured; keep backup restore testing as an outstanding control.
- Media assets are stored in a persistent Docker volume, with no cloud replication.

## DSR pipeline

1. User triggers delete/export in-app.
2. `users` row marked `pending_deletion` and scheduled via `purge_scheduled_at`.
3. Retention job (`pnpm retention:run`) processes due deletions, dropping linked
   sessions, exercises, media, follower edges, and anonymising audit trails.
4. `user_tombstones` record is created for compliance evidence until backups are
   purged.
5. Backups older than 14 days are removed automatically; ad-hoc purge tickets
   track accelerated deletion if needed.

See [docs\2c.Technical_Design_Document_Data.md](/docs/2c.Technical_Design_Document_Data.md) §6.8 for detailed table
retention requirements.
