##
## Build and pack the service
##
FROM alpine:3.19 AS builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
WORKDIR /work

COPY .scripts/custom-jre.sh .

RUN apk add --no-cache --update g++ openjdk17-jdk \
  && sh custom-jre.sh

##  
## Runner
##
FROM alpine:3.19 AS runner 

ARG PKCS12_PASSWORD=changeme
ARG PATH_TO_CERTS=/etc/routr/certs
ARG PATH_TO_LOGS=/opt/routr/logs
ARG CA_CERT_SUBJECT="/CN=Self Signed CA"
ARG SERVER_CERT_SUBJECT="/CN=localhost"

ENV PKCS12_PASSWORD=$PKCS12_PASSWORD \
  PATH_TO_CERTS=$PATH_TO_CERTS \
  PATH_TO_LOGS=$PATH_TO_LOGS \
  CONFIG_PATH=/etc/routr/edgeport.yaml \
  CA_CERT_SUBJECT=$CA_CERT_SUBJECT \
  SERVER_CERT_SUBJECT=$SERVER_CERT_SUBJECT \
  IGNORE_LOOPBACK_FROM_LOCALNETS=true \
  LOG4J2=/etc/routr/log4j2.yaml \
  JAVA_HOME=/opt/routr/jre

WORKDIR /opt/routr

COPY --from=builder /work/jre jre
COPY mods/edgeport/libs /opt/routr/libs
COPY mods/edgeport/edgeport.sh .
COPY mods/edgeport/etc/log4j2.yaml /etc/routr/log4j2.yaml
COPY .scripts/convert-to-p12.sh .
COPY .scripts/generate-certs.sh .

RUN apk add --no-cache tini openssl curl sed sngrep libcap \
  && curl -L -o heplify https://github.com/sipcapture/heplify/releases/download/v1.65.10/heplify \
  && chmod +x heplify \
  && chmod +x edgeport.sh convert-to-p12.sh generate-certs.sh \
  && mkdir -p ${PATH_TO_CERTS} ${PATH_TO_LOGS} \
  && setcap 'CAP_NET_RAW+eip' /usr/bin/sngrep \
  && chown -R 1000:3000 ${PATH_TO_CERTS} ${PATH_TO_LOGS} \
  && chmod 700 ${PATH_TO_CERTS} ${PATH_TO_LOGS} \
  && apk del curl libcap

USER 1000:3000

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

CMD ["sh", "-c", "set -e && \
  # Hotfix: Skipped until we find a way to avoid the error "resource busy" when running with compose
  # sed -i 's|keyStorePassword: .*|keyStorePassword: ${PKCS12_PASSWORD}|g' ${CONFIG_PATH} && \
  # sed -i 's|trustStorePassword: .*|trustStorePassword: ${PKCS12_PASSWORD}|g' ${CONFIG_PATH} && \
  ./convert-to-p12.sh $PATH_TO_CERTS $PKCS12_PASSWORD && \
  if [ -n \"$HEPLIFY_OPTIONS\" ]; then \
    ./heplify $HEPLIFY_OPTIONS & \
  fi && \
  /opt/routr/edgeport.sh"]
