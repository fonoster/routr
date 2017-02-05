# Sip I/O

This is a basic sip server built using Javascript over the JVM (with Nashorn). At the moment you can create sip 
accounts and you can group those accounts by domains.

# Current features include

Sip server features

    - Registrar server
    - Location server (In-memory)
    - Proxy server

Transport

    - UDP 

Security

    - Digest SIP User authentication
    - Domain security via ACL (Work in-progress)
    - I'm working on implementing TLS

# Requirement

* Java 1.9+
* Gradle

# Getting Started

To download repo and get the dependencies

```bash
git clone https://github.com/psanders/sip.io.git
cd sip.io
gradle getDeps
```

You must install Java 9 and point your JAVA_HOME to your JDK 9 to run this app. You can overwrite the JAVA_HOME
at the file ./app.

## Setting the Softphone or Sip endpoint

To test the app you can use any sip phone or softphone. Just use the username and secret from a sip account at `config/agents.yml`
and use the IP of the server running this app as the OUTBOUND SERVER.

## Run the App

Just run the `./app` script

```bash
./app
```

# License

I'm not sure yet.