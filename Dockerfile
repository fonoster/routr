##
## Build and pack the service
##
FROM node:18-alpine as builder

WORKDIR /work

COPY mods/one .
COPY ./mods/pgdata/schema.prisma .

RUN apk add --no-cache --update git tini python3 make cmake g++ \
  && npm install --omit=dev \
  && mv schema.prisma node_modules/@routr/pgdata/ \
  && cd node_modules/@routr/pgdata/ \
  && npx prisma generate

##  
## Runner
##
FROM node:18-alpine as runner

ENV USER=fonoster
ENV GID=5000
ENV UID=5000
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk
ENV EDGEPORT_RUNNER=/service/edgeport.sh
ENV DOCKER=true

WORKDIR /service

COPY --from=builder /work/dist dist
COPY --from=builder /work/node_modules node_modules
COPY --from=builder /work/package.json .
COPY ./mods/edgeport/libs libs
COPY ./mods/edgeport/edgeport.sh .
COPY ./.scripts/generate_certs.sh .
COPY config/log4j2.yaml config/log4j2.yaml

RUN chmod +x edgeport.sh generate_certs.sh

RUN apk add --no-cache tini openjdk11-jre \
  && mkdir -p /etc/routr \
  && addgroup -g ${GID} ${USER} \
  && adduser \
    --disabled-password \
    --gecos "" \
    --ingroup "$USER" \
    --home ${HOME} \
    --uid "$UID" \
    "$USER"

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["node", "./dist/runner"]