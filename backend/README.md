# LEOFF Helper Backend

Initial backend scaffold for:
- user registration/login
- session-based authentication
- account-tier / entitlement exposure for premium-ready features
- saved plan CRUD around the canonical `simulationState`
- out-of-session password recovery via reset links
- transactional account emails for registration and password recovery

This first version intentionally uses Node built-ins only and persists to a
local JSON file so the API contract can stabilize before a database migration.

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

## Notes

- Passwords are hashed with Node's `scrypt`.
- Sessions are stored server-side and referenced by an HTTP-only cookie.
- Sessions now use a 15-minute idle timeout by default, with authenticated API
  activity refreshing the active session window.
- Account responses now include a safe `entitlements` payload so the frontend
  can gate premium-ready features without exposing billing internals.
- Password reset links default to a 60-minute lifetime.
- If `EMAIL_FROM` and `RESEND_API_KEY` are not configured, reset links are
  logged on the server so local/dev testing can still complete the flow.
- If `EMAIL_FROM` and `RESEND_API_KEY` are not configured, account-created
  emails also fall back to server logging instead of blocking signup.
- The daily signup summary job uses the same outbound email configuration and
  also falls back to server logging when email delivery is not configured.
- Plans store the canonical `simulationState` and can also persist full
  `workspaceState` so asset/debt module cards restore cleanly.
- The storage layer is intentionally isolated in `src/lib/store.js` so it can
  later move to PostgreSQL with minimal route churn.

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
