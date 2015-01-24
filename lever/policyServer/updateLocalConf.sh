mongoexport --db leverConfig --collection nodes --query "{'hostName':'`hostname`'}" --out node.json > out.txt
node prettyprint.js node.json > conf/node.json
rm node.json

mongoexport --db leverConfig --collection diameterDictionary --out diameterDictionary.json >> out.txt
node prettyprint.js diameterDictionary.json > conf/diameterDictionary.json
rm diameterDictionary.json

mongoexport --db leverConfig --collection dispatcher --out dispatcher.json >> out.txt
node prettyprint.js dispatcher.json > conf/dispatcher.json
rm dispatcher.json

echo export done!