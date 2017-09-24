#!/usr/bin/bash

if [[ -z $1 ]] 
then
	echo "[ERROR] Must provide the hostName to export as a parameter";
	exit;
fi

hostName=$1

# Remove the mongodb:// prefix
host_database=${LEVER_CONFIGDATABASE_URL#mongodb://}

# Create an array by replacing the \ with a whitespace
comps=(${host_database//\// })

# Get the components
host=${comps[0]}
database=${comps[1]}

mongoexport --host $host --db $database --collection nodes --query "{hostName:\"$hostName\"}" --out node.json > out.txt
node prettyprint.js node.json > ../conf/node.json
rm node.json

mongoexport --host $host --db $database --collection diameterDictionary --out diameterDictionary.json >> out.txt
node prettyprint.js diameterDictionary.json > ../conf/diameterDictionary.json
rm diameterDictionary.json

mongoexport --host $host --db $database --collection dispatcher --out dispatcher.json >> out.txt
node prettyprint.js dispatcher.json > ../conf/dispatcher.json
rm dispatcher.json

mongoexport --jsonArray --host $host --db $database --collection policyParams --out policyParams.json >> out.txt
node prettyprint.js policyParams.json > ../conf/policyParams.json
rm policyParams.json

rm out.txt

echo done!