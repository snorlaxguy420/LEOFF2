# LEOFF Helper Backend

Initial backend scaffold for:
- user registration/login
- session-based authentication
- account-tier / entitlement exposure for premium-ready features
- saved plan CRUD around the canonical `simulationState`
- out-of-session password recovery via reset links
- transactional account emails for registration and password recovery
- user-configurable retirement check-in emails

This first version still defaults to a local JSON file so the API contract can
stabilize before a database cutover, but it now includes PostgreSQL migration
groundwork for the next persistence step.

## Run locally

```powershell
cd backend
node .\src\server.js
```

Default local URL:

```text
http://127.0.0.1:8787
```

## Environment

Copy `.env.example` values into your real environment as needed. The current
server reads:

- `PORT`
- `HOST`
- `CORS_ORIGINS`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_MINUTES`
- `PASSWORD_RESET_TTL_MINUTES`
- `PUBLIC_SITE_URL`
- `SUPPORT_EMAIL`
- `SIGNUP_SUMMARY_RECIPIENT`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `DATA_BACKEND`
- `DATABASE_URL`
- `DATABASE_SSL`
- `REGISTER_RATE_LIMIT_MAX`
- `REGISTER_RATE_LIMIT_WINDOW_MINUTES`
- `LOGIN_RATE_LIMIT_MAX`
- `LOGIN_RATE_LIMIT_WINDOW_MINUTES`
- `FORGOT_PASSWORD_RATE_LIMIT_MAX`
- `FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MINUTES`
- `RESET_PASSWORD_RATE_LIMIT_MAX`
- `RESET_PASSWORD_RATE_LIMIT_WINDOW_MINUTES`
- `DATA_FILE_PATH`

## Current endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/change-password`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /me`
- `PATCH /me`
- `GET /plans`
- `POST /plans`
- `GET /plans/:id`
- `PUT /plans/:id`
- `DELETE /plans/:id`

## Daily signup summary job

The backend now includes a daily signup-summary script:

```powershell
cd backend
npm run send-daily-signup-summary
```

What it does:

- counts accounts created in the last 24 hours
- includes the signup email addresses in the report
- sends the summary to `SIGNUP_SUMMARY_RECIPIENT`
- falls back to server logging if outbound email is not configured

Recommended production scheduling:

- run it once every 24 hours on the Lightsail server
- use the same backend environment as the main API service
- send to `leoffhelper@gmail.com` unless you later want a different recipient

## Retirement check-in email job

The backend now includes a scheduled retirement check-in script:

```powershell
cd backend
npm run send-retirement-checkins
```

What it does:

- checks each account's chosen retirement check-in frequency
- supports `monthly`, `every_6_months`, `yearly`, or `never`
- sends the reminder only when that account is actually due
- includes links back to the planner, dashboard, and contact page
- updates `lastRetirementCheckInSentAt` only after a real outbound send succeeds

Recommended production scheduling:

- run it once per day on the Lightsail server
- use the same backend environment as the main API service
- let each account's own setting decide whether that user receives an email on that run

## Notes

- Passwords are hashed with Node's `scrypt`.
- Sessions are stored server-side and referenced by an HTTP-only cookie.
- Sessions now use a 15-minute idle timeout by default, with authenticated API
  activity refreshing the active session window.
- Account responses now include a safe `entitlements` payload so the frontend
  can gate premium-ready features without exposing billing internals.
- Password reset links default to a 60-minute lifetime.
- Auth-sensitive endpoints now use in-memory rate limiting keyed by client IP.
- If `EMAIL_FROM` and `RESEND_API_KEY` are not configured, reset links are
  logged on the server so local/dev testing can still complete the flow.
- If `EMAIL_FROM` and `RESEND_API_KEY` are not configured, account-created
  emails also fall back to server logging instead of blocking signup.
- The daily signup summary job uses the same outbound email configuration and
  also falls back to server logging when email delivery is not configured.
- Retirement check-in emails use the same outbound email configuration.
- Plans store the canonical `simulationState` and can also persist full
  `workspaceState` so asset/debt module cards restore cleanly.
- The storage layer is intentionally isolated in `src/lib/store.js` so file and
  PostgreSQL backends can share the same route layer with minimal churn.

## Operations docs

- Production security baseline:
  [docs/production-security-baseline.md](/D:/LEOFF%202/backend/docs/production-security-baseline.md)
- Backup restore drill:
  [docs/backup-restore-drill.md](/D:/LEOFF%202/backend/docs/backup-restore-drill.md)

## PostgreSQL migration groundwork

The backend now includes the first PostgreSQL migration pieces:

- storage-adapter routing in [src/lib/storage/index.js](/D:/LEOFF%202/backend/src/lib/storage/index.js)
- file backend in [src/lib/storage/fileStore.js](/D:/LEOFF%202/backend/src/lib/storage/fileStore.js)
- PostgreSQL backend in [src/lib/storage/postgresStore.js](/D:/LEOFF%202/backend/src/lib/storage/postgresStore.js)
- schema file in [src/lib/storage/schema.sql](/D:/LEOFF%202/backend/src/lib/storage/schema.sql)
- schema init script:
  `npm run db:init`
- JSON-to-PostgreSQL import script:
  `npm run migrate-json-store-to-postgres`

To enable PostgreSQL, set:

```powershell
DATA_BACKEND=postgres
DATABASE_URL=postgres://...
DATABASE_SSL=false
```

The default backend remains the current file store until the production cutover.

## Auth rate limits

The backend now rate limits these routes by client IP:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

Default limits:

- register: `5` requests per `60` minutes
- login: `10` requests per `15` minutes
- forgot-password: `5` requests per `60` minutes
- reset-password: `10` requests per `60` minutes

The response includes:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` on `429`

## Manual premium testing

The backend now includes a helper for manually assigning a user tier while
billing is still being built:

```powershell
cd backend
npm run set-user-tier -- geoff@example.com premium manual
```

Optional expiry:

```powershell
cd backend
npm run set-user-tier -- geoff@example.com premium manual 2026-12-31T23:59:59.000Z
```

Return a user to the free tier:

```powershell
cd backend
npm run set-user-tier -- geoff@example.com free
```
