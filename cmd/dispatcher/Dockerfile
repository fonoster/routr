##
## The Message Dispatcher of Routr 3 (fonoster/routr-dispatcher). Build it from the
## repository root:
##
##   docker build -f cmd/dispatcher/Dockerfile -t routr-dispatcher .
##
## Same port (51901), config path (/etc/routr/dispatcher.yaml) and user (1000:3000) as
## Routr 2's dispatcher image. The YAML is the only input: the environment is not read.
##
# The builder runs on the build machine and cross-compiles for the target platform
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

# protos/ is not copied: the stubs in internal/common/pb are committed
COPY cmd/ cmd/
COPY internal/ internal/
COPY lerna.json /lerna.json

# Defaults to the Lerna version, the version every Routr image carries
ARG VERSION=""
ARG TARGETOS
ARG TARGETARCH
RUN version="${VERSION:-$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' /lerna.json)}" \
  && CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w -X main.version=${version}" \
    -o /out/dispatcher ./cmd/dispatcher

##
## Runner
##
FROM alpine:3.23 AS runner

ENV CONFIG_PATH="/etc/routr/dispatcher.yaml"

WORKDIR /opt/routr

COPY --from=builder /out/dispatcher /opt/routr/dispatcher

RUN apk add --no-cache tini \
  && mkdir -p /etc/routr /var/routr/traces \
  && chown -R 1000:3000 /etc/routr /opt/routr /var/routr

USER 1000:3000

EXPOSE 51901/tcp

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

CMD ["/opt/routr/dispatcher"]
