#!/bin/sh

set -e

certPath=${1:-"."}
serverCrt="$certPath/server.crt"
serverKey="$certPath/server.key"
caCrt="$certPath/ca.crt"
pkcs12File="$certPath/signaling.p12"
pkcs12Password=${2:-"changeme"}

mkdir -p $certPath

if [ ! -f "$serverCrt" ] || [ ! -f "$serverKey" ]; then
  echo "server.crt or server.key files not found. Generating certificates..."
  . "$(dirname "$0")/generate-certs.sh" "$certPath"
fi

if [ -f "$caCrt" ]; then
  echo "ca.crt file found. Creating a full chain of certificates..."
  cat $serverCrt $caCrt > "$certPath/fullchain.crt"
  openssl pkcs12 -export -in "$certPath/fullchain.crt" -inkey $serverKey -name "apiserver" -out $pkcs12File -password pass:$pkcs12Password
else
  openssl pkcs12 -export -in $serverCrt -inkey $serverKey -name "apiserver" -out $pkcs12File -password pass:$pkcs12Password
fi

openssl pkcs12 -info -in "$pkcs12File" -noout -passin pass:"$pkcs12Password" # Verifies the keystore

echo "PKCS12 keystore has been created at $pkcs12File"
