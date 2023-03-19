##
## Runner
##
FROM alpine:3.15 as runner
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

COPY . /scripts
WORKDIR /scripts

RUN apk add --no-cache --update git curl tini nodejs npm python3 make cmake g++ \
  && npm pack \
  && npm install -g routr-*.tgz \
  && cp schema.prisma /usr/local/lib/node_modules/@routr/pgdata/ \
  && cd /usr/local/lib/node_modules/@routr/pgdata/ \
  && npx prisma generate \
  && link /usr/local/bin/run_pgdata /usr/local/bin/run \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/* \
  && apk del git curl python3 make cmake g++

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["run"]

##
## Migrations
##
FROM node:16.15.1-alpine3.15 as migrations
WORKDIR /db
COPY migrations /db/migrations
COPY schema.prisma /db
