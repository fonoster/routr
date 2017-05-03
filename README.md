Sip I/O is an Open Source project sponsored by [Fonoster, INC](https://fonoster.com). If you are interested in building communication systems using SIP you may also want to check [Astive Toolkit](https://github.com/fonoster/astivetoolkit) Asterisk's media controller and application server.

> This software is in its very early stage and is not recommended for production

# Sip I/O

Sip I/O is a modern sip proxy, location server, and registrar that aims to be container friendly and easy to use by 
developers and VoIP implementors.

At the moment you can add your sip devices and group them using domains. You can also connect with the PSTN using a 
Sip Gateway. To learn some key concepts and get up and running, check out the following tutorials:

* [Getting started with Sip I/O](https://github.com/psanders/sip.io/wiki/Tutorial:-Getting-Started-With-Astivlets)
* [How to get Sip I/O up and running](https://github.com/fonoster/astivetoolkit/wiki/Tutorial:-How-to-get-ATK-up-and-running)
* [Deployment Scenarios](https://github.com/fonoster/astivetoolkit/wiki/Tutorial:-Exploring-the-capabilities-of-the-Menu-API)

## Requirements

* Java 1.9 +
* Gradle

Why Java 9? As I mentioned before this is an experimental project. My objective is to test Nashorn Javascript Engine, 
and more specifically the ES6 features, in a real life scenario. These features are only available in latest and greatest 
version of Java.

## Installation

Run the following commands to download repository and get the dependencies

```bash
git clone https://github.com/psanders/sip.io.git
cd sip.io
gradle getDeps
```

You must install Java 9 and point your JAVA_HOME to your JDK 9 to run this app. You can overwrite the JAVA_HOME at the 
file `./sipio` and `./sipioctl`

## Author
 - [Pedro Sanders](https://github.com/psanders)

Contributions

 - Please see [Contribution Documents](https://github.com/psanders/sip.io/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/psanders/sip.io/graphs/contributors)

## Copyright
Copyright (C) 2017 by [Pedro Sanders](https://github.com/psanders). MIT License (see [LICENSE](https://github.com/psanders/sip.io/blob/master/LICENSE) for details).
