FROM openjdk:15-ea-10-jdk-alpine3.11
LABEL maintainer="Pedro Sanders <fonosterteam@fonoster.com>"

# TODO: Revert to use stable version
RUN apk add --update nodejs git npm bash netcat-openbsd; \
  npm -g install fonoster/routr-ctl --unsafe-perm; \
  rm -rf /var/cache/apk/* /tmp/* /var/tmp/*;
