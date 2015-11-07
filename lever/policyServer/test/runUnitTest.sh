#!/usr/bin/env bash

_REAL_SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_HOME_DIR=${_REAL_SCRIPT_DIR}/..

# Synchronize database
(cd ${_HOME_DIR}/../database && toDatabase.sh)

# Delete status file
rm ${_HOME_DIR}/test/testFinished.txt > /dev/null

# Delete CDR files
rm /c/var/lever/policyServer/cdr/cdr_* > /dev/null

# Launch server instances
(cd  ${_HOME_DIR} && export LOG_CONFIG_FILE=test-server-logging.json && node runServer --hostName test-server > /dev/null &)
(cd  ${_HOME_DIR} && export LOG_CONFIG_FILE=test-metaServer-logging.json && node runServer --hostName test-metaServer > /dev/null &)
echo [TEST] Servers launched
(cd  ${_HOME_DIR}/test && export LOG_CONFIG_FILE=test-client-logging.json && node runUnitTest --hostName test-client &)
echo [TEST] Client launched
sleep 45

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


