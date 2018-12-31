There are no special requirements to install the server. Just download, decompress, and move the folder to a location of your choice.

## Download the Server

| Platform | Download |
| -- | -- |
| Linux | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_linux-x64_bin.tar.gz) |  
| macOS | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_osx-x64_bin.tar.gz) |  
| Windows | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_windows-x64_bin.tar.gz), [zip](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_windows-x64_bin.zip) |  
| Docker | [img](https://hub.docker.com/r/fonoster/routr/) |  

## Or Build from Source

> Building from source requires of Java 1.8+, Gradle, and NPM

```bash
git clone https://github.com/fonoster/routr
cd routr
npm i
npm run pack
```

## Running with Docker

```bash
docker pull fonoster/routr
docker run -it \
    -p 4567:4567 \
    -p 5060:5060 \
    -p 5060:5060/udp \
    -p 5061-5063:5061-5063 \
    -e ROUTR_EXTERN_ADDR=${your host address} \
    fonoster/routr
```

## Running in any other Plattform

To start the server just run the script `./routr` at the root of this
project. Your output will look similar to this:

```bash
$ ./routr
[INFO ] Starting Routr
[INFO ] Listening @ 172.18.0.4:5060 [udp]
[INFO ] Listening @ 172.18.0.4:5060 [tcp]
[INFO ] Listening @ 172.18.0.4:5061 [tls]
[INFO ] Starting Location service
[INFO ] Starting Registry service
[INFO ] Starting Restful service on port 4567
```
