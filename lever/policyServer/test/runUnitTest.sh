#!/usr/bin/env bash

_REAL_SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_HOME_DIR=${_REAL_SCRIPT_DIR}/..

# Syncronize database
(cd ${_HOME_DIR}/../database && toDatabase.sh)

# Delete status file
rm ${_REAL_SCRIPT_DIR}/testFinished.txt > /dev/null

# Delete CDR files
rm /c/var/lever/policyServer/cdr/cdr_* > /dev/null

# Launch server instances
(cd  ${_HOME_DIR} && node runServer --hostName test-server > log/test-server.log &)
(cd  ${_HOME_DIR} && node runServer --hostName test-metaServer > log/test-metaServer.log &)
echo [TEST] Servers launched
(cd  ${_HOME_DIR}/test && node runUnitTest --hostName test-client &)
echo [TEST] Client launched
sleep 30

# (cd  ${_HOME_DIR} && jasmine)
echo [TEST] Tests run

echo [TEST] Stopping servers and client
# Delete test-server
curl --silent http://localhost:9000/agent/stop > /dev/null
# Delete test-client
curl --silent http://localhost:9001/agent/stop > /dev/null
# Delete test-metaServer
curl --silent http://localhost:9002/agent/stop > /dev/null

sleep 2


