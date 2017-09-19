#!/bin/bash

# Launch client instances
export LOG_CONFIG_FILE=load-client-logging.json && node runRadiusLoad.js --hostName load-client --loadTemplate loadTemplate.json


