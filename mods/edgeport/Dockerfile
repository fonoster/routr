FROM eclipse-temurin:11-jre-alpine

RUN mkdir -p /opt/routr && apk add --no-cache tini

WORKDIR /opt/routr

COPY mods/edgeport/libs /opt/routr/libs
COPY mods/edgeport/edgeport.sh .
COPY mods/edgeport/etc/log4j2.yaml /etc/routr/log4j2.yaml
COPY .scripts/convert-to-p12.sh .
COPY .scripts/generate-certs.sh .

RUN apk add --no-cache openssl \
  && chmod +x edgeport.sh convert-to-p12.sh generate-certs.sh

ARG PKCS_PASSWORD=changeme
ARG PATH_TO_CERTS=/etc/routr/certs

ENV PKCS_PASSWORD=$PKCS_PASSWORD
ENV PATH_TO_CERTS=$PATH_TO_CERTS
ENV CONFIG_PATH=/etc/routr/edgeport.yaml
ENV LOG4J2=/etc/routr/log4j2.yaml

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["sh", "-c", "set -e && ./convert-to-p12.sh $PATH_TO_CERTS $PKCS_PASSWORD && /opt/routr/edgeport.sh"]
