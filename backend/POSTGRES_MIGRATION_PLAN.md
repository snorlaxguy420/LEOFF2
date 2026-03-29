# PostgreSQL Migration Plan

Last updated: March 29, 2026

## Current Production Reality

- Backend host: Lightsail Ubuntu 24.04
- CPU: 2 vCPU
- Memory: about 911 MB RAM
- Disk: 38 GB root volume with about 36 GB free
- Current backend runtime: Node 20
- Current persistence: file-backed JSON store at `backend/data/store.json`
- Current live store size: about `13 KB`

## Does PostgreSQL fit on the current Lightsail backend?

Yes.

At the current scale, PostgreSQL will run on the existing Lightsail server.
The app footprint is still small, and the live data set is tiny.

That said, this is still a small box:

- less than 1 GB RAM
- no swap currently configured
- app server and database would share the same machine

So the recommended posture is:

1. Short term: run PostgreSQL on the same Lightsail instance, tuned for low memory.
2. Before meaningful growth: move PostgreSQL to a separate database host or managed database.

## Why migrate now

The current file-backed store is the main backend security and reliability weakness.

Right now:

- user records
- session records
- password reset token hashes
- saved plan payloads

all live together in one JSON file on disk.

PostgreSQL gives us:

- stronger data integrity
- safer concurrent writes
- better backup workflows
- more defensible access control
- a real path to encryption-at-rest and operational hardening

## Recommended V1 architecture

Use PostgreSQL as the primary application store while keeping the current route contract intact.

### Tables

#### `users`

- `id` text primary key
- `email` text not null unique
- `password_hash` text not null
- `password_salt` text not null
- `display_name` text not null default `''`
- `plan_tier` text not null default `'free'`
- `premium_source` text null
- `premium_granted_at` timestamptz null
- `premium_expires_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

#### `sessions`

- `id` text primary key
- `user_id` text not null references `users(id)` on delete cascade
- `token_hash` text not null unique
- `created_at` timestamptz not null
- `expires_at` timestamptz not null

Indexes:

- unique index on `token_hash`
- index on `user_id`
- index on `expires_at`

#### `password_reset_tokens`

- `id` text primary key
- `user_id` text not null references `users(id)` on delete cascade
- `token_hash` text not null unique
- `created_at` timestamptz not null
- `expires_at` timestamptz not null
- `used_at` timestamptz null

Indexes:

- unique index on `token_hash`
- index on `user_id`
- index on `expires_at`

#### `plans`

- `id` text primary key
- `user_id` text not null references `users(id)` on delete cascade
- `name` text not null
- `simulation_state` jsonb not null
- `workspace_state` jsonb not null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Indexes:

- index on `user_id`
- index on `(user_id, updated_at desc)`

## Storage-shape recommendation

Use `jsonb` for:

- `simulation_state`
- `workspace_state`

That lets us migrate quickly without redesigning the whole simulator payload first.

It is the right first step because:

- the backend already treats those payloads as document-like data
- it preserves the current API contract
- it avoids a risky normalization project during the first migration

Later, if needed, selected high-value fields can be broken out into relational columns.

## Backend refactor recommendation

Do not spread raw SQL across `app.js`.

Instead:

1. Introduce a storage adapter layer behind the current persistence calls.
2. Keep route behavior the same.
3. Let the app switch between file store and PostgreSQL through config.

### Suggested new backend structure

- `backend/src/lib/storage/index.js`
- `backend/src/lib/storage/fileStore.js`
- `backend/src/lib/storage/postgresStore.js`
- `backend/src/lib/storage/schema.sql`
- `backend/src/scripts/migrateJsonStoreToPostgres.js`

### Adapter capabilities needed

- `findUserByEmail(email)`
- `findUserById(id)`
- `createUserWithSession(user, session)`
- `replaceUserSession(userId, session)`
- `deleteSessionByTokenHash(tokenHash)`
- `refreshSession(sessionId, expiresAt)`
- `updateUserProfile(userId, updates)`
- `updateUserPassword(userId, passwordHash, passwordSalt, updatedAt)`
- `createPasswordResetToken(tokenRecord)`
- `findActivePasswordResetToken(tokenHash, now)`
- `consumePasswordResetTokensForUser(userId)`
- `listPlansForUser(userId)`
- `createPlan(plan)`
- `findPlanForUser(planId, userId)`
- `updatePlanForUser(planId, userId, updates)`
- `deletePlanForUser(planId, userId)`
- `listUsersCreatedWithinWindow(start, end)`
- `setUserTier(email, tierFields)`

That is the cleanest way to migrate without rewriting the route layer at the same time.

## Rollout plan

### Phase 1: preparation

1. Add PostgreSQL support to the backend with the `pg` package.
2. Add `DATABASE_URL` and `DATA_BACKEND=file|postgres` config.
3. Add schema creation SQL.
4. Add a storage adapter contract and wire current code through it.

### Phase 2: local verification

1. Run a local PostgreSQL instance.
2. Create the schema.
3. Import the current JSON store into PostgreSQL.
4. Run regression checks for:
   - register
   - login/logout
   - `/me`
   - change password
   - forgot/reset password
   - plans CRUD
   - daily signup summary
   - manual premium tier update

### Phase 3: production database setup

1. Install PostgreSQL on Lightsail or provision a separate DB host.
2. Create:
   - database
   - least-privilege app user
   - backup user or backup routine
3. Turn on automatic service startup.
4. Add swap before production cutover on the current box.

### Phase 4: production data migration

1. Stop or briefly quiesce writes to the backend.
2. Back up `data/store.json`.
3. Run the one-time import script into PostgreSQL.
4. Verify row counts:
   - users
   - sessions
   - password reset tokens
   - plans
5. Switch `DATA_BACKEND=postgres` and set `DATABASE_URL`.
6. Restart `leoff-api`.
7. Live-test:
   - login
   - save plan
   - rename/update plan
   - forgot-password request
   - reset-password completion

### Phase 5: stabilization

1. Keep the JSON file as rollback backup for a defined window.
2. Monitor service memory and PostgreSQL memory.
3. Add recurring backups.
4. Only then remove file-store production dependency.

## Lightsail-specific recommendation

For the current server, use a conservative setup:

- PostgreSQL on the same box is acceptable for now
- add swap before cutover
- tune PostgreSQL for a low-memory VM
- keep the Node app and PostgreSQL both local to `127.0.0.1`
- expose PostgreSQL to the internet: no

### Short-term production recommendation

- install PostgreSQL locally on the Lightsail instance
- bind it to localhost only
- use a dedicated app role
- use strong generated credentials in the systemd environment
- add nightly `pg_dump` backups

### Longer-term recommendation

Move the database off the app box once any of these become true:

- user count starts growing materially
- plan payloads get larger and more frequent
- billing goes live
- support/admin access needs become more formal

## Security wins from this migration

This migration does not solve everything by itself, but it meaningfully improves the backend foundation.

It enables:

- safer multi-request concurrency
- better operational backups
- easier permission boundaries
- cleaner future auditing
- a more realistic path to hardening sensitive account data

It does **not** replace:

- encrypted backups
- rate limiting
- secrets hardening
- persistence minimization
- audit/access controls

## Recommended immediate implementation order

1. Add config and storage adapter scaffolding.
2. Add PostgreSQL schema and `pg` dependency.
3. Port auth/session/password-reset reads and writes.
4. Port plans CRUD.
5. Port utility scripts and signup summary job.
6. Add one-time JSON-to-Postgres import script.
7. Test locally.
8. Then prepare the Lightsail cutover.
