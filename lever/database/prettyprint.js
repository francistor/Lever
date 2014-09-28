var fs=require("fs");

var input=JSON.parse(fs.readFileSync(process.argv[2], {encoding: "utf8"}));
console.log(JSON.stringify(input, undefined, 2));
