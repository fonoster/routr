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

sleep_time=5
try_times=0

function try_start {

	# TODO: Find a way to get process id instead of using nc
	#search=$(ps --pid $(cat $SNAP_COMMOM/redis.pid) -o comm=)
	search=$(nc -z localhost 6379)

	if [ ! $search ]
    	then
    			start
    	else
			if [[ "$try_times" == 5 || "$try_times" > 5 ]]; then
      		echo "Was unable to connect to Redis.  Please make sure Redis has started successfully: sudo systemctl status snap.routr-server.redis-server to view logs: sudo journalctl -u snap.routr-server.redis-server"
     			exit 1;
  		fi

			((try_times += 1))
			((sleep_time += 5))
    	echo "Redis is not available, can't start. Waiting ${sleep_time} seconds and trying again"
			sleep $sleep_time
			try_start
	fi
}

try_start
