FROM eclipse-temurin:11-jre-alpine

ARG PKCS12_PASSWORD=changeme
ARG PATH_TO_CERTS=/etc/routr/certs
ARG PATH_TO_LOGS=/opt/routr/logs

ENV PKCS12_PASSWORD=$PKCS12_PASSWORD \
  PATH_TO_CERTS=$PATH_TO_CERTS \
  PATH_TO_LOGS=$PATH_TO_LOGS \
  CONFIG_PATH=/etc/routr/edgeport.yaml \
  LOG4J2=/etc/routr/log4j2.yaml

WORKDIR /opt/routr

COPY mods/edgeport/libs /opt/routr/libs
COPY mods/edgeport/edgeport.sh .
COPY mods/edgeport/etc/log4j2.yaml /etc/routr/log4j2.yaml
COPY .scripts/convert-to-p12.sh .
COPY .scripts/generate-certs.sh .

# TODO: We need to find a way to avoid hardcoding the user and group ids
# and still be able to run the container as a non-root user
RUN apk add --no-cache tini openssl \
  && chmod +x edgeport.sh convert-to-p12.sh generate-certs.sh \
  && mkdir -p $PATH_TO_CERTS $PATH_TO_LOGS \
  && chown -R 1000:3000 $PATH_TO_CERTS $PATH_TO_LOGS \
  && chmod 700 $PATH_TO_CERTS $PATH_TO_LOGS

USER 1000:3000

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["sh", "-c", "set -e && ./convert-to-p12.sh $PATH_TO_CERTS $PKCS12_PASSWORD && /opt/routr/edgeport.sh"]
