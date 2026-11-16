##
## The database migrations of Routr 3 (fonoster/routr-pgdata-migrations): Routr 2's schema
## plus numbering. migrations/ and schema.prisma are copies of mods/pgdata on main, byte for
## byte, the two numbering migrations of 2.33 included (20261113000000_added_number_aliases,
## 20261113100000_added_trunk_number_formats), plus the v3-only
## 20261114000000_routr3_numbering (the INTERNATIONAL number format and an index of numbers
## by trunk_ref), which main copies when numbering is backported. Prisma keeps each
## migration's checksum in _prisma_migrations, so a database Routr 2 migrated applies only
## what it lacks. Never edit a migration here; any other schema change is out of scope for
## 3.0. Build it from the repository root:
##
##   docker build -f ops/pgdata-migrations/Dockerfile -t routr-pgdata-migrations .
##
## It applies the migrations to DATABASE_URL with `prisma migrate deploy`, as Routr 2's image
## did, but with the Prisma CLI installed here instead of fetched from npm on every run. The
## chart's migrations hook also runs pg_isready from it, to wait for the database.
##
FROM node:22-alpine3.22

# The Prisma CLI that wrote Routr 2's migrations (mods/pgdata on main), with its schema
# engine for this platform, downloaded at build time so a run needs no network but the
# database's
ENV PRISMA_VERSION=6.12.0 \
  CHECKPOINT_DISABLE=1 \
  PRISMA_HIDE_UPDATE_MESSAGE=1 \
  NODE_ENV=production

WORKDIR /db

RUN apk add --no-cache openssl postgresql-client tini \
  && npm install -g --no-audit --no-fund prisma@${PRISMA_VERSION} \
  && npm cache clean --force \
  && chown 1000:3000 /db

COPY --chown=1000:3000 ops/pgdata-migrations/schema.prisma schema.prisma
COPY --chown=1000:3000 ops/pgdata-migrations/migrations migrations

USER 1000:3000

ENTRYPOINT ["tini", "--"]

CMD ["prisma", "migrate", "deploy", "--schema", "/db/schema.prisma"]
