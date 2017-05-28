#!/usr/bin/env bash

VERSION=1.0.0-M1
FOLDER_NAME=sipio.$VERSION

# Cleanup
rm -rf $FOLDER_NAME

mkdir -p $FOLDER_NAME/libs
cd $FOLDER_NAME/libs

wget https://raw.githubusercontent.com/nodyn/jvm-npm/master/src/main/javascript/jvm-npm.js

cd ../../

cp -a config $FOLDER_NAME
cp -a etc $FOLDER_NAME
cp libs/* $FOLDER_NAME/libs
cp sipio.js $FOLDER_NAME/
cp sipioctl.js $FOLDER_NAME/

tar -czvf $FOLDER_NAME.tar.gz $FOLDER_NAME
rm -rf $FOLDER_NAME