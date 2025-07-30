##
## Build and pack the service
##
FROM alpine:3.22 AS builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
WORKDIR /work

COPY .scripts/custom-jre.sh .

RUN apk add --no-cache --update g++ openjdk17-jdk \
  && sh custom-jre.sh

##  
## Runner
##
FROM alpine:3.22 AS runner

RUN mkdir -p /opt/routr && apk add --no-cache tini
WORKDIR /opt/routr

COPY mods/requester/libs /opt/routr/libs
COPY mods/requester/requester.sh /opt/routr
COPY mods/requester/etc/log4j2.yaml /etc/routr/log4j2.yaml
COPY --from=builder /work/jre jre

RUN chmod +x /opt/routr/requester.sh

ENV LOG4J2=/etc/routr/log4j2.yaml \
  JAVA_HOME=/opt/routr/jre

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["/opt/routr/requester.sh"]