##
## The EdgePort of Routr 3 (fonoster/routr-edgeport). Build it from the repository root:
##
##   docker build -f cmd/edgeport/Dockerfile -t routr-edgeport .
##
## Same ports, config path (/etc/routr/edgeport.yaml), environment, certificate
## handling (convert-to-p12.sh) and user (1000:3000) as Routr 2's EdgePort image.
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
    -o /out/edgeport ./cmd/edgeport

##
## Runner
##
FROM alpine:3.23 AS runner

ARG PKCS12_PASSWORD="changeme"
ARG PATH_TO_CERTS="/etc/routr/certs"
ARG PATH_TO_LOGS="/opt/routr/logs"
ARG CA_CERT_SUBJECT="/CN=Self Signed CA"
ARG SERVER_CERT_SUBJECT="/CN=localhost"

ENV PKCS12_PASSWORD=$PKCS12_PASSWORD \
  PATH_TO_CERTS=$PATH_TO_CERTS \
  PATH_TO_LOGS=$PATH_TO_LOGS \
  CONFIG_PATH="/etc/routr/edgeport.yaml" \
  CA_CERT_SUBJECT=$CA_CERT_SUBJECT \
  SERVER_CERT_SUBJECT=$SERVER_CERT_SUBJECT

WORKDIR /opt/routr

COPY --from=builder /out/edgeport /opt/routr/edgeport
COPY .scripts/convert-to-p12.sh .
COPY .scripts/generate-certs.sh .

RUN apk add --no-cache openssl tini \
  && chmod +x convert-to-p12.sh generate-certs.sh \
  && mkdir -p ${PATH_TO_CERTS} ${PATH_TO_LOGS} \
  && chown -R 1000:3000 ${PATH_TO_CERTS} ${PATH_TO_LOGS} \
  && chmod 700 ${PATH_TO_CERTS} ${PATH_TO_LOGS}

USER 1000:3000

EXPOSE 5060/udp 5060/tcp 5061/tcp 5062/tcp 5063/tcp 8080/tcp

# Re-mapping the signal from 143 to 0
ENTRYPOINT ["tini", "-v", "-e", "143", "--"]

CMD ["sh", "-c", "set -e && \
  ./convert-to-p12.sh $PATH_TO_CERTS $PKCS12_PASSWORD && \
  exec /opt/routr/edgeport"]
