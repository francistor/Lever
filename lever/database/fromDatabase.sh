mongoexport --db leverConfig --collection nodes --query "{'hostName':'`hostname`'}" --out nodes.json > out.txt
node prettyprint.js nodes.json > ../diameter/conf/nodes.json
rm nodes.json

mongoexport --db leverConfig --collection diameterDictionary --out diameterDictionary.json >> out.txt
node prettyprint.js diameterDictionary.json > ../diameter/conf/diameterDictionary.json
rm diameterDictionary.json

mongoexport --db leverConfig --collection dispatcher --out dispatcher.json >> out.txt
node prettyprint.js dispatcher.json > ../diameter/conf/dispatcher.json
rm dispatcher.json

echo export done!