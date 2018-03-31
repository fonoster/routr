#!/usr/bin/env bash

VERSION=1.0.0-M5

build_for_platform() {
    PLATFORM=$1
    DOWNLOAD_FILE=$2

    BUILD_NAME="sipio-$VERSION""_$PLATFORM-x64_bin"
    # Cleanup
    rm -rf $BUILD_NAME
    mkdir -p $BUILD_NAME/libs

    cp -a config $BUILD_NAME
    cp -a etc $BUILD_NAME
    cp libs/* $BUILD_NAME/libs
    cp sipio $BUILD_NAME/
    cp sipio.bat $BUILD_NAME/
    cp README.md $BUILD_NAME/
    cp LICENSE $BUILD_NAME/

    wget -N "https://storage.googleapis.com/sipio_assets/$DOWNLOAD_FILE"
    tar xvf $DOWNLOAD_FILE
    mv jre-$PLATFORM $BUILD_NAME/jre
    tar -czvf $BUILD_NAME.tar.gz $BUILD_NAME
    zip -r $BUILD_NAME.zip $BUILD_NAME
    rm -rf $BUILD_NAME
}

build_for_platform 'windows' 'jre-9.0.4_windows-x64_bin.tar.gz'
build_for_platform 'linux' 'jre-9.0.4_linux-x64_bin.tar.gz'
build_for_platform 'osx' 'jre-9.0.1_osx-x64_bin.tar.gz'
