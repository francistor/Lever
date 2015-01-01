@echo off

call mongoexport --db leverConfig --collection diameterConfig --query {'hostName':'frodriguezgpw7'} --out diameter.json > out.txt
call node prettyprint.js diameter.json > ../diameter/conf/diameter.json
call del diameter.json

call mongoexport --db leverConfig --collection routeConfig --query {'hostName':'frodriguezgpw7'} --out routes.json >> out.txt
call node prettyprint.js routes.json > ../diameter/conf/routes.json
call del routes.json

call mongoexport --db leverConfig --collection dictionaryConfig --out dictionary.json >> out.txt
call node prettyprint.js dictionary.json > ../diameter/conf/dictionary.json
call del dictionary.json

call mongoexport --db leverConfig --collection dispatcherConfig --out dispatcher.json >> out.txt
call node prettyprint.js dispatcher.json > ../diameter/conf/dispatcher.json
call del dispatcher.json

echo export done!