##
## Runner
##
FROM alpine:3.23 AS runner
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ARG CA_CERT_SUBJECT="/CN=Self Signed CA"
ARG SERVER_CERT_SUBJECT="/CN=localhost"
ENV PATH_TO_CERTS=/etc/routr/certs \
  TLS_ON=true \
  CA_CERT_SUBJECT=$CA_CERT_SUBJECT \
  SERVER_CERT_SUBJECT=$SERVER_CERT_SUBJECT \
  VERIFY_CLIENT_CERT=false

WORKDIR /scripts

COPY .scripts/generate-certs.sh /generate-certs.sh
# Build context is the repository root. The @routr workspace packages this module
# depends on are packed from the checkout and installed together with it into one
# tree, so the image carries this commit's code for every @routr package, fetches
# none of them from npm, and keeps the shared dependencies deduplicated.
COPY mods/common/package.json /scripts/common/
COPY mods/common/dist /scripts/common/dist
COPY mods/processor/package.json /scripts/processor/
COPY mods/processor/dist /scripts/processor/dist
COPY mods/pgdata/package.json /scripts/pgdata/
COPY mods/pgdata/dist /scripts/pgdata/dist
COPY mods/pgdata/schema.prisma /scripts/pgdata/

# Todo: We need to normalize user id and group id across all images
RUN chmod +x /generate-certs.sh \
  && apk add --no-cache cmake g++ git make nodejs npm openssl python3 tini \
  && npm install -g prisma@6.12.0 \
  && for m in common processor pgdata; do npm pack --silent --pack-destination /scripts ./$m; done \
  && mkdir -p /opt/routr && cd /opt/routr \
  && echo '{"name":"routr-pgdata-image","private":true}' > package.json \
  && npm install --omit=dev --no-audit --no-fund /scripts/routr-*.tgz \
  && cp /scripts/pgdata/schema.prisma /opt/routr/node_modules/@routr/pgdata/ \
  && cd /opt/routr/node_modules/@routr/pgdata/ \
  && npx prisma@6.12.0 generate \
  && ln -s /opt/routr/node_modules/.bin/run_pgdata /usr/local/bin/run \
  && apk del git python3 make cmake g++ npm \
  && mkdir -p ${PATH_TO_CERTS} \
  && chown -R 1000:3000 ${PATH_TO_CERTS} \
  && chmod 700 ${PATH_TO_CERTS} \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/* 

USER 1000:3000

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["sh", "-c", "set -e && /generate-certs.sh $PATH_TO_CERTS && run"]

##
## Migrations
##
FROM node:18-alpine3.19 AS migrations

WORKDIR /db

RUN apk add --no-cache postgresql-client

COPY mods/pgdata/package.json mods/pgdata/package-lock.json* ./
RUN npm install --omit=dev

COPY mods/pgdata/migrations migrations
COPY mods/pgdata/schema.prisma .

CMD ["npx", "prisma@6.12.0", "migrate", "deploy"]
