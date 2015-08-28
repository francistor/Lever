load("urlConfig.js");

print("");
print("----------------------------------");
print("Creating Clients");
print("----------------------------------");

var db=connect(leverClientDatabase.substring(10));
db.clients.drop();
db.clients.ensureIndex({clientId: 1});
db.clients.ensureIndex({legacyClientId: 1});

db.lines.drop();
db.lines.ensureIndex();
db.lines.ensureIndex({clientId: 1});
db.lines.ensureIndex({nasIPAddress: 1, nasPort: 1});
db.userNames.drop();
db.userNames.ensureIndex({clientId: 1});
db.userNames.ensureIndex({userName: 1});
db.phones.drop();
db.phones.ensureIndex({clientId: 1});
db.phones.ensureIndex({phone: 1});

var client1=
{
    clientId: 1,
    provision: {
        legacyClientId: "lci1001",
        legacyClientIdSec: null,
        legalId: "50825186Q",
        name: "Francisco Rodríguez",
        planName: "1001",
        status: 0,
        billingDay: 1,
        timeZone: "America/Sao_Paulo"
    },
    credit: {
        _version: 1,
        creditPools:
        [
        {
            poolName: "bytesRecurring",
            mayUnderflow: false,
            bytes: 1000,
            expirationDate: ISODate("2015-05-30T01:00:00Z")
        },
        {
            poolName: "bytesPurchased",
            mayUnderflow: false,
            bytes: 2000,
            expirationDate: ISODate("2015-05-28T01:00:00Z")
        }
        ]
    }
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
    clientId: 2,
    provision: {
        legacyClientId: "lci1002",
        legacyClientIdSec: null,
        legalId: "50825187Q",
        name: "Celia Rodríguez",
        planName: "1002",
        status: 0,
        billingDay: 1,
        timeZone: "America/Sao Paulo"
    },
    credit: {
        _version: 1,
        creditPools: [
            {
                poolName: "ppu",
                mayUnderflow: false,
                expirationDate: ISODate("2015-07-07T03:00:00Z")
            }
        ]
    }
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
    clientId: 3,
    provision: {
        legacyClientId: "lci1003",
        legacyClientIdSec: null,
        legalId: "1234567Q",
        name: "Elena Fernández",
        planName: "1003",
        status: 0,
        billingDay: 1,
        timeZone: "America/Sao Paulo"
    },
    credit: {
        _version: 1,
        creditPools: [
            {
                poolName: "speedyNightPeakPool",
                mayUnderflow: true,
                calendarTags: ["default"],
                bytes: 0,
                seconds: 0,
                expirationDate: null
            }
        ]
    },
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

// Automated testing client 4
// FUP with turbo button
var client4RecurringExpDate=new Date("2015-06-30T22:00:00Z");
var client4PurchasedExpDate=new Date("2015-06-28T22:00:00Z");
var client4=
{
    clientId: 4,
    provision: {
        legacyClientId: "lci1004",
        legacyClientIdSec: null,
        legalId: "50825186Q",
        name: "Francisco Rodriguez",
        planName: "1004",
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
                expirationDate: client4RecurringExpDate
            },
            {
                poolName: "bytesPurchased",
                mayUnderflow: false,
                bytes: 1024 * 1024 * 1024,
                expirationDate: client4PurchasedExpDate
            }
        ]
    }
};

var login4={
    clientId:4,
    userName: "test-fup@test",
    password: "test"
};

var line4={
    clientId:4,
    nasPort: 1004,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.1.4",
    ipv6DelegatedPrefix: "2001:1004::/56"
};

var phone4={
    clientId:4,
    phone: "999999994"
};

// Automated testing client 5
// Speedy night
var client5=
{
    clientId: 5,
    provision: {
        legacyClientId: "lci1005",
        legacyClientIdSec: null,
        legalId: "50825187Q",
        name: "Francisco García",
        planName: "1005",
        status: 0,
        billingDay: 1
    },
    credit:{
        _version: 0
    }

};

var login5={
    clientId:4,
    userName: "test-speedynight@test",
    password: "test"
};

var line5={
    clientId:5,
    nasPort: 1005,
    nasIPAddress: "127.0.0.1",
    ipv4Address: "192.168.1.5",
    ipv6DelegatedPrefix: "2001:1005::/56"
};

var phone5={
    clientId:5,
    phone: "999999995"
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
db.clients.insert(client4);
db.userNames.insert(login4);
db.lines.insert(line4);
db.phones.insert(phone4);
db.clients.insert(client5);
db.userNames.insert(login5);
db.lines.insert(line5);
db.phones.insert(phone5);

// Unique index: legacyClientId, deletedDate
db.clients.ensureIndex({"provision.legacyClientId": 1}, {unique: true});
// Unique index: userName
db.userNames.ensureIndex({userName: 1}, {unique: true});
// Unique index: userName
db.lines.ensureIndex({nasPort: 1, nasIPAddress: 1}, {unique: true});
// Unique index: phones
db.phones.ensureIndex({phone: 1}, {unique: true});

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

