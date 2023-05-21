##
## Runner
##
FROM alpine:3.17 as runner
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

COPY . /scripts
WORKDIR /scripts

RUN apk add --no-cache git tini nodejs npm python3 make cmake g++ \
  && npm pack \
  && npm install -g routr-*.tgz \
  && cp schema.prisma /usr/local/lib/node_modules/@routr/pgdata/ \
  && cd /usr/local/lib/node_modules/@routr/pgdata/ \
  && npx prisma generate \
  && ln -s /usr/local/bin/run_pgdata /usr/local/bin/run \
  && apk del git python3 make cmake g++ npm \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/*

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

CMD ["npx", "-y", "prisma", "migrate", "deploy"]