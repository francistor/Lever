#!/bin/bash

_REAL_SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

_HOME_DIR=${_REAL_SCRIPT_DIR}/..

(cd  ${_HOME_DIR}/test && export LOG_CONFIG_FILE=load-client-logging.json && node runRadiusLoad --hostName test-client $*)


