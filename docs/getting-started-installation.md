---
id: getting-started-installation
title: Installation
custom_edit_url: https://github.com/fonoster/sipio/edit/master/docs/getting-started-installation.md
---

There are no special requirements to install the server. Just download, decompress, and move the folder to a location of your choice.

## Download the Server

| Platform | Download |
| -- | -- |
| Linux | [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_linux-x64_bin.tar.gz) |  
| macOS | [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_osx-x64_bin.tar.gz) |  
| Windows | [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_windows-x64_bin.tar.gz), [zip](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_windows-x64_bin.zip) |  
| Docker | [img](https://hub.docker.com/r/fonoster/sipio/) |  

## Or Build from Source

> Building from source requires of Java 1.8+, Gradle, and NPM

```bash
git clone https://github.com/fonoster/sipio
cd sipio
npm i
npm run pack
```

## Running with Docker

```bash
docker pull fonoster/sipio
docker run -it \
    -p 4567:4567 \
    -p 5060:5060 \
    -p 5060:5060/udp \
    -p 5061-5063:5061-5063 \
    -e SIPIO_EXTERN_ADDR=${your host address} \
    fonoster/sipio
```

## Running in any other Plattform

To start the server just run the script `./sipio` at the root of this
project. Your output will look similar to this:

```bash
$ ./sipio
[INFO ] Starting Sip I/O
[INFO ] Listening @ 172.18.0.4:5060 [udp]
[INFO ] Listening @ 172.18.0.4:5060 [tcp]
[INFO ] Listening @ 172.18.0.4:5061 [tls]
[INFO ] Starting Location service
[INFO ] Starting Registry service
[INFO ] Starting Restful service on port 4567
```
