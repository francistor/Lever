#!/bin/bash

# Copy environment variables
#echo "leverConfigDatabase=\"${LEVER_CONFIGDATABASE_URL}\";" > urlConfig.js
#echo "leverClientDatabase=\"${LEVER_CLIENTDATABASE_URL}\";" >> urlConfig.js
#echo "leverEventDatabase=\"${LEVER_EVENTDATABASE_URL}\";" >> urlConfig.js

# Load scripts
mongo base.js
mongo diameterDictionary.js
mongo services.js
mongo clients.js
mongo events.js