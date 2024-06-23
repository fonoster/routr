##
# Build and pack the service
##
FROM alpine:3.19 AS builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
WORKDIR /work

COPY mods/one .
COPY mods/pgdata/schema.prisma .
COPY .scripts/custom-jre.sh .

RUN apk add --no-cache --update npm nodejs curl git tini python3 make cmake g++ openjdk17-jdk \
  && sh custom-jre.sh \
  && npm install --omit=dev \
  && mv schema.prisma node_modules/@routr/pgdata/ \
  && cd node_modules/@routr/pgdata/ && npx prisma generate \
  && cd /work && curl -sf https://gobinaries.com/tj/node-prune | sh && node-prune \
  && curl -L -o heplify https://github.com/sipcapture/heplify/releases/download/v1.65.10/heplify \
  && chmod +x heplify

##  
#  Runner
##
FROM alpine:3.19 AS runner

ARG PKCS12_PASSWORD=changeme
ARG POSTGRES_USER=postgres
ARG POSTGRES_PASSWORD=postgres
ARG CA_CERT_SUBJECT="/CN=Self Signed CA"
ARG SERVER_CERT_SUBJECT="/CN=localhost"
ARG PRISMA_VERSION=5.9.1
ARG DATABASE_URL=postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/routr

ENV PKCS12_PASSWORD=$PKCS12_PASSWORD \
  PATH_TO_CERTS=/etc/routr/certs \
  USER=fonoster \
  GID=5000 \
  UID=5000 \
  JAVA_HOME=/service/jre \
  EDGEPORT_RUNNER=/service/edgeport.sh \
  TLS_ON=false \
  VERIFY_CLIENT_CERT=false \
  CA_CERT_SUBJECT=$CA_CERT_SUBJECT \
  SERVER_CERT_SUBJECT=$SERVER_CERT_SUBJECT \
  DATABASE_URL=$DATABASE_URL \
  IGNORE_LOOPBACK_FROM_LOCALNETS=true \
  PRISMA_VERSION=$PRISMA_VERSION \
  START_LOCAL_DB=true

WORKDIR /service

COPY mods/edgeport/edgeport.sh .
COPY mods/edgeport/libs libs
COPY etc/edgeport.yaml config/edgeport.yaml
COPY config/log4j2.yaml mods/edgeport/etc/log4j2.yaml
COPY .scripts/convert-to-p12.sh .
COPY .scripts/generate-certs.sh .
COPY --from=builder /work/dist dist
COPY --from=builder /work/node_modules node_modules
COPY --from=builder /work/package.json .
COPY --from=builder /work/jre jre
COPY --from=builder /work/heplify /usr/local/bin/
COPY .scripts/init-postgres.sh .
COPY mods/pgdata/schema.prisma .
COPY mods/pgdata/migrations migrations

RUN apk add --no-cache nodejs npm tini openssl postgresql postgresql-client su-exec sed sngrep libcap \
  && mkdir -p ${PATH_TO_CERTS} /var/lib/postgresql/data /run/postgresql /root/.npm \
  && addgroup -g ${GID} ${USER} \
  && adduser --disabled-password --gecos "" --ingroup ${USER} --home ${HOME} --uid ${UID} ${USER} \
  && chown -R ${USER}:${USER} /service /etc/routr \
  && chown -R postgres:postgres /var/lib/postgresql/data /run/postgresql /root/.npm \
  && chmod +x edgeport.sh convert-to-p12.sh init-postgres.sh \
  && chmod 2777 /run/postgresql \
  && setcap 'CAP_NET_RAW+eip' /usr/bin/sngrep \
  && rm -rf /var/cache/apk/* /tmp/* /services/init-postgres.sh \
  && rm -rf /root/.npm /root/.config /root/.cache /root/.local \
  && apk del postgresql-client libcap

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

CMD sh -c "if [ \"$START_LOCAL_DB\" = \"true\" ]; then \
    su-exec postgres pg_ctl start -D /var/lib/postgresql/data --options='-h 0.0.0.0'; \
  fi && \
  DATABASE_URL=${DATABASE_URL} npx prisma@${PRISMA_VERSION} migrate deploy --schema=/service/schema.prisma && \
  su-exec $USER ./convert-to-p12.sh $PATH_TO_CERTS $PKCS12_PASSWORD && \
  if [ -n \"$HEPLIFY_OPTIONS\" ]; then \
    heplify $HEPLIFY_OPTIONS & \
  fi && \
  sed -i 's|keyStorePassword: .*|keyStorePassword: ${PKCS12_PASSWORD}|g' config/edgeport.yaml && \
  sed -i 's|trustStorePassword: .*|trustStorePassword: ${PKCS12_PASSWORD}|g' config/edgeport.yaml && \
  su-exec $USER node ./dist/runner"
