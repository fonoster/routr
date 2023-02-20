FROM alpine:3.15
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

COPY . /scripts
WORKDIR /scripts

RUN apk add --no-cache --update git curl tini nodejs npm python3 make cmake g++ \
  && npm pack \
  && npm install -g routr-*.tgz \
  && link /usr/local/bin/run_registry /usr/local/bin/run \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/* \
  && apk del git python3 make cmake g++

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["run"]

HEALTHCHECK --interval=5s --timeout=2s --retries=2 \
  CMD ["curl", "--fail", "--silent", "--show-error", "--connect-timeout", "2", "-L", "http://localhost:8080/health"]