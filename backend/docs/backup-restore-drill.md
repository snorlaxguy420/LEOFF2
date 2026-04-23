# Backup Restore Drill

Last updated: April 23, 2026

## Purpose

This drill proves that two recovery layers are operational:

- provider-managed Lightsail snapshots
- app-managed encrypted database backups

This is a restore checklist, not a migration guide.

## Recovery goals

- Recover the backend service to a working state.
- Recover PostgreSQL data from an encrypted backup.
- Prove that auth and plan data are readable after restore.

## Preconditions

- You have shell access to the Lightsail instance.
- You have root access for the backup directories and backup key.
- You know the location of:
  - the encrypted backup files
  - the backup key
  - the runtime env file
  - the PostgreSQL connection details

## App-managed encrypted backup drill

### 1. Pick a restore target

- Use a disposable PostgreSQL database or schema.
- Do not restore into the live production database first.

### 2. Identify the backup set

- Confirm the timestamp of the encrypted backup file you want to test.
- Record that timestamp in the drill notes.

### 3. Decrypt the backup

- Use the root-only backup key on the server.
- Decrypt into a temporary root-owned location.
- Verify the decrypted file permissions stay locked down.

### 4. Restore into the disposable target

- Import the backup into the disposable PostgreSQL target.
- If schema setup is needed first, run the normal schema-init step before the
  import.

### 5. Validate data integrity

- Confirm account rows exist.
- Confirm plan rows exist.
- Confirm at least one known test account can be queried.
- Confirm row counts are plausible relative to production expectations.

### 6. Validate application behavior

- Point a local or temporary backend process at the disposable target.
- Verify:
  - `GET /health`
  - login for a known test account
  - `GET /plans`
  - one plan fetch or update

### 7. Clean up

- Delete decrypted temporary files.
- Keep only the encrypted original backup artifacts.
- Record the drill result, date, backup timestamp, and any failures.

## Lightsail snapshot drill

### 1. Identify the snapshot

- Confirm the first successful automatic snapshot exists in Lightsail.
- Record the snapshot date and time.

### 2. Restore to a non-production instance

- Create a separate instance from the snapshot.
- Do not point production DNS at it.

### 3. Validate instance recovery

- Confirm the app files, env file, service definitions, and PostgreSQL data are
  present.
- Confirm the backend service can start.
- Confirm the health endpoint responds locally on the restored host.

### 4. Smoke test the restored instance

- Verify one login flow and one plan fetch locally against the restored host.
- Confirm outbound email is either intentionally disabled or safely routed for
  testing.

### 5. Record the result

- Snapshot used
- Restore duration
- Validation results
- Any missing steps or surprises

## Drill cadence

- Run this drill after the first confirmed automatic snapshot.
- Re-run after any major storage, backup, or deployment-process change.
- Re-run at least periodically once the product has real user dependence.

## Pass criteria

- The backup can be decrypted.
- The database can be restored to a clean target.
- The backend can boot against restored data.
- Auth and plan CRUD work on restored data.
- The snapshot can also recover a working host state.

## Drill log

### April 23, 2026 - App-managed encrypted backup restore

Result: Pass for the app-managed encrypted PostgreSQL backup layer.

Scope:

- Verified the live LEOFF Helper API target at `api.leoffhelper.com`
  resolves to the production Lightsail host used for `leoff-api.service`.
- Confirmed `leoff-api.service` was active and serving the backend.
- Confirmed `leoff-api-backup.timer` was enabled and scheduled for
  `10:15 UTC` daily.
- Confirmed the latest observed backup service run completed with
  `status=0/SUCCESS` on April 22, 2026 at `10:15:14 UTC`.
- Used encrypted backup set
  `/home/ubuntu/leoff-backups/20260422-101514/leoff_helper.pg.sql.enc`.
- Confirmed backup directories were root-owned with `700` permissions and
  encrypted backup files were root-owned with `600` permissions.
- Confirmed `/etc/leoff-api.env` and `/etc/leoff-api-backup.key` were
  root-owned with `600` permissions.

Restore validation:

- Decrypted the selected encrypted PostgreSQL backup into a temporary root-only
  restore directory.
- Restored the SQL dump into disposable database
  `leoff_restore_drill_20260423`.
- Verified restored row counts before API validation:
  `users=1`, `sessions=1`, `password_reset_tokens=1`, `plans=1`.
- Started a temporary local-only API process on `127.0.0.1:8799` pointed at
  the disposable restored database.
- Verified temporary API `GET /health`.
- Registered a throwaway `.invalid` restore-drill account against the
  disposable database.
- Created a throwaway plan through `POST /plans`.
- Verified the throwaway plan appeared through `GET /plans`.

Cleanup:

- Stopped the temporary API process.
- Dropped the disposable database `leoff_restore_drill_20260423`.
- Removed the temporary decrypted SQL file, temporary postgres-owned SQL copy,
  temporary script, response files, and cookie jar.

Notes:

- The temporary API initially failed because the disposable database was created
  by `postgres`, so the app database user did not have schema privileges. The
  drill continued after granting the app database user privileges on the
  disposable database only. Production data and production schema privileges
  were not changed.

### April 23, 2026 - Lightsail automatic snapshot verification

Result: Pending.

- AWS CLI was not installed locally.
- AWS CLI was not installed on the production Lightsail host.
- No local AWS credentials or local AWS config were found.
- No `~/.aws` config was found for the `ubuntu` user on the production host.
- The first successful automatic Lightsail snapshot still needs to be verified
  through the AWS Lightsail console or a configured AWS CLI/API environment.

Recommended verification record once AWS control-plane access is available:

- Snapshot name or ID.
- Snapshot creation date and time.
- Source instance name.
- Region.
- Snapshot state.
- Whether a non-production instance restore was performed from that snapshot.
