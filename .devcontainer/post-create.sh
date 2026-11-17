#!/usr/bin/env bash
#
# Runs once after the dev container is created: fixes volume ownership, creates the
# TLS certificate EdgePort expects, and builds the project. Postgres, Redis, and RTPEngine are
# not started here: the commands that need them start them (see .scripts/deps.sh).
#
set -e

# Named volumes are created as root
sudo chown -R "$(id -u):$(id -g)" node_modules "$HOME/.npm"

# config/edgeport.yaml serves /etc/routr/certs/server.crt and server.key
if [ ! -f /etc/routr/certs/server.crt ] || [ ! -f /etc/routr/certs/server.key ]; then
  sudo mkdir -p /etc/routr/certs
  sudo chown "$(id -u):$(id -g)" /etc/routr/certs
  CA_CERT_SUBJECT="/CN=Self Signed CA" SERVER_CERT_SUBJECT="/CN=localhost" \
    ./.scripts/generate-certs.sh /etc/routr/certs
fi

# Same as `npm run make` without its `npm install`
npm ci
npm run build

echo "Ready. Run 'npm run test:echo' to check the setup."
