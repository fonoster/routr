FROM alpine:3.15
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

COPY . /scripts
WORKDIR /scripts

RUN apk add --no-cache --update curl tini nodejs npm python3 make cmake g++ \
  && npm pack \
  && npm install -g routr-*.tgz \
  && link /usr/local/bin/run_simpledata /usr/local/bin/run \
  && link /usr/local/bin/healthcheck_simpledata /usr/local/bin/healthcheck \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/* \
  && apk del curl python3 make cmake g++

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["run"]

HEALTHCHECK --start-period=5s --interval=5s --timeout=2s --retries=2 \
  CMD [ "healthcheck" ]