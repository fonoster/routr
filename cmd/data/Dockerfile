##
## The Data API of Routr 3 (fonoster/routr-data): the Connect gRPC services on Routr 2's
## apiserver port, over the files or the postgres backend. Build it from the repository
## root:
##
##   docker build -f cmd/data/Dockerfile -t routr-data .
##
## Same port (51907) and user (1000:3000) as Routr 2's simpledata and pgdata images. It
## reads spec.data of /etc/routr/data.yaml, the only input; the files backend reads the
## resources from the directory that section names, /etc/routr/resources in compose.yaml
## (mount config/resources there, as Routr 2's simpledata did).
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
    -o /out/data ./cmd/data

##
## Runner
##
FROM alpine:3.23 AS runner

ENV CONFIG_PATH="/etc/routr/data.yaml"

WORKDIR /opt/routr

COPY --from=builder /out/data /opt/routr/data

# /etc/routr/resources is where the files backend expects config/resources mounted
RUN apk add --no-cache tini \
  && mkdir -p /etc/routr/resources \
  && chown -R 1000:3000 /etc/routr /opt/routr

USER 1000:3000

EXPOSE 51907/tcp

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

CMD ["/opt/routr/data"]
