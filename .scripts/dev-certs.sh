#!/bin/sh

# Creates the certificates the dev stack shares between the EdgePort and the SEET fake
# carrier. The EdgePort mounts the directory at /etc/routr/certs and builds its keystore
# from it at startup (convert-to-p12.sh), so the same server certificate ends up in its
# trust store. The fake carrier (SIPp inside the compliance container) serves that same
# certificate on its TLS port, which is how an outbound call over TLS is trusted.
#
# Usage: .scripts/dev-certs.sh [dir]   (defaults to etc/certs)

set -e

basepath=${1:-"$(dirname "$0")/../etc/certs"}

if [ -f "$basepath/server.crt" ] && [ -f "$basepath/server.key" ]; then
  echo "Certificates already present in $basepath"
  exit 0
fi

export CA_CERT_SUBJECT=${CA_CERT_SUBJECT:-"/CN=Routr Dev CA"}
export SERVER_CERT_SUBJECT=${SERVER_CERT_SUBJECT:-"/CN=sip.provider.net"}

sh "$(dirname "$0")/generate-certs.sh" "$basepath"

# The EdgePort container runs as uid 1000 and writes the keystore next to these files.
chmod -R a+rwX "$basepath"
