FROM debian:8.7
MAINTAINER Pedro Sanders <fonosterteam@fonoster.com>

ENV LANG C.UTF-8
ENV PATH=/opt/gradle/bin:${PATH}

RUN echo "deb http://http.debian.net/debian jessie-backports main" >> /etc/apt/sources.list
RUN apt-get update
RUN apt-get install curl -y && apt-get install unzip -y
RUN curl -sL https://services.gradle.org/distributions/gradle-4.5-bin.zip > gradle-4.5-bin.zip
RUN mkdir /opt/gradle && unzip gradle-4.5-bin.zip && mv gradle-4.5/* /opt/gradle
RUN apt-get install -t jessie-backports openjdk-8-jdk -y
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install nodejs -y

COPY . /opt/sipio
WORKDIR /opt/sipio
RUN npm i && npm test

# Cleanup
RUN apt-get remove unzip curl nodejs -y && apt-get clean && rm -rf /opt/gradle \
    rm -rf .babelrc _config.yml mod node_modules CODE_OF_CONDUCT.md CONTRIBUTING.md docker-compose.yml \
        Dockerfile pack.sh webpack.config.js build.gradle *.iml *.ipr *.iws *.json

RUN chmod +x run.sh
EXPOSE 5060
CMD ["./run.sh"]
