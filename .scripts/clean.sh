#!/usr/bin/env sh

set -e

rimraf **/logs
rimraf **/*/tsconfig.tsbuildinfo
rimraf **/*/dist 
rimraf **/*/node_modules
rimraf dist node_modules mods/**/build mods/**/libs mods/**/dist .gradle
