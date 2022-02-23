FROM eclipse-temurin:11-jre-alpine

RUN mkdir -p /opt/routr && apk add --no-cache --update tini
WORKDIR /opt/routr

COPY ./libs /opt/routr/libs
COPY ./edgeport.sh /opt/routr

RUN chmod +x /opt/routr/edgeport.sh

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["/opt/routr/edgeport.sh"]
