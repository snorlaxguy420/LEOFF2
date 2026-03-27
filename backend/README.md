# LEOFF Helper Backend

Initial backend scaffold for:
- user registration/login
- session-based authentication
- saved plan CRUD around the canonical `simulationState`

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
- `SESSION_TTL_DAYS`

## Current endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`
- `GET /plans`
- `POST /plans`
- `GET /plans/:id`
- `PUT /plans/:id`
- `DELETE /plans/:id`

## Notes

- Passwords are hashed with Node's `scrypt`.
- Sessions are stored server-side and referenced by an HTTP-only cookie.
- Plans store the canonical `simulationState` object so the frontend does not
  need a second persistence format.
- The storage layer is intentionally isolated in `src/lib/store.js` so it can
  later move to PostgreSQL with minimal route churn.
