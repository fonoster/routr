FROM ubuntu:latest
MAINTAINER = Pedro S. Sanders <psanders@fonoster.com>

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y software-properties-common python-software-properties
RUN add-apt-repository ppa:webupd8team/java
RUN apt-get update
RUN echo "oracle-java8-installer shared/accepted-oracle-license-v1-1 select true" | debconf-set-selections
RUN apt install -y oracle-java9-installer

ADD . /app
WORKDIR /app
VOLUME /app/config

CMD ./sipio
