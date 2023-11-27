##
## Build and pack the service
##
FROM alpine:3.18 as builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk
WORKDIR /work

COPY mods/one .
COPY mods/pgdata/schema.prisma .
COPY .scripts/custom-jre.sh .

RUN apk add --no-cache --update npm nodejs curl git tini python3 make cmake g++ openjdk11-jdk \
  && sh custom-jre.sh \
  && npm install --omit=dev \
  && mv schema.prisma node_modules/@routr/pgdata/ \
  && cd node_modules/@routr/pgdata/ && npx prisma generate \
  && cd /work && curl -sf https://gobinaries.com/tj/node-prune | sh && node-prune \
  && curl -L -o heplify https://github.com/sipcapture/heplify/releases/download/v1.65.10/heplify \
  && chmod +x heplify

##  
## Runner
##
FROM alpine:3.18 as runner

ARG PKCS_PASSWORD=changeme
ARG POSTGRES_USER=postgres
ARG POSTGRES_PASSWORD=postgres
ARG CA_CERT_SUBJECT="/CN=Self Signed CA"
ARG SERVER_CERT_SUBJECT="/CN=localhost"
ENV PKCS_PASSWORD=$PKCS_PASSWORD \
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
  DATABASE_URL=postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/routr \
  IGNORE_LOOPBACK_FROM_LOCALNETS=true

WORKDIR /service

COPY mods/edgeport/edgeport.sh .
COPY mods/edgeport/libs libs
COPY etc/edgeport.yaml config/edgeport.yaml
COPY config/log4j2.yaml config/log4j2.yaml
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

RUN apk add --no-cache nodejs npm tini openssl postgresql postgresql-client su-exec \
  && mkdir -p ${PATH_TO_CERTS} /var/lib/postgresql/data /run/postgresql /root/.npm \
  && addgroup -g ${GID} ${USER} \
  && adduser --disabled-password --gecos "" --ingroup "$USER" --home ${HOME} --uid "$UID" "$USER" \
  && chown -R ${USER}:${USER} /service /etc/routr \
  && chown -R postgres:postgres /var/lib/postgresql/data /run/postgresql /root/.npm \
  && chmod +x edgeport.sh convert-to-p12.sh init-postgres.sh \
  && chmod 2777 /run/postgresql \
  && export DATABASE_URL=$DATABASE_URL && su -m postgres -c "/service/init-postgres.sh" \
  && rm -rf /var/cache/apk/* /tmp/* /services/migrations /services/schema.prisma /services/init-postgres.sh \
  && rm -rf /root/.npm /root/.config /root/.cache /root/.local \
  && apk del npm postgresql-client

ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD sh -c "su-exec postgres pg_ctl start -D /var/lib/postgresql/data && \
           su-exec $USER ./convert-to-p12.sh $PATH_TO_CERTS $PKCS_PASSWORD && \
           if [ -n \"$HEPLIFY_OPTIONS\" ]; then \
             heplify $HEPLIFY_OPTIONS & \
           fi && \
           DATABASE_URL=$DATABASE_URL su-exec $USER node ./dist/runner"
