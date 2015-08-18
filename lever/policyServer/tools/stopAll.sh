#!/usr/bin/env bash

echo [TEST] Stopping servers and client
# Delete test-server
curl --silent http://localhost:9000/agent/stop > /dev/null
# Delete test-client
curl --silent http://localhost:9001/agent/stop > /dev/null
# Delete test-metaServer
curl --silent http://localhost:9002/agent/stop > /dev/null



