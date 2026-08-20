# Schema migrations

`migrator.js` applies every `NNN_name.sql` in this directory exactly once, in
numeric order, inside a transaction, and records it in `schema_version`.

## The convention

**From migration 008 onward, a schema change lives here and only here.**

Migrations 001–007 are `SELECT 1` no-ops. They are markers for changes that had
already been applied by hand in `db.js` — the `CREATE TABLE IF NOT EXISTS` block
plus a series of `try { ALTER TABLE … } catch {}` statements that swallow the
"duplicate column" error on every start. That worked, but it means `db.js` and
`schema_version` disagree about what the schema is, and nothing can tell you
which columns a given database actually has.

Do not add another `try/catch` ALTER to `db.js`. It cannot fail loudly, cannot
be ordered against other changes, and cannot be rolled back.

## Writing one

1. Create `migrations/NNN_short_name.sql`, numbered one higher than the last.
2. Put the change in it — `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX`, …
3. **Do not** also add the column to the `CREATE TABLE` in `db.js`. A fresh
   database gets the base schema from `db.js` and then runs every migration; if
   the column is in both, the migration fails on "duplicate column name".
4. Run the tests — they build a database from scratch, so a broken migration
   fails there first.

A migration is applied once and never re-run, so it must be correct when it
lands. There is no down-migration: to reverse something, write a new migration.

## Backfills

Statements that touch data (`UPDATE`, backfilling a new column) belong in the
same file as the schema change, after it. The whole file runs in one
transaction, so a failure part-way leaves nothing behind and the version is not
recorded.
