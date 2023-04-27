#!/usr/bin/env bash

set -e

rimraf **/*/tsconfig.tsbuildinfo \
rimraf **/*/dist 
rimraf **/*/node_modules
rimraf dist node_modules mods/**/build mods/**/libs mods/**/dist .gradle
