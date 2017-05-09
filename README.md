# Sip I/O: Lightweight SIP Server

<a href="https://github.com/psanders/sip.io"><img src="https://00e9e64bacc8bd4b229af857661f7a8a2f7ba50ab36017a638-apidata.googleusercontent.com/download/storage/v1/b/sipio/o/logo.svg?qk=AD5uMEtWXLj6lKk0CmzXfeQMprnXOCN9EFh_xrAEMM4NOWE1uB9Q0thNnmF3rcpcNuuksMr2DxSoGTqLklZYkjiw93yTWx8I2VFAK8mcS-qQxiMg6_cKelgZQHZtd1rJ1kw8OPbMr_36rZMUNuwlUSOSo0jlGRgBb-3nZq7kMh1uKuY1f3uTEpepV3CfvfcDgAYIlxcL9ntV7nWCHW1OsTBx-qzi4Tte-hWkKwTkyckaffMr7x0UNewt5SN7hLk9WNAhUh2mUF7Va5GWqaAD8uxjQzj3ZoTWd06uhWKo4uyiFhhrZzuIKqBrYXOZiyXAg-IbuIT293FwPTqAN-2BtzCmay-Jb1Dp2arKWhJtP_E-AXYVJ9nWMXf17GU0RpcvKgNenKQje1Q2KfckclGu6Yuzz2jAKXNeafIM_YB9z5JkYrCAR2MIhYFXO0oGc-Pg8U4Fv5rB-uNwjOqswxrGLFDwY-rsedtU_3iATGKeIcYbKABgg0MuvAlNGDclKSDi8DfdCG_IDppD5tjzpT7kJzhZYYJaiVrtQQP_y4iWo6v7DcVX21_rvka1JirKm_23idC2eLXkX5Hdd5OruKqW82GraXmBtc27jkk8QGlb3pzkuX0ooEKLQcPiyGfqO-L-yao89tz6n1gk3CG5k5ULHjalSmgwinbrMEy06aGPFgxyeoaIRysZMCtFewIBlo_Tq7ELr-EMacVHwO9ujuvhRs0TIRAddC8CFvxZx0N2a1GL7jLZL2f1djTd1id0GLRWX09wRCJ-z1bW" align="left" hspace="10" vspace="5" width="80" style="background-color: #fff"></a>

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. For a list of features and documentation about the project please visit the [wiki](https://github.com/psanders/sip.io/wiki/Home). To get involve in the development of this project, please contact me at [@sandedro](https://twitter.com/sandedro).

[![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

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

## Support

Please open an [issue](https://github.com/psanders/sip.io/issues) for support.

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/psanders/sip.io/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/psanders/sip.io/graphs/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## Copyright
Copyright (C) 2017 by [Pedro Sanders](https://github.com/psanders). MIT License (see [LICENSE](https://github.com/psanders/sip.io/blob/master/LICENSE) for details).
