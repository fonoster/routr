##
## Build and pack the service
##
FROM alpine:3.18 as builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk
WORKDIR /work

COPY .scripts/custom-jre.sh .

RUN apk add --no-cache --update openjdk11-jdk \
  && sh custom-jre.sh

##  
## Runner
##
FROM alpine:3.18 as runner 

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

# TODO: We need to find a way to avoid hardcoding the user and group ids
# and still be able to run the container as a non-root user
RUN apk add --no-cache tini openssl curl \
  && curl -L -o heplify https://github.com/sipcapture/heplify/releases/download/v1.65.10/heplify \
  && chmod +x heplify \
  && chmod +x edgeport.sh convert-to-p12.sh generate-certs.sh \
  && mkdir -p $PATH_TO_CERTS $PATH_TO_LOGS \
  && chown -R 1000:3000 $PATH_TO_CERTS $PATH_TO_LOGS \
  && chmod 700 $PATH_TO_CERTS $PATH_TO_LOGS \
  && apk del curl

USER 1000:3000

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["sh", "-c", "set -e && \
  ./convert-to-p12.sh $PATH_TO_CERTS $PKCS12_PASSWORD && \
  if [ -n \"$HEPLIFY_OPTIONS\" ]; then \
    ./heplify $HEPLIFY_OPTIONS & \
  fi && \
  /opt/routr/edgeport.sh"]
