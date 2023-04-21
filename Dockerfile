##
## Build and pack the service
##
FROM node:18-alpine as builder

ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk

WORKDIR /work

COPY mods/one .
COPY ./mods/pgdata/schema.prisma .
COPY ./mods/edgeport/edgeport.sh .
COPY ./.scripts/custom-jre.sh custom-jre.sh
COPY ./.scripts/generate-certs.sh .

RUN apk add --no-cache --update curl git tini python3 make cmake g++ openjdk11-jdk \
  && sh custom-jre.sh \
  && npm install --omit=dev \
  && mv schema.prisma node_modules/@routr/pgdata/ \
  && cd node_modules/@routr/pgdata/ \
  && npx prisma generate \
  && cd /work && curl -sf https://gobinaries.com/tj/node-prune | sh \
  && node-prune

RUN chmod +x edgeport.sh generate-certs.sh

##  
## Runner
##
FROM node:18-alpine as runner

ENV USER=fonoster
ENV GID=5000
ENV UID=5000
ENV JAVA_HOME=/service/jre
ENV EDGEPORT_RUNNER=/service/edgeport.sh
ENV DOCKER=true

WORKDIR /service

COPY --from=builder /work/dist dist
COPY --from=builder /work/node_modules node_modules
COPY --from=builder /work/package.json .
COPY --from=builder /work/jre jre
COPY --from=builder /work/generate-certs.sh .
COPY --from=builder /work/edgeport.sh .
COPY ./mods/edgeport/libs libs
COPY config/log4j2.yaml config/log4j2.yaml

RUN chmod +x edgeport.sh generate-certs.sh

RUN apk add --no-cache tini \
  && mkdir -p /etc/routr \
  && addgroup -g ${GID} ${USER} \
  && adduser \
    --disabled-password \
    --gecos "" \
    --ingroup "$USER" \
    --home ${HOME} \
    --uid "$UID" \
    "$USER"

USER $USER

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["node", "./dist/runner"]