FROM alpine
MAINTAINER Pedro Sanders <fonosterteam@fonoster.com>

ENV LANG C.UTF-8
ENV PATH=/opt/gradle/bin:${PATH}
ENV PATH $PATH:/usr/lib/jvm/java-1.8-openjdk/jre/bin:/usr/lib/jvm/java-1.8-openjdk/bin
ENV CTL_VERSION 1.0.1-alpha

COPY . /opt/sipio
COPY etc/api-access.json /root/.sipio-access.json
COPY etc/salt /root/.sipio.salt
WORKDIR /opt/sipio

RUN wget https://services.gradle.org/distributions/gradle-4.5-bin.zip  \
    && mkdir -p /opt/gradle \
    && unzip gradle-4.5-bin.zip \
    && mv gradle-4.5/* /opt/gradle \
    && rm gradle-4.5-bin.zip \
    && apk add --update openjdk8 nodejs nodejs-npm redis \
    && npm i && npm test && npm prune && rm -rf node_modules \
    && apk del nodejs nodejs-npm \
    && wget https://github.com/fonoster/sipioctl/releases/download/$CTL_VERSION/sipioctl.$CTL_VERSION.tar.gz \
    && tar xvf sipioctl.$CTL_VERSION.tar.gz \
    && mv sipioctl.$CTL_VERSION/sipioctl . \
    && mv sipioctl.$CTL_VERSION/libs/* libs \
    && rm -rf sipioctl.$CTL_VERSION \
        /var/cache/apk/* \
        sipioctl.$CTL_VERSION.tar.gz \
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
