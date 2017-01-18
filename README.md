# Sip I/O


This is a basic sip server built using JS with Oracle Nashorn. At the moment you can create sip accounts, which I call
agents, and you can group them by domain.

## Current features include

Sip server features

    - Registrar server
    - Location server
    - Proxy server

Transport

    - udp 

Security

    - Digest SIP User authentication
    - Domain security via ACL (in progress)
    - I'm trying to implement TLS

## Requirement

* Java 1.9+
* Gradle

## Getting Started

To download repo and get the dependencies

```bash
git clone https://github.com/psanders/sip.io.git
cd sip.io
gradle getDeps
```

You must install Java 9 and point your JAVA_HOME to your JDK 9 to run this app. You can overwrite the JAVA_HOME
at the file ./app.

# Setting the Softphone or Sip endpoint

To test the app you can use any sip phone or softphone. Just use the username and secret from a sip account at `config/agents.yml`
and use the IP of the server running this app as the OUTBOUND SERVER.

# Run the App

Just run the `./app`

```bash
./app
```

## License

I'm not sure yet.