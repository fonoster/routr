By default, Routr installs a certificate that only allows for connections using the `localhost` or `127.0.0.1`. To use `rctl` tool from a remote host, you must generate a certificate that accepts connections to the desired domain name or IP and then update the `spec.restService` section of the `config.yml`.

Here is an example using a self-signed certificate(usually enough).

```bash
keytool -genkey -keyalg RSA \
-noprompt \
-alias routr \
-keystore api-cert.jks \
-storepass changeit \
-keypass changeit \
-validity 365 \
-keysize 2048 \
-dname "CN=domain.com, OU=OSS, O=Your Company Inc, L=Sanford, ST=NC, C=US" \
-ext SAN=dns:your.domain.com,dns:localhost,ip:127.0.0.1
```

> Remember to place the certificate in the `etc/certs` folder
