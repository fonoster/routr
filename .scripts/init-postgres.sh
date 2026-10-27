#!/bin/sh

set -e

# This scripts initializes the postgres database
initdb /var/lib/postgresql/data
pg_ctl start -D /var/lib/postgresql/data
/opt/prisma-cli/node_modules/.bin/prisma migrate deploy --schema=/service/schema.prisma
pg_ctl stop -D /var/lib/postgresql/data