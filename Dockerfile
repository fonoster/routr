FROM debian:buster
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV TINI_VERSION v0.19.0
ENV LANG C.UTF-8
ARG ROUTR_VERSION=1.0.2

RUN mkdir -p /opt/routr
WORKDIR /opt/routr

COPY routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz .

RUN apt-get update \
    && tar xvf routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz \
    && mv routr-${ROUTR_VERSION}_linux-x64_bin/* . \
    && rm -rf routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz \
       routr-${ROUTR_VERSION}_linux-x64_bin \
       routr.bat \
    && apt-get install curl -y \
    && apt-get install netcat -y \
    && curl -qL -o /usr/bin/netdiscover https://github.com/CyCoreSystems/netdiscover/releases/download/v1.2.5/netdiscover.linux.amd64 \
    && chmod +x /usr/bin/netdiscover \
    && apt-get remove curl -y \
    && apt-get autoremove -y \
    && touch /.dockerenv

EXPOSE 4567
EXPOSE 5060/udp
EXPOSE 5060
EXPOSE 5061
EXPOSE 5062
EXPOSE 5063

ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "-v", "-e", "143", "--"]
CMD ["./routr"]
