#!/bin/sh
# Runs a command until it succeeds, at most <attempts> times, waiting <delay-seconds>
# between attempts. Exits 0 on the first success, or with the last exit code once the
# attempts are used up. The Release workflow retries its npm publish through it, since
# Sigstore can reject a provenance upload with a 409 that a later attempt gets past.
#
#   .scripts/retry.sh <attempts> <delay-seconds> <command...>

attempts="$1"
delay="$2"
shift 2 2>/dev/null || { echo "usage: $0 <attempts> <delay-seconds> <command...>"; exit 1; }
[ -z "$1" ] && { echo "usage: $0 <attempts> <delay-seconds> <command...>"; exit 1; }

attempt=1
until "$@"; do
  code=$?
  if [ "$attempt" -ge "$attempts" ]; then
    exit "$code"
  fi
  echo "Attempt $attempt of $attempts failed; retrying in ${delay}s"
  sleep "$delay"
  attempt=$((attempt + 1))
done
