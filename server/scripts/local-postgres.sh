#!/usr/bin/env bash
# Start a disposable LOCAL PostgreSQL 16 cluster for dev/tests (VM only).
# initdb/pg_ctl refuse to run as root, so this runs them as the `postgres`
# system user and keeps data in /tmp/nakpg (recreate anytime with this script).
# Databases: nakugaon_dev (server) and nakugaon_test (vitest suite, DROPPED
# and re-migrated by the suite — never point tests at a real database).
# Usage: bash server/scripts/local-postgres.sh
set -euo pipefail
mkdir -p /tmp/nakpg
chown postgres:postgres /tmp/nakpg
if [ ! -d /tmp/nakpg/data ]; then
  su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/nakpg/data -U nakugaon --auth=trust" >/dev/null
fi
if ! su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/nakpg/data status" >/dev/null 2>&1; then
  su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/nakpg/data -o '-p 5433 -k /tmp -c listen_addresses=127.0.0.1' -l /tmp/nakpg/pg.log start"
fi
psql -h 127.0.0.1 -p 5433 -U nakugaon -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='nakugaon_dev'" | grep -q 1 || psql -h 127.0.0.1 -p 5433 -U nakugaon -d postgres -c "CREATE DATABASE nakugaon_dev;" >/dev/null
psql -h 127.0.0.1 -p 5433 -U nakugaon -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='nakugaon_test'" | grep -q 1 || psql -h 127.0.0.1 -p 5433 -U nakugaon -d postgres -c "CREATE DATABASE nakugaon_test;" >/dev/null
echo "Local Postgres ready: postgresql://nakugaon@127.0.0.1:5433/nakugaon_dev (dev) / nakugaon_test (tests)"
