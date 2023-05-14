FROM eclipse-temurin:11-jre-alpine

RUN mkdir -p /opt/routr && apk add --no-cache tini

WORKDIR /opt/routr

COPY ./libs /opt/routr/libs
COPY ./edgeport.sh /opt/routr
COPY ./etc/log4j2.yaml /etc/routr/log4j2.yaml

RUN chmod +x /opt/routr/edgeport.sh

ENV CONFIG_PATH=/etc/routr/edgeport.yaml
ENV LOG4J2=/etc/routr/log4j2.yaml

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["/opt/routr/edgeport.sh"]
