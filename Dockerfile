FROM alpine
MAINTAINER Pedro Sanders <fonosterteam@fonoster.com>

ENV LANG C.UTF-8
ENV PATH=/opt/gradle/bin:${PATH}
ENV PATH $PATH:/usr/lib/jvm/java-1.8-openjdk/jre/bin:/usr/lib/jvm/java-1.8-openjdk/bin
ENV CTL_VERSION 1.0.1-alpha

COPY . /opt/arke
COPY etc/api-access.json /root/.arke-access.json
COPY etc/salt /root/.arke.salt
WORKDIR /opt/arke

RUN wget https://services.gradle.org/distributions/gradle-4.5-bin.zip  \
    && mkdir -p /opt/gradle \
    && unzip gradle-4.5-bin.zip \
    && mv gradle-4.5/* /opt/gradle \
    && rm gradle-4.5-bin.zip \
    && apk add --update openjdk8 nodejs nodejs-npm redis \
    && npm i && npm test && npm prune && rm -rf node_modules \
    && apk del nodejs nodejs-npm \
    && wget https://github.com/fonoster/arkectl/releases/download/$CTL_VERSION/arkectl.$CTL_VERSION.tar.gz \
    && tar xvf arkectl.$CTL_VERSION.tar.gz \
    && mv arkectl.$CTL_VERSION/arkectl . \
    && mv arkectl.$CTL_VERSION/libs/* libs \
    && rm -rf arkectl.$CTL_VERSION \
        /var/cache/apk/* \
        arkectl.$CTL_VERSION.tar.gz \
        /opt/gradle \
        .babelrc \
        mod \
        docker-compose.yml \
        Dockerfile \
        pack.sh \
        arke.bat \
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
