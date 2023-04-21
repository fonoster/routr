#!/bin/bash

set -e

storePassword="changeme"
alias="yourAlias"
keyalg="RSA"
keysize=2048
validity=365
dname="CN=example.com, OU=Example Org Unit, O=Example Org, L=City, ST=State, C=Country"
ext="san=dns:localhost,ip:127.0.0.1"

# Create keystore and generate self-signed certificate
keytool -genkeypair -alias "$alias" -keyalg "$keyalg" -keysize "$keysize" -validity "$validity" \
 -dname "$dname" -keystore keystore.jks -storetype PKCS12 -storepass "$storePassword" -keypass "$storePassword" \
 -ext "$ext"

# Export the certificate from keystore
keytool -exportcert -alias "$alias" -keystore keystore.jks -storepass "$storePassword" -file server.crt

# Create truststore and import the certificate
keytool -importcert -alias "$alias" -file server.crt -keystore domains-cert.jks -storetype PKCS12 -storepass "$storePassword" -noprompt

# Clean up
rm server.crt keystore.jks

echo "certificates have been successfully created."
