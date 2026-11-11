#!/bin/sh
# Publishes a Routr 3 alpha's images to Docker Hub: every image release.yaml's docker matrix
# builds from the Go tree, the migrations image included, for amd64 and arm64, tagged with
# the alpha only (never latest). The Go Echo (the SDK's example processor, which the
# benchmarks run) goes out as routr-echo:<version>-go: routr-echo:<version> is the Node one. release.yaml runs on main and is dormant on v3, so a
# maintainer runs this by hand from the repository root, on the commit tagged v<version>,
# after `docker login`. It uses the current buildx builder (BUILDX_BUILDER selects another).
#
#   .scripts/publish-alpha.sh [--dry-run] <version> [image...]
#
#   .scripts/publish-alpha.sh 3.0.0-alpha.6                          # every image
#   .scripts/publish-alpha.sh --dry-run 3.0.0-alpha.6                # print, push nothing
#   .scripts/publish-alpha.sh 3.0.0-alpha.5 routr-pgdata-migrations  # one image
#
# The chart's migrations hook pulls routr-pgdata-migrations at the chart's appVersion, so an
# alpha without it can't be installed with the chart.

set -e

IMAGES="routr-edgeport routr-one routr-dispatcher routr-location routr-connect routr-pgdata \
routr-registry routr-requester routr-rtprelay routr-pgdata-migrations routr-echo"

usage() {
  echo "usage: $0 [--dry-run] <3.0.0-alpha.N> [image...]" >&2
  echo "images: $IMAGES" >&2
  exit 1
}

dockerfile() {
  case "$1" in
    routr-one) echo cmd/routr-one/Dockerfile ;;
    routr-pgdata) echo cmd/data/Dockerfile ;;
    routr-pgdata-migrations) echo ops/pgdata-migrations/Dockerfile ;;
    routr-echo) echo pkg/processor/examples/echo/Dockerfile ;;
    routr-edgeport | routr-dispatcher | routr-location | routr-connect | routr-registry | \
      routr-requester | routr-rtprelay) echo "cmd/${1#routr-}/Dockerfile" ;;
    *) return 1 ;;
  esac
}

# The tag of an image: the alpha, with -go for the Echo built from the Go SDK
tag() {
  case "$1" in
    routr-echo) echo "$2-go" ;;
    *) echo "$2" ;;
  esac
}

dry_run=false
if [ "$1" = "--dry-run" ]; then
  dry_run=true
  shift
fi

version="$1"
case "$version" in
  3.0.0-alpha.*) ;;
  *) usage ;;
esac
case "${version#3.0.0-alpha.}" in
  "" | *[!0-9]*) usage ;;
esac
shift

[ $# -gt 0 ] && IMAGES="$*"
for image in $IMAGES; do
  dockerfile "$image" > /dev/null || { echo "unknown image: $image" >&2; usage; }
done

echo "Publishing $version from $(git rev-parse --short HEAD 2>/dev/null || echo "an unknown commit")"
for image in $IMAGES; do
  set -- docker buildx build --platform linux/amd64,linux/arm64 --build-arg "VERSION=$version" \
    -f "$(dockerfile "$image")" -t "fonoster/$image:$(tag "$image" "$version")" --push .
  echo "$*"
  [ "$dry_run" = true ] || "$@"
done
