/**
 * Created by frodriguezg on 27/12/2014.
 */

var Q=require("q");
var fs=require("fs");
var aLogger=require("./log").aLogger;
var MongoClient=require("mongodb").MongoClient;

var dbParams=JSON.parse(fs.readFileSync(__dirname+"/conf/database.json", {encoding: "utf8"}));
dbParams["configDatabaseURL"]=process.env["LEVER_CONFIGDATABASE_URL"];
dbParams["clientDatabaseURL"]=process.env["LEVER_CLIENTDATABASE_URL"];
if(!dbParams["configDatabaseURL"]) throw Error("LEVER_CONFIGDATABASE_URL environment variable not set");
if(!dbParams["clientDatabaseURL"]) throw Error("LEVER_CLIENTDATABASE_URL environment variable not set");

var createArm=function(){

    var arm={};

    var configDB;
    var clientDB;

    var configProperties;

    /**
     * Returns promise resolved when both connections to databases are established.
     *
     * @returns {*}
     */
    arm.initialize=function(cp){
        configProperties=cp;
        return  Q.all([Q.ninvoke(MongoClient, "connect", dbParams["configDatabaseURL"], dbParams["databaseOptions"]),
                Q.ninvoke(MongoClient, "connect", dbParams["clientDatabaseURL"], dbParams["databaseOptions"])]).
                spread(function(coDb, clDb){
                    configDB=coDb;
                    clientDB=clDb;
                })
    };

    /**
     * Returns a promise to be fulfilled with the client object, or null if not found
     * clientPoU may have one of the following properties set: "phone", "userName", "nasPort/nasIPAddress"
     * @param clientPoU
     */
    arm.getClient=function(clientPoU){
        var collectionName;
        if(clientPoU.phone) collectionName="phones"; else if(clientPoU.userName) collectionName="userNames"; else collectionName="lines";

        var deferred= Q.defer();

        clientDB.collection(collectionName).findOne(clientPoU, {}, dbParams["databaseOptions"], function(err, pou){
            if(err) deferred.reject(err);
            else if(!pou) deferred.resolve(null);
            else{
                clientDB.collection("clients").findOne({_id: pou.clientId}, {}, dbParams["databaseOptions"], function(err, client){
                    if(err) deferred.reject(err);
                    else if(!client) deferred.resolve(null);
                    else deferred.resolve(client);
                });
            }
        });

        return deferred.promise;
    };

    /**
     * Returns a promise to be resolved with the plan object
     * @param planName
     */
    arm.getPlan=function(planName){
        var deferred= Q.defer();

        configDB.collection("plans").findOne({name: planName}, {}, dbParams["databaseOptions"], function(err, plan){
            if(err) deferred.reject(err);
            else if(!plan) deferred.resolve(null);
            else deferred.resolve(plan);
        });

        return deferred.promise;
    };

    /**
     * Returns a promise to be resolved with the ClientContext object, which contains a "client" attribute and a
     * "plan" attribute
     * @param clientPoU
     * @returns {*}
     */
    arm.getClientContext=function(clientPoU){
        var clientContext={};

        return arm.getClient(clientPoU).
            then(function(client){
            if(!client) return null;
            else{
                clientContext["client"]=client;
                return arm.getPlan(client.static.planName);
            }
        }).then(function(plan){
            if(!plan) return clientContext;
            else{
                clientContext["plan"]=plan;
                return clientContext;
            }
        })
    };

    /**
     * Returns and object with the credit for the specified service.
     * @param clientContext
     * @param ratingGroup
     * @param serviceId
     * @returns {*}
     */
    arm.getCredit=function(clientContext, ratingGroup, serviceId){
        var i;

        // null values mean no limit
        var totalCredit={
            bytes: 0,
            seconds: 0,
            expirationDate: null
        };

        // Find the target service
        var service=null;
        var services;
        services=clientContext.plan.services;
        for(i=0; i<services.length; i++){
            if(services[i].ratingGroup==ratingGroup && (services[i].serviceId==0 || services[i].serviceId==serviceId)){
                service=services[i];
                break;
            }
        }
        if(service==null){
            if(aLogger["inDebug"]) aLogger.debug("arm.getCredit: No serviceMatch");
            return null;
        }

        // Return if no credit control is to be performed
        if(!service.preAuthorized){
            totalCredit.bytes=configProperties.maxBytesCredit;
            totalCredit.seconds=configProperties.maxSecondsCredit;
            if(aLogger["inDebug"]) aLogger.debug("arm.getCredit: Service without credit control");
            return totalCredit;
        }

        // Get the relevant creditPools for the targeted service
        var targetCreditPools=[];
        var clientCreditPools=clientContext.client.creditPools;
        service.creditPoolNames.forEach(function(poolName){
            clientCreditPools.forEach(function(pool){
                if(pool.poolName==poolName) targetCreditPools.push(pool);
            })
        });

        // Sort them by date if required
        if(service.sortCreditsByExpirationDate){
            targetCreditPools.sort(function(a, b){
                if(!a.expirationDate) return 1;
                if(!b.expirationDate) return -1;
                return a.expirationDate.getTime()- b.expirationDate.getTime();
            });
        }

        // Add credit
        targetCreditPools.forEach(function(credit){
            // null values will remain (unlimited credit)
            if(typeof(credit.bytes)=='undefined') totalCredit.bytes=null; else if(credit.bytes!=null && totalCredit.bytes!=null) totalCredit.bytes+=credit.bytes;
            if(typeof(credit.seconds)=='undefined') totalCredit.seconds=null; else if(credit.seconds!=null && totalCredit.seconds!=null) totalCredit.seconds+=credit.seconds;
            // Set expiration date to minimum value among all credits
            if(!totalCredit.expirationDate) totalCredit.expirationDate=credit.expirationDate;
            else if(credit.expirationDate && credit.expirationDate.getTime()<totalCredit.expirationDate) totalCredit.expirationDate=credit.expirationDate;
        });

        // Enforce maximum value
        if(configProperties.maxBytesCredit) if(!totalCredit.bytes || totalCredit.bytes>configProperties.maxBytesCredit) totalCredit.bytes=configProperties.maxBytesCredit;
        if(configProperties.maxSecondsCredit) if(!totalCredit.seconds || totalCredit.seconds>configProperties.maxSecondsCredit) totalCredit.seconds=configProperties.maxSecondsCredit;
        if(configProperties.maxSecondsCredit) if(!totalCredit.expirationDate || totalCredit.expirationDate.getTime()-Date.now()>configProperties.maxSecondsCredit*1000) totalCredit.expirationDate=new Date(Date.now()+configProperties.maxSecondsCredit*1000);

        // Enforce minimum value
        if(configProperties.maxBytesCredit) if(totalCredit.bytes && totalCredit.bytes<configProperties.minBytesCredit) totalCredit.bytes=configProperties.minBytesCredit;
        if(configProperties.maxSecondsCredit)if(totalCredit.seconds && totalCredit.seconds<configProperties.minSecondsCredit) totalCredit.seconds=configProperties.minSecondsCredit;
        if(configProperties.maxSecondsCredit) if(totalCredit.expirationDate && totalCredit.expirationDate.getTime()-Date.now()<configProperties.minSecondsCredit*1000) totalCredit.expirationDate=new Date(Date.now()+configProperties.minSecondsCredit*1000);

        // Randomize validity date
        if(configProperties.expirationRandomSeconds) if(totalCredit.expirationDate && totalCredit.expirationDate.getMinutes()==0 && totalCredit.expirationDate.getSeconds()==0){
            totalCredit.expirationDate=new Date(totalCredit.expirationDate.getTime()+Math.floor(Math.random()*1000*configProperties.expirationRandomSeconds));
        }

        return totalCredit;
    };

    // If date within time range, returns the end date of the time range
    // Otherwise returns null
    function isInCalendarItem(date, calendarItem){
        var nextDate=new Date(date);

        // Make sure there are no milliseconds
        date.setMilliseconds(0);

        // Absolute interval
        if(calendarItem.type==1) {
            var startDate=new Date(calendarItem.startDate);
            var endDate=new Date(calendarItem.endDate);
            startDate.setHours(startDate.getHours()+endDate.getTimezoneOffset()/60);
            endDate.setHours(endDate.getHours()+endDate.getTimezoneOffset()/60);
            if (date.getTime() >= startDate.getTime() && date.getTime() < endDate.getTime()) return endDate;
            else return null;
        }

        // Weekly interval
        else if(calendarItem.type==2){
            var startWeeklyTimeSeconds=calendarItem.startWeekDay*86400+calendarItem.startTime.split(":")[0]*3600+calendarItem.startTime.split(":")[1]*60;
            var endWeeklyTimeSeconds=calendarItem.endWeekDay*86400+calendarItem.endTime.split(":")[0]*3600+calendarItem.endTime.split(":")[1]*60;
            var currentWeeklyTimeSeconds=date.getDay()*86400+date.getHours()*3600+date.getMinutes()*60;
            if(endWeeklyTimeSeconds>startWeeklyTimeSeconds && (currentWeeklyTimeSeconds>=startWeeklyTimeSeconds && currentWeeklyTimeSeconds<endWeeklyTimeSeconds)||
               endWeeklyTimeSeconds<startWeeklyTimeSeconds && (currentWeeklyTimeSeconds<endWeeklyTimeSeconds || currentWeeklyTimeSeconds>=startWeeklyTimeSeconds)){
                // Set next date
                nextDate.setSeconds(nextDate.getSeconds()+(endWeeklyTimeSeconds-currentWeeklyTimeSeconds));
                if(endWeeklyTimeSeconds<currentWeeklyTimeSeconds) nextDate.setSeconds(nextDate.getSeconds()+7*86400);
                return nextDate;
            } else return null;
        }

        // Daily Interval
        else if(calendarItem.type==3){
            var startDailyTimeSeconds=calendarItem.startTime.split(":")[0]*3600+calendarItem.startTime.split(":")[1]*60;
            var endDailyTimeSeconds=calendarItem.endTime.split(":")[0]*3600+calendarItem.endTime.split(":")[1]*60;
            var currentDailyTimeSeconds=date.getHours()*3600+date.getMinutes()*60;
            if(endDailyTimeSeconds>startDailyTimeSeconds && (currentDailyTimeSeconds>=startDailyTimeSeconds && currentDailyTimeSeconds<endDailyTimeSeconds)||
                endDailyTimeSeconds<startDailyTimeSeconds && (currentDailyTimeSeconds<endDailyTimeSeconds || currentDailyTimeSeconds>=startDailyTimeSeconds)){
                // Set next date
                nextDate.setSeconds(nextDate.getSeconds()+(endDailyTimeSeconds-currentDailyTimeSeconds));
                if(endDailyTimeSeconds<currentDailyTimeSeconds) nextDate.setSeconds(nextDate.getSeconds()+86400);
                return nextDate;
            } else return null;
        }
    }

    arm.breakEvent=function(event, calendar){
        var i;
        var fragmentSeconds;
        var remainingSeconds=event.seconds;
        var nextTimeFrame;
        var nextDate=new Date(event.startDate);
        var brokenEvents=[];

        while(remainingSeconds>0){
            // Iterate through all calendar items
            for(i=0; i<calendar.calendarItems.length; i++){
                console.log("Testing "+JSON.stringify(calendar.calendarItems[i]));
                nextTimeFrame=isInCalendarItem(nextDate, calendar.calendarItems[i]);
                if(nextTimeFrame!=null){
                    console.log("Matched with nextTimeFrame "+nextTimeFrame);
                    fragmentSeconds=(nextTimeFrame.getTime()-nextDate.getTime())/1000;
                    if(fragmentSeconds>remainingSeconds) fragmentSeconds=remainingSeconds;
                    brokenEvents.push({
                        startDate: nextDate,
                        seconds: fragmentSeconds,
                        bytesUp: Math.round(event.bytesUp*fragmentSeconds/event.seconds),
                        bytesDown: Math.round(event.bytesDown*fragmentSeconds/event.seconds),
                        tag: calendar.calendarItems.tag
                    });
                    nextDate=nextTimeFrame;
                    remainingSeconds-=fragmentSeconds;
                    break;
                }
            }
            if(nextTimeFrame==null) throw new Error("Bad calendar "+calendar.name);
        }

        return brokenEvents;
    };

    return arm;
};

