[![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Sip I/O: Lightweight SIP Server

<a href="https://github.com/psanders/sip.io"><img src="https://raw.githubusercontent.com/wiki/psanders/sip.io/images/logo.png" align="left" hspace="10" vspace="5" width="80" style="margin-right: 20px;"></a>

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. To learn the basics and get up and running please see the [wiki](https://github.com/psanders/sip.io/wiki/Home). To get involve in the development of this project, please contact me at [@sandedro](https://twitter.com/sandedro)

> This software is in its very early stage and is not recommended for production

## Requirements

* Java 1.9 +
* Gradle

Why Java 9? **Sip I/O** uses Oracle Nashorn Javascript Engine to take advantage of several ES6 features. These features are only available in latest and greatest version of Java.

## Installation

Run the following commands to download the repository and get the dependencies

```bash
git clone https://github.com/psanders/sip.io.git
cd sip.io
gradle getDeps
```

> You must install Java 9 and point your JAVA_HOME to your JDK 9 to run this app. You can overwrite the JAVA_HOME at the 
> file `./sipio` and `./sipioctl`

## Issues and Bug Reports

To report a bug or make a request for new features, use the Issues Page in the Sip **I/O** Github project:

https://github.com/psanders/sip.io/issues

## Author
 - [Pedro Sanders](https://github.com/psanders)

Contributions

 - Please see [Contribution Documents](https://github.com/psanders/sip.io/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/psanders/sip.io/graphs/contributors)

## Copyright
Copyright (C) 2017 by [Pedro Sanders](https://github.com/psanders). MIT License (see [LICENSE](https://github.com/psanders/sip.io/blob/master/LICENSE) for details).
