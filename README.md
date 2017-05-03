[![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Sip I/O: Modern SIP Server

<a href="https://github.com/psanders/sip.io"><img src="https://raw.githubusercontent.com/psanders/sip.io/master/logo.png" align="left" hspace="10" vspace="2" width="120" style="margin-right: 50px"></a>

**Sip I/O** is a modern sip proxy, location server, and registrar that aims to be container friendly and easy to use by 
developers and VoIP implementors. At the moment you can add your sip devices and group them using domains and connect with the PSTN using a Sip Gateway. To learn some key concepts and get up and running please see the [wiki](https://github.com/psanders/sip.io/wiki/Home)

> This software is in its very early stage and is not recommended for production

## Requirements

* Java 1.9 +
* Gradle

Why Java 9? This project's objective is to test Nashorn Javascript Engine, and more specifically the ES6 features, in a real life scenario. These features are only available in latest and greatest version of Java.

## Installation

Run the following commands to download the repository and get the dependencies

```bash
git clone https://github.com/psanders/sip.io.git
cd sip.io
gradle getDeps
```

> You must install Java 9 and point your JAVA_HOME to your JDK 9 to run this app. You can overwrite the JAVA_HOME at the 
> file `./sipio` and `./sipioctl`

## Author
 - [Pedro Sanders](https://github.com/psanders)

Contributions

 - Please see [Contribution Documents](https://github.com/psanders/sip.io/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/psanders/sip.io/graphs/contributors)

## Copyright
Copyright (C) 2017 by [Pedro Sanders](https://github.com/psanders). MIT License (see [LICENSE](https://github.com/psanders/sip.io/blob/master/LICENSE) for details).
