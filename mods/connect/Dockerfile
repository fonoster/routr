FROM alpine:3.22
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

COPY . /scripts
WORKDIR /scripts

RUN apk add --no-cache cmake curl g++ git make nodejs npm python3 tini \
  && npm pack \
  && npm install -g routr-*.tgz \
  && ln -s /usr/local/bin/run_connect /usr/local/bin/run \
  && apk del git curl python3 make cmake g++ npm \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/*

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["run"]
