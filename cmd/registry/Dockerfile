##
## The Registry of Routr 3 (fonoster/routr-registry). Build it from the repository root:
##
##   docker build -f cmd/registry/Dockerfile -t routr-registry .
##
## It sends the periodic REGISTER of the Trunks and serves only the chart's probe (GET
## /healthz, port 8080). Its only input is /etc/routr/registry.yaml (config/registry.yaml).
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
    -o /out/registry ./cmd/registry

##
## Runner
##
FROM alpine:3.23 AS runner

ENV CONFIG_PATH="/etc/routr/registry.yaml"

WORKDIR /opt/routr

COPY --from=builder /out/registry /opt/routr/registry

RUN apk add --no-cache tini \
  && mkdir -p /etc/routr \
  && chown -R 1000:3000 /etc/routr /opt/routr

USER 1000:3000

EXPOSE 8080/tcp

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

CMD ["/opt/routr/registry"]
