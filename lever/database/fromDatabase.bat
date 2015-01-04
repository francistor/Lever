@echo off

call mongoexport --db leverConfig --collection nodes --query {'hostName':'frodriguezgpw7'} --out nodes.json > out.txt
call node prettyprint.js nodes.json > ../diameter/conf/nodes.json
call del nodes.json

call mongoexport --db leverConfig --collection diameterDictionary --out diameterDictionary.json >> out.txt
call node prettyprint.js diameterDictionary.json > ../diameter/conf/diameterDictionary.json
call del diameterDictionary.json

call mongoexport --db leverConfig --collection dispatcher --out dispatcher.json >> out.txt
call node prettyprint.js dispatcher.json > ../diameter/conf/dispatcher.json
call del dispatcher.json

echo export done!