#!/bin/sh

certPath=${1:-"."} # if $1 is not passed, use current directory
serverCrt="$certPath/server.crt"
serverKey="$certPath/server.key"
caCrt="$certPath/ca.crt" # Path to the Certificate Authority certificate
pkcs12File="$certPath/signaling.p12"
pkcs12Password=${2:-"changeme"} # if $2 is not passed, use "changeme"

mkdir -p $certPath

# Check if server.crt and server.key files exist
if [ ! -f "$serverCrt" ] || [ ! -f "$serverKey" ]; then
  echo "server.crt or server.key files not found. Generating certificates..."
  . "$(dirname "$0")/generate-certs.sh" $certPath
fi

# Check if ca.crt file exists to create a full chain of certificates
if [ -f "$caCrt" ]; then
  echo "ca.crt file found. Creating a full chain of certificates..."
  cat $serverCrt $caCrt > "$certPath/fullchain.crt"
  openssl pkcs12 -export -in "$certPath/fullchain.crt" -inkey $serverKey -name "apiserver" -out $pkcs12File -password pass:$pkcs12Password
else
  openssl pkcs12 -export -in $serverCrt -inkey $serverKey -name "apiserver" -out $pkcs12File -password pass:$pkcsPassword
fi

echo "PKCS12 keystore has been created at $pkcs12File"
