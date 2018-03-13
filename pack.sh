#!/usr/bin/env bash

VERSION=1.0.0-M3
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
cp sipio $FOLDER_NAME/
cp README.md $FOLDER_NAME/
cp LICENSE $FOLDER_NAME/
cp run.sh $FOLDER_NAME/

tar -czvf $FOLDER_NAME.tar.gz $FOLDER_NAME
zip -r $FOLDER_NAME.zip $FOLDER_NAME

# Cleanup again
rm -rf $FOLDER_NAME
