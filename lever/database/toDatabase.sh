#!/bin/bash

echo $leverConfigDatabaseURL
mongo ${LEVER_CONFIGDATABASE_URL#mongodb://} baseConfig.js
mongo ${LEVER_CONFIGDATABASE_URL#mongodb://} serviceConfig.js