#!/bin/bash

echo $leverConfigDatabaseURL
mongo ${leverConfigDatabaseURL#mongodb://} baseConfig.js
mongo ${leverConfigDatabaseURL#mongodb://} serviceConfig.js