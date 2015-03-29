#!/bin/bash

# Copy environment variables
echo "leverConfigDatabase=\"${LEVER_CONFIGDATABASE_URL}\";" > urlConfig.js
echo "leverClientDatabase=\"${LEVER_CLIENTDATABASE_URL}\";" >> urlConfig.js
echo "leverEventDatabase=\"${LEVER_EVENTDATABASE_URL}\";" >> urlConfig.js

# Load scripts
mongo baseConfig.js
mongo serviceConfig.js
mongo clients.js
mongo events.js