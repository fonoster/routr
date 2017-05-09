# Sip I/O: Lightweight SIP Server

<a href="https://github.com/psanders/sip.io"><img src="https://00e9e64bacf2354659d5422cab1b73ef65e3f4e68b6aa21875-apidata.googleusercontent.com/download/storage/v1/b/sipio/o/logo.svg?qk=AD5uMEvPUR2h1ULiDMoHpwXjwcswLQwFAeLy_LAFDYgbVc3cXZVZ3vol4uJxSUVmuptftPeh-wGoIOPEDfer_Koqgg8_Ju1tIR-2GMBTurT2SaUqnI2PlLGkPNTeDFVGQT7zN6K4OzQucX2Pvo6EUTKpkscNEihdVK-_LiDxIBK57FYmLFP-TA57NmN3EwFHkUnMEf9_gNWg7G56KnAkwZumqDZJreesCEpk9UeLGgv--csx3zsRIfvqudJ2I5HU9tM6hCwKQ9Hn1QIQp4xYv5MelSLMNNzZtHkYiFesBSP88eDsqMbLsYpJblhoQOqns9dK--FDbowAdLsQhmf5-FULCGS5BHMlicYA9ba2x2x-6ig-UgbZR7bkWiz7aaYlL7PJe-419goJON2YlQ-MiELayWGtswfYF3YegcDHLG_iD2lXXsQGqj6o19V9kVBBYGw5CDGBVQKEn1xwX9C6rOnzWaFnDY1xCIpUOs_IxMhGg0GSq3hdMFmW92nEG0Np0XRyEu69lP7lJ9NLqHAHEQVe16hzZR-dUmW3KjA3WgXb-3CFQYPFaTE7PdlX1hVreP_vkQnBftNNZjsN24ZJSG62zQbaMzitrJqtGfY1nhtRhXI8q17I8kq7dUdw3bJMFJ2bNKpI_cDZlyVejDnTaEwOJk1iHLqyfVpQ67n4iavEjKgSxcYu1UY0n-oFRZ68nsjopQnmOA7eS3N7UggoKR43WyOuS60TnvRIpZ7kq8qSVyWmaLHfARZnvq9hlJEVbzddt8rcrSui" align="left" hspace="10" vspace="5" width="80" style="background-color: #fff"></a>

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. For a list of features and documentation about the project please visit the [wiki](https://github.com/psanders/sip.io/wiki/Home). To get involve in the development of this project, please contact me at [@sandedro](https://twitter.com/sandedro).

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
