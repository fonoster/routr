#!/usr/bin/env bash
#
# Runs once after the dev container is created: fixes volume ownership, creates the
# TLS keystore EdgePort expects, and builds the project. Postgres, Redis, and RTPEngine are
# not started here: the commands that need them start them (see .scripts/deps.sh).
#
set -e

# Named volumes are created as root
sudo chown -R "$(id -u):$(id -g)" node_modules "$HOME/.gradle" "$HOME/.npm"

# config/edgeport.yaml reads its keystore from /etc/routr/certs/signaling.p12
if [ ! -f /etc/routr/certs/signaling.p12 ]; then
  sudo mkdir -p /etc/routr/certs
  sudo chown "$(id -u):$(id -g)" /etc/routr/certs
  CA_CERT_SUBJECT="/CN=Self Signed CA" SERVER_CERT_SUBJECT="/CN=localhost" \
    ./.scripts/convert-to-p12.sh /etc/routr/certs
fi

# Same as `npm run make`, minus its trailing `npm run setup`: `npm run build` already runs
# it (through prebundle), so the Gradle build would happen twice
npm ci
npm run build

echo "Ready. Run 'npm run test:echo' to check the setup."
