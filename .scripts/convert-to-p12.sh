#!/bin/sh

certPath=${1:-"."} # if $1 is not passed, use current directory
serverCrt="$certPath/server.crt"
serverKey="$certPath/server.key"
pkcsFile="$certPath/signaling.p12"
pkcsPassword=${2:-"changeme"} # if $2 is not passed, use "changeme"

mkdir -p $certPath

# Check if server.crt and server.key files exist
if [ ! -f "$serverCrt" ] || [ ! -f "$serverKey" ]; then
  echo "server.crt or server.key files not found. Generating certificates..."
  . "$(dirname "$0")/generate-certs.sh" $certPath
fi

openssl pkcs12 -export -in $serverCrt -inkey $serverKey -name "apiserver" -out $pkcsFile -password pass:$pkcsPassword

echo "PKCS12 keystore has been created at $pkcsFile"
