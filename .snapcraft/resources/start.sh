#!/bin/bash

set -e

function start {
  externAddr="$(snapctl get routr-extern-addr)"
  if [ "$externAddr" ]; then
    export EXTERN_ADDR=$externAddr
  fi

  localnets="$(snapctl get routr-localnets)"
  if [ "$localnets" ]; then
    export LOCALNETS=$localnets
  fi

  $SNAP/routr
}

start
