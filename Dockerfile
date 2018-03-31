FROM alpine
MAINTAINER Pedro Sanders <fonosterteam@fonoster.com>

ENV LANG C.UTF-8
ENV PATH=/opt/gradle/bin:${PATH}
ENV PATH $PATH:/usr/lib/jvm/java-1.8-openjdk/jre/bin:/usr/lib/jvm/java-1.8-openjdk/bin

COPY . /opt/sipio
WORKDIR /opt/sipio

RUN wget https://services.gradle.org/distributions/gradle-4.5-bin.zip  \
    && mkdir -p /opt/gradle \
    && unzip gradle-4.5-bin.zip \
    && mv gradle-4.5/* /opt/gradle \
    && rm gradle-4.5-bin.zip \
    && apk add --update openjdk8 nodejs nodejs-npm redis \
    && npm i && npm test && npm prune && rm -rf node_modules \
    && apk del nodejs nodejs-npm \
    && wget https://github.com/fonoster/sipioctl/releases/download/1.0.0-alpha/sipioctl.1.0.0-alpha.tar.gz \
    && tar xvf sipioctl.1.0.0-alpha.tar.gz \
    && mv sipioctl.1.0.0-alpha/sipioctl . \
    && mv sipioctl.1.0.0-alpha/libs/* libs \
    && rm -rf sipioctl.1.0.0-alpha \
        /var/cache/apk/* \
        sipioctl.1.0.0-alpha.tar.gz \
        /opt/gradle \
        .babelrc \
        mod \
        docker-compose.yml \
        Dockerfile \
        pack.sh \
        sipio.bat \
        webpack.config.js \
        build.gradle \
        *.json \
        gradle-4.5 \
        .gradle \
        build && \
        chmod +x run.sh

EXPOSE 4567
EXPOSE 5060/udp
EXPOSE 5060
EXPOSE 5061
EXPOSE 5062
EXPOSE 5063

CMD ["./run.sh"]
