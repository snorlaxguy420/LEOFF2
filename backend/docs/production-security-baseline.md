# Production Security Baseline

Last updated: April 17, 2026

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
- Daily app-managed backups exist and are encrypted at rest with a root-only
  backup key.
- Lightsail automatic snapshots are enabled on a daily schedule.
- HTTPS is in front of the live API at `https://api.leoffhelper.com`.

## Required operating rules

### 1. Secret handling

- Never store production secrets in the repo.
- Never paste production secrets into roadmap files, screenshots, or issue logs.
- Keep the live env file readable only by root.
- Rotate `RESEND_API_KEY`, database credentials, and any future payment keys if
  they are ever exposed in logs, screenshots, or chat history.

### 2. Deployment handling

- Deploy from `main` only after local verification passes.
- Before restarting the service, confirm the pulled revision is the intended
  commit.
- After restart, verify:
  - `systemctl status`
  - recent journal output
  - `curl https://api.leoffhelper.com/health`
- Do not treat a successful restart as a successful deploy until the health
  endpoint and one meaningful app flow both work.

### 3. Access control

- Limit SSH access to named maintainers only.
- Reuse one designated deployment user and avoid ad hoc credential sprawl.
- Keep private keys off shared machines and out of the repo.
- Review who has shell access whenever a collaborator changes.

### 4. Backup handling

- Keep backup directories at `700` and backup files at `600`.
- Keep the backup encryption key separate from the application runtime secrets.
- Do not delete old backup files until at least one restore drill has succeeded
  on the newer backup set.

### 5. Audit visibility

- Preserve auth and service logs long enough to review suspicious activity.
- Review failed-login spikes, reset-password spikes, and repeated rate-limit
  hits when user traffic grows.
- If future admin-tier tooling is added, log every entitlement or account-tier
  change with actor, target, and timestamp.

## Minimum post-deploy checklist

1. Pull the intended commit.
2. Restart the backend service.
3. Confirm the health endpoint responds.
4. Confirm login or another real account flow works.
5. Check recent journal lines for auth, database, and email errors.
6. Confirm backups and snapshots are still scheduled and recent.

## Next hardening steps already on the roadmap

- Prove restore readiness with a documented backup/snapshot restore drill.
- Minimize what gets persisted in `workspaceState`.
- Replace the in-memory rate limiter if the backend scales beyond one instance.
- Add lightweight audit visibility for critical auth and account actions.
