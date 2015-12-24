load("urlConfig.js");

print("");
print("----------------------------------");
print("Creating Clients");
print("----------------------------------");

var db=connect(leverClientDatabase.substring(10));
db.clients.drop();
db.clients.createIndex({clientId: 1});
db.clients.createIndex({"provision.legacyClientId": 1}, {unique: true});

db.lines.drop();
db.lines.createIndex();
db.lines.createIndex({clientId: 1});
db.lines.createIndex({nasIPAddress: 1, nasPort: 1}, {unique: true});
db.userNames.drop();
db.userNames.createIndex({clientId: 1});
db.userNames.createIndex({userName: 1}, {unique: true});
db.phones.drop();
db.phones.createIndex({clientId: 1});
db.phones.createIndex({phone: 1}, {unique: true});


// -------------------------------------------------------------------------
// Automated Testing
// -------------------------------------------------------------------------

// Automated testing client 1
// FUP with turbo button
var client1RecurringExpDate=new Date("2015-06-30T22:00:00Z");
var client1PurchasedExpDate=new Date("2015-06-28T22:00:00Z");
var client1=
{
    _id: ObjectId("000000000000000000000001"),
    provision: {
        _version: 1,
        legacyClientId: "lci1001",
        legacyClientIdSec: null,
        legalId: "50825186Q",
        name: "Francisco Rodriguez",
        planName: "1001",
        status: 0,
        billingDay: 1
    },
    credit: {
        _version: 1,
        creditPools: [
            {
                poolName: "bytesRecurring",
                mayUnderflow: false,
                bytes: 5 * 1024 * 1024 * 1024,
                expirationDate: client1RecurringExpDate
            },
            {
                poolName: "bytesPurchased",
                mayUnderflow: false,
                bytes: 1024 * 1024 * 1024,
                expirationDate: client1PurchasedExpDate
            }
        ]
    }
};

var login1={
    clientId: ObjectId("000000000000000000000001"),
    userName: "test-fup@test",
    password: "test"
};

var line1={
    clientId: ObjectId("000000000000000000000001"),
    nasPort: 1004,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.1.1",
    ipv6DelegatedPrefix: "2001:1001::/56"
};

var phone1={
    clientId: ObjectId("000000000000000000000001"),
    phone: "999999991"
};

db.clients.insert(client1);
db.userNames.insert(login1);
db.lines.insert(line1);
db.phones.insert(phone1);

// Speedy night
var client2=
{
    _id: ObjectId("000000000000000000000002"),
    provision: {
        _version: 1,
        legacyClientId: "lci1002",
        legacyClientIdSec: null,
        legalId: "50825187Q",
        name: "Francisco García",
        planName: "1002",
        status: 0,
        billingDay: 1
    },
    credit:{
        _version: 1
    }

};

var login2={
    clientId: ObjectId("000000000000000000000002"),
    userName: "test-speedynight@test",
    password: "test"
};

var line2={
    clientId: ObjectId("000000000000000000000002"),
    nasPort: 1002,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.1.2",
    ipv6DelegatedPrefix: "2001:1005::/56"
};

var phone2={
    clientId: ObjectId("000000000000000000000002"),
    phone: "999999992"
};

db.clients.insert(client2);
db.userNames.insert(login2);
db.lines.insert(line2);
db.phones.insert(phone2);

// Automated testing 3
// IxD

var client3=
{
    _id: ObjectId("000000000000000000000003"),
    provision: {
        _version: 1,
        legacyClientId: "lci1003",
        legacyClientIdSec: null,
        legalId: "50825187Q",
        name: "Gastón García",
        planName: "1003",
        status: 0,
        billingDay: 1
    }
};

var login3={
    clientId: ObjectId("000000000000000000000003"),
    userName: "test-ixd@test",
    password: "test"
};

var line3={
    clientId: ObjectId("000000000000000000000003"),
    nasPort: 1003,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.1.3",
    ipv6DelegatedPrefix: "2001:1003::/56"
};

var phone3={
    clientId: ObjectId("000000000000000000000003"),
    phone: "999999993"
};


db.clients.insert(client3);
db.userNames.insert(login3);
db.lines.insert(line3);
db.phones.insert(phone3);

print("done");
print("");

print("----------------------------------");
print("Creating Capture sets");
print("----------------------------------");

// Add captureset1 to client lcid1003
serviceDb=connect(leverConfigDatabase.substring(10));
var capture1Id=serviceDb.captureSets.findOne({name: "notificacion morosidad"}).clientId;
db.clients.update({legacyClientId: "lcid1003"}, {$addToSet: {captureSets: capture1Id}});

print("done");
print("");

