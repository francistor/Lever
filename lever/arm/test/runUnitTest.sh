#!/usr/bin/env bash

_REAL_SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_HOME_DIR=${_REAL_SCRIPT_DIR}/..

# Syncronize database
(cd ${_HOME_DIR}/../database && toDatabase.sh)

node ${_HOME_DIR}/test/runUnitTest
