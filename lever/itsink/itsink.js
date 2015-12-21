var express=require("express");
var bodyParser=require('body-parser');

var listenPort=8888;
process.title="itsink";

// Instantiate express
var mApp=express();

// Middleware for JSON
mApp.use(bodyParser.json());

mApp.post("/success", function(req, res){
	console.log("Calling success method");
	console.log(req.body);
	res.json({});
});

mApp.get("/success", function(req, res){
	console.log("Calling success method");
	res.json({});
});

mApp.listen(listenPort, function(){
	console.log("itsink listening in port "+listenPort);
});

