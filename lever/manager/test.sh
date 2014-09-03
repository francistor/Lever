# Launch integration tests for the dmanager project

node_modules/protractor/bin/webdriver-manager start &
sleep 3
node_modules/protractor/bin/protractor test/config.js