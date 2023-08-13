##
## Runner
##
FROM alpine:3.17 as runner
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV PATH_TO_CERTS=/etc/routr/certs \
  TLS_ON=true \
  VERIFY_CLIENT_CERT=false

WORKDIR /scripts

COPY .scripts/generate-certs.sh /generate-certs.sh
COPY mods/pgdata .

# Todo: We need to normalize user id and group id across all images
RUN chmod +x /generate-certs.sh \
  && apk add --no-cache openssl git tini nodejs npm python3 make cmake g++ \
  && npm pack \
  && npm install -g routr-*.tgz \
  && cp schema.prisma /usr/local/lib/node_modules/@routr/pgdata/ \
  && cd /usr/local/lib/node_modules/@routr/pgdata/ \
  && npx prisma generate \
  && ln -s /usr/local/bin/run_pgdata /usr/local/bin/run \
  && apk del git python3 make cmake g++ npm \
  && mkdir -p $PATH_TO_CERTS \
  && chown -R 1000:3000 $PATH_TO_CERTS \
  && chmod 700 $PATH_TO_CERTS \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/* 

USER 1000:3000

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["sh", "-c", "set -e && /generate-certs.sh $PATH_TO_CERTS && run"]

##
## Migrations
##
FROM node:16.15.1-alpine3.15 as migrations

WORKDIR /db

RUN npm install --location=global prisma@4.16.2 \
  && apk add --no-cache postgresql-client

COPY mods/pgdata/migrations migrations
COPY mods/pgdata/schema.prisma .

CMD ["prisma", "migrate", "deploy"]
