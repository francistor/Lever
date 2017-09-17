#!/usr/bin/env bash

_REAL_SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_HOME_DIR=${_REAL_SCRIPT_DIR}/..

# Synchronize database
(cd ${_HOME_DIR}/../database && ./toDatabase.sh)

# Delete status file
rm ${_HOME_DIR}/test/testFinished.txt > /dev/null

# Delete CDR files
rm /c/var/lever/policyServer/cdr/cdr_* > /dev/null

# Launch server instances
(cd  ${_HOME_DIR} && export LOG_CONFIG_FILE=performance-server-logging.json && node runServer --hostName test-server > /dev/null &)
(cd  ${_HOME_DIR} && export LOG_CONFIG_FILE=performance-metaServer-logging.json && node runServer --hostName test-metaServer > /dev/null &)
echo [TEST] Servers launched
(cd  ${_HOME_DIR}/test && export LOG_CONFIG_FILE=performance-client-logging.json && node runPerformanceTest --hostName test-client --totalThreads 4 &)
echo [TEST] Client launched
sleep 60

echo [TEST] Tests run

echo [TEST] Stopping servers and client
# Stop test-server
curl --silent http://localhost:9000/agent/stop > /dev/null
# Stop test-client
curl --silent http://localhost:9001/agent/stop > /dev/null
# Stop test-metaServer
curl --silent http://localhost:9002/agent/stop > /dev/null

sleep 2


