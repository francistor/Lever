var express=require("express");
var bodyParser=require('body-parser');

var listenPort=8888;
process.title="itsink";

// Instantiate express
var mApp=express();

// Middleware for JSON
mApp.use(bodyParser.json());

mApp.post("/authorize/success", function(req, res){
	console.log("[AUTH SUCCESS] "+JSON.stringify(req.body));
	res.json({});
});

mApp.post("/authorize/failure", function(req, res){
	console.log("[AUTH FAILURE] "+JSON.stringify(req.body));
	res.status(500).end();
});

mApp.post("/commit/success", function(req, res){
	console.log("[COMMIT SUCCESS] "+JSON.stringify(req.body));
	res.json({});
});

mApp.post("/commit/failure", function(req, res){
	console.log("[COMMIT FAILURE] "+JSON.stringify(req.body));
	res.status(500).end();
});

mApp.listen(listenPort, function(){
	console.log("itsink listening in port "+listenPort);
});

