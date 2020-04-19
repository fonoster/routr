#!/bin/bash

set -e

function start {
		externAddr="$(snapctl get routr-extern-addr)"
		if [ "$externAddr" ]; then
				export ROUTR_EXTERN_ADDR=$externAddr
		fi

		localnets="$(snapctl get routr-localnets)"
		if [ "$localnets" ]; then
				export ROUTR_LOCALNETS=$localnets
		fi

		$SNAP/routr
}

start
