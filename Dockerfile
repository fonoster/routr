FROM alpine:latest
MAINTAINER Pedro Sanders <fonosterteam@fonoster.com>

ENV LANG C.UTF-8
ENV SERVER_VERSION 1.0.0-rc3

WORKDIR /opt/routr

RUN wget https://github.com/fonoster/routr/releases/download/$SERVER_VERSION/routr-${SERVER_VERSION}_linux-x64_bin.tar.gz \
    && tar xvf routr-${SERVER_VERSION}_linux-x64_bin.tar.gz \
    && mv routr-${SERVER_VERSION}_linux-x64_bin/* . \
    && rm -rf routr-${SERVER_VERSION}_linux-x64_bin.tar.gz \
       routr-${SERVER_VERSION}_linux-x64_bin \
       routr.bat

EXPOSE 4567
EXPOSE 5060/udp
EXPOSE 5060
EXPOSE 5061
EXPOSE 5062
EXPOSE 5063

CMD ["./routr"]
