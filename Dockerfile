##
## Build and pack the service
##
FROM node:18-alpine as builder

ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk

WORKDIR /work

COPY mods/one .
COPY ./mods/pgdata/schema.prisma .
COPY ./.scripts/custom-jre.sh .

RUN apk add --no-cache --update curl git tini python3 make cmake g++ openjdk11-jdk \
  && sh custom-jre.sh \
  && npm install --omit=dev \
  && mv schema.prisma node_modules/@routr/pgdata/ \
  && cd node_modules/@routr/pgdata/ \
  && npx prisma generate \
  && cd /work && curl -sf https://gobinaries.com/tj/node-prune | sh \
  && node-prune

##  
## Runner
##
FROM node:18-alpine as runner

ARG PKCS_PASSWORD=changeme
ARG PATH_TO_CERTS=/etc/routr/certs

ENV PKCS_PASSWORD=$PKCS_PASSWORD
ENV PATH_TO_CERTS=$PATH_TO_CERTS
ENV USER=fonoster
ENV GID=5000
ENV UID=5000
ENV JAVA_HOME=/service/jre
ENV EDGEPORT_RUNNER=/service/edgeport.sh

WORKDIR /service

COPY ./mods/edgeport/edgeport.sh .
COPY ./etc/edgeport.yaml config/edgeport.yaml
COPY ./.scripts/convert-to-p12.sh .
COPY ./.scripts/generate-certs.sh .
COPY --from=builder /work/dist dist
COPY --from=builder /work/node_modules node_modules
COPY --from=builder /work/package.json .
COPY --from=builder /work/jre jre
COPY ./mods/edgeport/libs libs
COPY config/log4j2.yaml config/log4j2.yaml

RUN chmod +x edgeport.sh convert-to-p12.sh

RUN apk add --no-cache tini openssl \
  && mkdir -p ${PATH_TO_CERTS} \
  && addgroup -g ${GID} ${USER} \
  && adduser \
    --disabled-password \
    --gecos "" \
    --ingroup "$USER" \
    --home ${HOME} \
    --uid "$UID" \
    "$USER" \
  && chown -R ${USER}:${USER} /service \
  && chown -R ${USER}:${USER} /etc/routr

USER $USER

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["sh", "-c", "set -e && ./convert-to-p12.sh $PATH_TO_CERTS $PKCS_PASSWORD && node ./dist/runner"]
