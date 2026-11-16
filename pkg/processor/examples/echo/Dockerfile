##
## Echo, the Go SDK's example processor (fonoster/routr-echo:<version>-go): it answers every
## request with 200 OK, for tests and benchmarks. Build it from the repository root:
##
##   docker build -f pkg/processor/examples/echo/Dockerfile -t routr-echo:go .
##
## It listens on BIND_ADDR, 0.0.0.0:51904 when unset, as the Node Echo (mods/echo) does.
##
# The builder runs on the build machine and cross-compiles for the target platform
FROM --platform=$BUILDPLATFORM golang:1.26.11-alpine AS builder
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

WORKDIR /src

# The SDK is a module of its own (pkg/processor/go.mod)
COPY pkg/processor/go.mod pkg/processor/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download -x

COPY pkg/processor/ ./

ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} \
  go build -trimpath -ldflags "-s -w" -o /out/echo ./examples/echo

##
## Runner
##
FROM alpine:3.23 AS runner

COPY --from=builder /out/echo /opt/routr/echo

RUN apk add --no-cache tini

USER 1000:3000

EXPOSE 51904/tcp

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]
CMD ["/opt/routr/echo"]
