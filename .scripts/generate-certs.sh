#!/bin/sh

basepath=${1:-"."}  # if $1 is not passed, use current directory

mkdir -p $basepath

echo "Generating certificates in $basepath..."

openssl genrsa -out $basepath/ca.key 2048
openssl req -new -x509 -key $basepath/ca.key -out $basepath/ca.crt -subj "$CA_CERT_SUBJECT"
openssl genrsa -out $basepath/server.key 2048
openssl req -new -key $basepath/server.key -out $basepath/server.csr -subj "$SERVER_CERT_SUBJECT"
openssl x509 -req -in $basepath/server.csr -CA $basepath/ca.crt -CAkey $basepath/ca.key -CAcreateserial -out $basepath/server.crt

rm $basepath/server.csr

echo "Done."