///////////////////////////////////////////////////////////////////////////////
// Testing
///////////////////////////////////////////////////////////////////////////////

// Array items must be in the appropriate order
var speedyNightCalendar=
{
    name: "speedyNight",
    calendarItems:
        [
            {
                type: 1,
                startDate: "2020-01-01",
                endDate: "2020-01-02",
                tag: "speedynight"
            },
            {
                type: 2,
                startWeekDay: 5,        // 0: Sunday, 6: Saturday
                startTime: "20:00",
                endWeekDay: 1,
                endTime: "07:00",
                tag: "speedynight"
            },
            {
                type: 3,
                startTime: "20:00",
                endTime: "07:00",
                tag: "speedynight"

            },
            {
                type: 3,
                startTime: "07:00",
                endTime: "20:00"
            }
        ]
};

var event={
    startDate: new Date("2015-01-07T18:30:00"), // 19:30 local time
    seconds:300000,
    bytesUp: 100,
    bytesDown: 1000
};

var arm=createArm();

/*
console.log(serviceMgr.isInCalendarItem(
    new Date("2015-01-07T18:30:00"),
    {
        type: 3,
        startTime: "07:00",
        endTime: "20:00"
    }
));
*/

// var brokenEvents=arm.breakEvent(event, speedyNightCalendar);
// console.log(JSON.stringify(brokenEvents, null, 2));

arm.initialize({
    maxBytesCredit:null,
    maxSecondsCredit:null,
    minBytesCredit:0,
    minSecondsCredit:0,
    expirationRandomSeconds: null}).then(function(){
    test();
}, function(reason){
    console.log("Initialization error due to "+reason);
}).done();

function test(){
    console.log("testing...");

    arm.getClientContext({
        nasPort: 1001,
        nasIPAddress: "127.0.0.1"
    }).then(function(clientContext){
        console.log("Got clientContext: "+JSON.stringify(clientContext, null, 2));
        var credit=arm.getCredit(clientContext, 101, 0);
        console.log(" ");
        console.log("Credit: "+JSON.stringify(credit));
    }, function(err){
        console.log("Error: "+err);
    }).then(function(){
        process.exit(1);
    }).done();
}


