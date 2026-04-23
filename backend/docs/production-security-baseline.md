# Production Security Baseline

Last updated: April 23, 2026

## Purpose

This document defines the minimum production operating baseline for the live
LEOFF Helper backend on Lightsail. The goal is repeatability, not theory.

## Current baseline

- PostgreSQL is the system of record for accounts, plans, sessions, and
  workspace persistence.
- Runtime secrets are stored in a protected root-owned env file on the server,
  not in raw systemd unit text or checked-in files.
- Auth-sensitive routes are rate limited by client IP for register, login,
  forgot-password, and reset-password flows.
- Production rate limiting uses a shared PostgreSQL-backed bucket store when
  `DATA_BACKEND=postgres` and `RATE_LIMIT_BACKEND=auto`, avoiding per-process
  limiter resets if the service restarts or later runs more than one process.
- Critical auth and account-management actions are written as lightweight audit
  events with hashed request identifiers and hashed email values.
- A production-only `REQUEST_IDENTITY_HASH_SALT` is set in the protected
  runtime env file so audit and rate-limit identifiers are not based on a
  checked-in default.
- Account-backed plan persistence minimizes `workspaceState` and
  `simulationState` before storage by dropping obvious direct identifiers such
  as profile names, spouse names, account numbers, routing numbers, member IDs,
  SSNs, phone numbers, and street-address fields.
- Daily app-managed backups exist and are encrypted at rest with a root-only
  backup key.
- Lightsail automatic snapshots are enabled on a daily schedule.
- HTTPS is in front of the live API at `https://api.leoffhelper.com`.

## Required operating rules

### 1. Secret handling

- Never store production secrets in the repo.
- Never paste production secrets into roadmap files, screenshots, or issue logs.
- Keep the live env file readable only by root.
- Set `REQUEST_IDENTITY_HASH_SALT` to a long random production-only value so
  audit and rate-limit identifiers cannot be casually reversed or compared
  against development logs.
- Rotate secrets immediately after any suspected exposure, including:
  `DATABASE_URL`, `RESEND_API_KEY`, `REQUEST_IDENTITY_HASH_SALT`, backup
  encryption key material, SSH keys, and any future payment provider keys.
- When rotating database credentials, create the new least-privilege role or
  password first, update the protected env file, restart and verify the API,
  then revoke the old credential after successful health and account-flow
  checks.
- When rotating email or payment provider keys, update the provider dashboard
  first, update the protected env file second, restart the service, verify one
  safe non-destructive flow, then revoke the previous key.
- Rotate `RESEND_API_KEY`, database credentials, and any future payment keys if
  they are ever exposed in logs, screenshots, or chat history.

### 2. Deployment handling

- Deploy from `main` only after local verification passes.
- Before restarting the service, confirm the pulled revision is the intended
  commit.
- Before applying schema-affecting backend changes, confirm the latest
  encrypted backup completed and keep the previous backup set until the deploy
  is verified.
- Run schema migrations through the normal backend startup/schema-init path;
  avoid manual production SQL except for documented operational recovery.
- After restart, verify:
  - `systemctl status`
  - recent journal output
  - `curl https://api.leoffhelper.com/health`
- Do not treat a successful restart as a successful deploy until the health
  endpoint and one meaningful app flow both work.
- Roll back by restoring the previous application revision first. Restore a
  database backup only when data corruption or a failed schema migration
  requires it.

### 3. Access control

- Limit SSH access to named maintainers only.
- Reuse one designated deployment user and avoid ad hoc credential sprawl.
- Keep private keys off shared machines and out of the repo.
- Review who has shell access whenever a collaborator changes.
- Keep PostgreSQL bound locally; do not expose it directly to the internet.
- The application database role should have only the privileges required for
  the LEOFF Helper database and schema, not PostgreSQL superuser privileges.
- Use root only for service, env-file, backup-key, and restore-drill operations
  that actually require it.
- Keep backup encryption key access separate from the normal app runtime role.

### 4. Backup handling

- Keep backup directories at `700` and backup files at `600`.
- Keep the backup encryption key separate from the application runtime secrets.
- Do not delete old backup files until at least one restore drill has succeeded
  on the newer backup set.
- Confirm `leoff-api-backup.timer` is enabled after host maintenance,
  service-file changes, and backend deploys that touch storage.
- For every restore drill, use a disposable database or separate restored
  instance first. Do not restore directly into production as the first test.
- After a restore drill, remove decrypted SQL files, temporary database copies,
  temporary API processes, cookie jars, response files, and any copied scripts.
- Record backup timestamp, database restored, row-count validation, API smoke
  checks, cleanup result, and remaining gaps in
  [backup-restore-drill.md](/D:/LEOFF%202/backend/docs/backup-restore-drill.md).

### 5. Audit visibility

- Preserve auth and service logs long enough to review suspicious activity.
- Review failed-login spikes, reset-password spikes, and repeated rate-limit
  hits when user traffic grows.
- If future admin-tier tooling is added, log every entitlement or account-tier
  change with actor, target, and timestamp.
- Review audit events for `auth.login`, `auth.password_reset_request`,
  `auth.password_reset`, `account.password_change`, `account.profile_update`,
  `account.tier_update`, `rate_limit.blocked`, and plan share create/revoke
  actions when investigating suspicious account activity.
- Audit records should not store raw IP addresses or raw email addresses. Use
  hashed identifiers and join back to account records only when there is a
  legitimate support or security reason.
- If traffic grows materially, add retention and review procedures for
  `audit_events` so the table remains useful without becoming unbounded noise.

### 6. Persistence minimization

- Treat account-backed `workspaceState` as restorable planning state, not a
  general personal-data vault.
- Do not add full names, spouse names, full birth dates, SSNs, account numbers,
  routing numbers, member IDs, addresses, or phone numbers to persisted planner
  payloads unless there is a specific product requirement and security review.
- Keep birth information coarse where possible. The current planner only needs
  month/year-level inputs for retirement timing and Social Security modeling.
- Prefer user-facing labels such as `457(b)` or `Brokerage` over real financial
  institution names or account identifiers.
- When adding new module fields, decide whether the field is needed for
  projection math, restore convenience, or neither. Persist only the first two
  categories.

## Minimum post-deploy checklist

1. Pull the intended commit.
2. Confirm the latest encrypted backup exists before deploy if storage code or
   schema changed.
3. Restart the backend service.
4. Confirm the health endpoint responds.
5. Confirm login or another real account flow works.
6. Check recent journal lines for auth, database, rate-limit, audit, and email
   errors.
7. Confirm backups and snapshots are still scheduled and recent.

## Next hardening steps already on the roadmap

- Verify the first successful Lightsail automatic snapshot through AWS
  control-plane access and document the result.
- Add audit-event retention and review procedures once traffic is high enough
  to require regular operational review.
