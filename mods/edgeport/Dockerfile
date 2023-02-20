FROM eclipse-temurin:11-jre-alpine

RUN mkdir -p /opt/routr && apk add --no-cache --update tini sngrep curl

WORKDIR /opt/routr

COPY ./libs /opt/routr/libs
COPY ./edgeport.sh /opt/routr

RUN chmod +x /opt/routr/edgeport.sh

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["/opt/routr/edgeport.sh"]

HEALTHCHECK --interval=5s --timeout=2s --retries=2 \
  CMD ["curl", "--fail", "--silent", "--show-error", "--connect-timeout", "2", "-L", "http://localhost:8080/health"]