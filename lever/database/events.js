load("urlConfig.js");

print("");
print("----------------------------------");
print("Creating Events");
print("----------------------------------");

var db=connect(leverEventDatabase.substring(10));
var clientDb=connect(leverClientDatabase.substring(10));
var serviceDb=connect(leverConfigDatabase.substring(10));

db.captureEvents.drop();

// Add capture event
var client3Id=clientDb.clients.findOne({"static.legacyClientId": "lci1003"})._id;
var captureSet1=serviceDb.captureSets.findOne({name: "notificacion morosidad"})._id;

var captureEvent=
{
    captureSetId: captureSet1,
    clientId: client3Id,
    eventDate: 0,
    type: 1,					// 1: hit, 2: response
    content: "no content"
};

db.captureEvents.insert(captureEvent);

print("done");
print("");