#!/usr/bin/env bash

set -e

export ROUTR_VERSION=$(node -e "console.log(require('./package.json').version)")

build_for_platform() {
    PLATFORM=$1
    DOWNLOAD_FILE=$2

    # ROUTR_VERSION is set at the CI/CD process
    BUILD_NAME="routr-$ROUTR_VERSION""_$PLATFORM-x64_bin"

    # Remove old build
    rm -rf $BUILD_NAME
    mkdir -p $BUILD_NAME/libs
    mkdir $BUILD_NAME/config
    mkdir $BUILD_NAME/etc

    # Build and pack
    cp -a config/*.yml $BUILD_NAME/config
    cp -a config/stack.properties $BUILD_NAME/config/stack.properties
    cp -a etc/certs $BUILD_NAME/etc
    cp -a etc/schemas $BUILD_NAME/etc
    cp libs/* $BUILD_NAME/libs
    cp routr $BUILD_NAME/
    cp routr.bat $BUILD_NAME/
    cp README.md $BUILD_NAME/
    cp LICENSE $BUILD_NAME/
    wget -N "https://storage.googleapis.com/routr/$DOWNLOAD_FILE"
    tar xvf $DOWNLOAD_FILE
    mv jre-$PLATFORM $BUILD_NAME/jre
    tar -czvf $BUILD_NAME.tar.gz $BUILD_NAME
    zip -r $BUILD_NAME.zip $BUILD_NAME
    rm -rf $BUILD_NAME
}

build_for_platform 'windows' 'jre-11.0.10_windows-x64_bin.tar.gz'
build_for_platform 'linux' 'jre-11.0.10_linux-x64_bin.tar.gz'
build_for_platform 'osx' 'jre-11.0.9.1_osx-x64_bin.tar.gz'
