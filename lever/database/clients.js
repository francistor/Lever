load("urlConfig.js");

printjson("----------------------------------");
printjson("Creating Clients");
printjson("----------------------------------");

var db=connect(leverClientDatabase.substring(10));
db.clients.drop();

var client1=
{
    _id: 1,
    legacyClientId: "lci1001",
    legacyClientIdSec: null,
    legalId: "50825186Q",
    name: "Francisco Rodríguez",
    planName: "1001",
    status: 0,
    billingDay: 1,
    timeZone: "America/Sao_Paulo",
    creditPools:
        [
            {
                poolName: "bytesrecurring",
                prepaidType: 2, 		// Prepaid
                bytes: 1024,
                seconds: 1000000000000,
                expirationDate: 1288329185000,
                exhausted: false
            },
            {
                poolName: "bytespurchased",
                prepaidType: 2, 		// Prepaid
                bytes: 2048,
                seconds: 1000000000000,
                expirationDate: 1488329185000,
                exhausted: false
            }
        ]
};

var login1={
    clientId:1,
    userName: "frg@tid.es",
    password: "hash"
};

var line1={
    clientId:1,
    nasPort: 1001,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.1.1",
    ipv6DelegatedPrefix: "2001:1001::/56"
};

var phone1={
    clientId:1,
    phone: "629629769"
};

var phone11={
    clientId:1,
    phone: "639629769"
};

var client2=
{
    _id: 2,
    legacyClientId: "lci1002",
    legacyClientIdSec: null,
    legalId: "50825187Q",
    name: "Celia Rodríguez",
    planName: "1002",
    status: 0,
    billingDay: 1,
    timeZone: "America/Sao Paulo",
    creditPools:
        [
            {
                poolName: "ppu",
                prepaidType: 2, 		// Prepaid
                bytes: 2048,
                seconds: 1000000000000,
                expirationDate: 1288329185000,
                exhausted: false
            }
        ]
};

var login2={
    clientId:2,
    userName: "frodriguezg@indra.es",
    password: "hash"
};

var line2={
    clientId:2,
    nasPort: 2001,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.2.1",
    ipv6DelegatedPrefix: "2001:2001::/56"
};

var line22={
    clientId:2,
    nasPort: 2002,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.2.1",
    ipv6DelegatedPrefix: "2001:2002::/56"
};

var phone2={
    clientId:2,
    phone: "650651194"
};

var client3=
{
    _id: 3,
    legacyClientId: "lci1003",
    legacyClientIdSec: null,
    legalId: "1234567Q",
    name: "Elena Fernández",
    planName: "1003",
    status: 0,
    billingDay: 1,
    timeZone: "America/Sao Paulo",
    creditPools:
        [
            {
                poolName: "speedyNightPeakPool",
                prepaidType: 1, 					// Postpaid
                calendarTags: ["default"],
                bytes: 0,
                seconds: 0,
                expirationDate: 0,
                exhausted: false
            }
        ],
    captureSets:
        [
        ]
};

var login3={
    clientId:3,
    userName: "francisco.cardosogil@gmail.com",
    password: "hash"
};


var login33={
    clientId:3,
    userName: "emilio.vargas@gmail.com",
    password: "hash"
};

var line3={
    clientId:3,
    nasPort: 3001,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.3.1",
    ipv6DelegatedPrefix: "2001:3001::/56"
};

var phone3={
    clientId:3,
    phone: "650651194"
};

db.clients.insert(client1);
db.userNames.insert(login1);
db.lines.insert(line1);
db.phones.insert(phone1);
db.clients.insert(phone11);
db.clients.insert(client2);
db.userNames.insert(login2);
db.lines.insert(line2);
db.lines.insert(line22);
db.phones.insert(phone2);
db.clients.insert(client3);
db.userNames.insert(login3);
db.userNames.insert(login33);
db.lines.insert(line3);
db.phones.insert(phone3);

// Unique index: legacyClientId, deletedDate
db.clients.ensureIndex({legacyClientId: 1, deletedDate: 1}, {unique: true});
// Unique index: userName
db.userNames.ensureIndex({userName: 1}, {unique: true});
// Unique index: userName
db.lines.ensureIndex({nasPort: 1, nasIPAddress: 1}, {unique: true});
// Unique index: phones
db.phones.ensureIndex({phone: 1}, {unique: true});

print("done");
print("");

printjson("----------------------------------");
printjson("Creating Capture sets");
printjson("----------------------------------");

// Add captureset1 to client lcid1003
serviceDb=connect(leverConfigDatabase.substring(10));
var capture1Id=serviceDb.captureSets.findOne({name: "notificacion morosidad"})._id;
db.clients.update({legacyClientId: "lcid1003"}, {$addToSet: {captureSets: capture1Id}});

print("done");
print("");

