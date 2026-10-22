#!/bin/sh

set -e

# This scripts initializes the postgres database
initdb /var/lib/postgresql/data
pg_ctl start -D /var/lib/postgresql/data
cd /service/node_modules/@routr/pgdata && npx prisma@6.12.0 migrate deploy --schema=/service/schema.prisma
pg_ctl stop -D /var/lib/postgresql/data