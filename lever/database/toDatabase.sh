#!/bin/bash

mongo ${leverConfigDatabaseURL#mongodb://} baseConfig.js
mongo ${serviceConfigDatabaseURL#mongodb://} serviceConfig.js