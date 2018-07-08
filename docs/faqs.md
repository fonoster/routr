---
id: faqs
title: Frequently asked questions
---

Here is a list of common questions we get.

## 1. How do I change the server's password?

If you are using the `files_data_provider` then you must change the password in the `users.yml` file. For the `redis_data_provider` follow this steps:

First run the command `redis-cli smembers users` to obtain the reference to the user. Here is an example:

```
$ redis-cli smembers users
1) "5aa69ead8fd6861d92385bac"
```
Then, retrieve the document for reference running `redis-cli get {REF}`. For example

```
$ redis-cli get 5aa69ead8fd6861d92385bac
"{\"apiVersion\":\"v1beta1\",\"kind\":\"User\",\"metadata\":{\"name\":\"Ctl\",\"ref\":\"5aa69ead8fd6861d92385bac\"},\"spec\":{\"credentials\":{\"username\":\"admin\",\"secret\":\"oldpass\"}}}"
```

Finally, search and change the old password and update your document using `redis-cli set {REF} {DOCUMENT}`. Like this:

```
$ redis-cli set 5aa69ead8fd6861d92385bac
"{\"apiVersion\":\"v1beta1\",\"kind\":\"User\",\"metadata\":{\"name\":\"Ctl\",\"ref\":\"5aa69ead8fd6861d92385bac\"},\"spec\":{\"credentials\":{\"username\":\"admin\",\"secret\":\"newpass\"}}}"
```

> A new token will be issued after your next login with `rctl`

## 2. How can I use `rctl` from a remote host?

By default Routr installs a certificate that only allows for connections using the `localhost` or `127.0.0.1`. To use `rctl` tool from a remote host, you must generate a certificate that accepts connections to the desired domain name or ip and update the `spec.restService` section of the `config.yml`.

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
