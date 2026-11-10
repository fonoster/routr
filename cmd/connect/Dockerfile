##
## The Connect processor of Routr 3 (fonoster/routr-connect). Build it from the
## repository root:
##
##   docker build -f cmd/connect/Dockerfile -t routr-connect .
##
## Same port (51904) and user (1000:3000) as Routr 2's connect image. Routr 2's Connect
## read its settings from the environment (LOCATION_ADDR, API_ADDR, ...); this one reads
## them from /etc/routr/connect.yaml (config/connect.yaml), the only input.
##
# The builder runs on the build machine and cross-compiles for the target platform
FROM --platform=$BUILDPLATFORM golang:1.26.11-alpine AS builder
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
    -o /out/connect ./cmd/connect

##
## Runner
##
FROM alpine:3.23 AS runner

ENV CONFIG_PATH="/etc/routr/connect.yaml"

WORKDIR /opt/routr

COPY --from=builder /out/connect /opt/routr/connect

RUN apk add --no-cache tini \
  && mkdir -p /etc/routr \
  && chown -R 1000:3000 /etc/routr /opt/routr

USER 1000:3000

EXPOSE 51904/tcp

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

CMD ["/opt/routr/connect"]
