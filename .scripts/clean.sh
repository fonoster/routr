#!/usr/bin/env bash

# If one fail all fail
set -e

./gradlew clean \ 
rimraf **/*/tsconfig.tsbuildinfo \
rimraf **/*/dist 
rimraf **/*/dist 
rimraf **/*/node_modules
rimraf dist node_modules mods/**/build mods/**/libs mods/**/bin mods/**/dist .gradle