FROM alpine:3.23
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

# Build context is the repository root. The @routr workspace packages this module
# depends on are packed from the checkout and installed together with it into one
# tree, so the image carries this commit's code for every @routr package, fetches
# none of them from npm, and keeps the shared dependencies deduplicated.
COPY mods/common/package.json /scripts/common/
COPY mods/common/dist /scripts/common/dist
COPY mods/processor/package.json /scripts/processor/
COPY mods/processor/dist /scripts/processor/dist
COPY mods/rtprelay/package.json /scripts/rtprelay/
COPY mods/rtprelay/dist /scripts/rtprelay/dist
WORKDIR /scripts

RUN apk add --no-cache cmake g++ git make nodejs npm python3 tini \
  && for m in common processor rtprelay; do npm pack --silent --pack-destination /scripts ./$m; done \
  && mkdir -p /opt/routr && cd /opt/routr \
  && echo '{"name":"routr-rtprelay-image","private":true}' > package.json \
  && npm install --omit=dev --no-audit --no-fund /scripts/routr-*.tgz \
  && ln -s /opt/routr/node_modules/.bin/run_rtprelay /usr/local/bin/run \
  && rm -rf /scripts /var/cache/apk/* /tmp/* /var/tmp/* \
  && apk del git python3 make cmake g++

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["run"]
