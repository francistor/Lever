mongoexport --db leverConfig --collection diameterConfig --query "{'serverName':'samsung-jativa'}" --out diameter.json > out.txt
node prettyprint.js diameter.json > ../diameter/conf/diameter.json
rm diameter.json

mongoexport --db leverConfig --collection dictionaryConfig --out dictionary.json >> out.txt
node prettyprint.js dictionary.json > ../diameter/conf/dictionary.json
rm dictionary.json

mongoexport --db leverConfig --collection dispatcherConfig --out dispatcher.json >> out.txt
node prettyprint.js dispatcher.json > ../diameter/conf/dispatcher.json
rm dispatcher.json

echo export done!