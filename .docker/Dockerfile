FROM debian:buster-20190812
MAINTAINER Pedro Sanders <fonosterteam@fonoster.com>

ENV LANG C.UTF-8
ARG ROUTR_VERSION=1.0.0-rc4

WORKDIR /opt/routr

RUN apt-get update && apt-get install wget -y \
    && wget https://github.com/fonoster/routr/releases/download/${ROUTR_VERSION}/routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz \
    && tar xvf routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz \
    && mv routr-${ROUTR_VERSION}_linux-x64_bin/* . \
    && rm -rf routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz \
       routr-${ROUTR_VERSION}_linux-x64_bin \
       routr.bat \
    && apt-get purge wget -y \
    && apt-get autoremove -y

EXPOSE 4567
EXPOSE 5060/udp
EXPOSE 5060
EXPOSE 5061
EXPOSE 5062
EXPOSE 5063

CMD ["./routr"]
