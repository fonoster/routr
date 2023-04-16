##
## Build and pack the service
##
FROM alpine:3.17 as builder

COPY mods/one /work
WORKDIR /work

RUN apk add --no-cache --update git npm curl bash git tini nodejs npm python3 make cmake g++ \
  && npm install --production

##  
## Runner
##
FROM alpine:3.17 as runner

ENV USER=fonoster
ENV GID=1000
ENV UID=1000
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk
ENV EDGEPORT_RUNNER=/service/edgeport.sh
ENV DOCKER=true

WORKDIR /service

COPY --from=builder /work/dist dist
COPY --from=builder /work/node_modules node_modules
COPY --from=builder /work/package.json package.json
COPY ./mods/edgeport/libs /service/libs
COPY ./mods/edgeport/edgeport.sh /service
COPY ./mods/pgdata/schema.prisma /service
COPY ./.scripts/generate_certs.sh /service

RUN chmod +x /service/edgeport.sh
RUN chmod +x /service/generate_certs.sh

RUN apk add --no-cache --update git tini openjdk11-jre npm nodejs \
  && mkdir -p /opt/routr \
  && mv /service/schema.prisma node_modules/@routr/pgdata/ \
  && cd node_modules/@routr/pgdata/ \
  && npx prisma generate \
  && apk del npm git \
  && rm -rf /var/cache/apk/*

RUN addgroup -g ${GID} ${USER} && adduser \
    --disabled-password \
    --gecos "" \
    --ingroup "$USER" \
    --home ${HOME} \
    --uid "$UID" \
    "$USER"

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["node", "./dist/runner"]
