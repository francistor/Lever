#!/bin/bash

source ../util/env.sh

echo $leverConfigDatabaseURL
mongo ${leverConfigDatabaseURL#mongodb://} baseConfig.js
mongo ${leverConfigDatabaseURL#mongodb://} serviceConfig.js