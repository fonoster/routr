##
## The EdgePort of Routr 3 (fonoster/routr-edgeport). Build it from the repository root:
##
##   docker build -f cmd/edgeport/Dockerfile -t routr-edgeport .
##
## Same ports, config path (/etc/routr/edgeport.yaml) and user (1000:3000) as
## Routr 2's EdgePort image. It generates a self-signed server.crt and server.key
## in /etc/routr/certs when either is missing.
##
# The builder runs on the build machine and cross-compiles for the target platform
FROM --platform=$BUILDPLATFORM golang:1.26.11-alpine AS builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

WORKDIR /src

COPY go.mod go.sum ./
# -x prints each module as it downloads. The cache mount keeps the modules between builds,
# a failed one included, so a retry resumes; they stay out of the image layer, so go build
# mounts the same cache
RUN --mount=type=cache,target=/go/pkg/mod go mod download -x

# protos/ is not copied: the stubs in internal/common/pb are committed
COPY cmd/ cmd/
COPY internal/ internal/
COPY lerna.json /lerna.json

# Defaults to the Lerna version, the version every Routr image carries
ARG VERSION=""
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod version="${VERSION:-$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' /lerna.json)}" \
  && CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w -X main.version=${version}" \
    -o /out/edgeport ./cmd/edgeport

##
## Runner
##
FROM alpine:3.23 AS runner

ARG PATH_TO_CERTS="/etc/routr/certs"
ARG PATH_TO_LOGS="/opt/routr/logs"
ARG CA_CERT_SUBJECT="/CN=Self Signed CA"
ARG SERVER_CERT_SUBJECT="/CN=localhost"

ENV PATH_TO_CERTS=$PATH_TO_CERTS \
  PATH_TO_LOGS=$PATH_TO_LOGS \
  CONFIG_PATH="/etc/routr/edgeport.yaml" \
  CA_CERT_SUBJECT=$CA_CERT_SUBJECT \
  SERVER_CERT_SUBJECT=$SERVER_CERT_SUBJECT

WORKDIR /opt/routr

COPY --from=builder /out/edgeport /opt/routr/edgeport
COPY .scripts/generate-certs.sh .

RUN apk add --no-cache openssl tini \
  && chmod +x generate-certs.sh \
  && mkdir -p ${PATH_TO_CERTS} ${PATH_TO_LOGS} \
  && chown -R 1000:3000 ${PATH_TO_CERTS} ${PATH_TO_LOGS} \
  && chmod 700 ${PATH_TO_CERTS} ${PATH_TO_LOGS}

USER 1000:3000

EXPOSE 5060/udp 5060/tcp 5061/tcp 5062/tcp 5063/tcp 8080/tcp

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

# A self-signed server.crt and server.key when either is missing; the EdgePort
# serves certFile and keyFile as they are
CMD ["sh", "-c", "set -e && \
  if [ ! -f \"$PATH_TO_CERTS/server.crt\" ] || [ ! -f \"$PATH_TO_CERTS/server.key\" ]; then ./generate-certs.sh \"$PATH_TO_CERTS\"; fi && \
  exec /opt/routr/edgeport"]
