FROM debian:buster-20200414-slim
LABEL maintainer="Pedro Sanders <fonosterteam@fonoster.com>"

ENV LANG C.UTF-8
ARG ROUTR_VERSION=1.0.0-rc5

RUN mkdir -p /opt/routr
WORKDIR /opt/routr

COPY routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz .

RUN apt-get update \
    && apt-get install -y netcat-openbsd \
    && tar xvf routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz \
    && mv routr-${ROUTR_VERSION}_linux-x64_bin/* . \
    && rm -rf routr-${ROUTR_VERSION}_linux-x64_bin.tar.gz \
       routr-${ROUTR_VERSION}_linux-x64_bin \
       routr.bat \
    && apt-get autoremove -y

EXPOSE 4567
EXPOSE 5060/udp
EXPOSE 5060
EXPOSE 5061
EXPOSE 5062
EXPOSE 5063

CMD ["./routr"]
