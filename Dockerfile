FROM openjdk:alpine
MAINTAINER Pedro Sanders <fonosterteam@fonoster.com>

ENV LANG C.UTF-8
ENV PATH=/opt/gradle/bin:${PATH}

COPY . /opt/sipio
WORKDIR /opt/sipio

RUN wget https://services.gradle.org/distributions/gradle-4.5-bin.zip  \
    && mkdir -p /opt/gradle && unzip gradle-4.5-bin.zip && mv gradle-4.5/* /opt/gradle && rm gradle-4.5-bin.zip
RUN apk add --update nodejs nodejs-npm && npm i && npm test && npm prune && rm -rf node_modules && \
    rm -rf /opt/gradle \
    .babelrc \
    mod \
    docker-compose.yml \
    Dockerfile \
    pack.sh \
    webpack.config.js \
    build.gradle \
    *.json \
    gradle-4.5 \
    .gradle \
    build && \
    chmod +x run.sh

CMD ["./run.sh"]
