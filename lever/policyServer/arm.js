/**
 * Created by frodriguezg on 27/12/2014.
 *
 * Client and Service API for policyManager
 * Requires three mongoDB database connections, for Service Database, Client Database and Event database
 */

var Q=require("q");
var fs=require("fs");
var aLogger=require("./log").aLogger;
var MongoClient=require("mongodb").MongoClient;

var dbParams=JSON.parse(fs.readFileSync(__dirname+"/conf/database.json", {encoding: "utf8"}));
dbParams["configDatabaseURL"]=process.env["LEVER_CONFIGDATABASE_URL"];
dbParams["clientDatabaseURL"]=process.env["LEVER_CLIENTDATABASE_URL"];
dbParams["eventDatabaseURL"]=process.env["LEVER_EVENTDATABASE_URL"];
if(!dbParams["configDatabaseURL"]) throw Error("LEVER_CONFIGDATABASE_URL environment variable not set");
if(!dbParams["clientDatabaseURL"]) throw Error("LEVER_CLIENTDATABASE_URL environment variable not set");
if(!dbParams["eventDatabaseURL"]) throw Error("LEVER_EVENTDATABASE_URL environment variable not set");

var createArm=function(){

    var arm={};
    arm.INITIAL_REQUEST=1;
    arm.UPDATE_REQUEST=2;
    arm.TERMINATE_REQUEST=3;

    var configDB;
    var clientDB;
    var eventDB;

    var configProperties;

    /**
     * Returns promise resolved when both connections to databases are established.
     * To be used for standalone testing
     *
     * @returns {*}
     */
    arm.setupDatabaseConnections=function(){
        return  Q.all([
                    Q.ninvoke(MongoClient, "connect", dbParams["configDatabaseURL"], dbParams["databaseOptions"]),
                    Q.ninvoke(MongoClient, "connect", dbParams["clientDatabaseURL"], dbParams["databaseOptions"]),
                    Q.ninvoke(MongoClient, "connect", dbParams["eventDatabaseURL"], dbParams["databaseOptions"])
                ]).spread(function(coDb, clDb, evDb){
                    configDB=coDb;
                    clientDB=clDb;
                    eventDB=evDb;
                });
    };

    /**
     * Gets database connections already established
     * @param configDatabase
     * @param clientDatabase
     * @param eventDatabase
     */
    arm.setDatabaseConnections=function(configDatabase, clientDatabase, eventDatabase){
        configDB=configDatabase;
        clientDB=clientDatabase;
        eventDB=eventDatabase;
    };

    /**
     * Setup configuration properties
     */
    arm.setConfigProperties=function(cp){
        configProperties=cp;
    };

    /**
     * Returns a promise to be fulfilled with the client object, or null if not found
     * clientPoU may have one of the following properties set: "phone", "userName", "nasPort/nasIPAddress"
     * @param clientPoU
     */
    arm.getClient=function(clientPoU){
        var collectionName;

        // Find collection where to do the looking up
        if(clientPoU.phone) collectionName="phones"; else if(clientPoU.userName) collectionName="userNames"; else collectionName="lines";

        var deferred= Q.defer();

        // Find client._id in the appropriate collection
        clientDB.collection(collectionName).findOne(clientPoU, {}, dbParams["databaseOptions"], function(err, pou){
            if(err) deferred.reject(err);
            else if(!pou) deferred.resolve(null);
            else{
                // Find the client object given the _id
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
                    return arm.getPlan(client.provision.planName);
                }}).
            then(function(plan){
                if(!plan) return clientContext;
                else{
                    clientContext["plan"]=plan;
                    return clientContext;
                }
            });
    };

    /**
     * Returns and object with the credit for the specified service.
     * @param clientContext
     * @param ratingGroup
     * @param serviceId
     * @returns {*}
     */
    arm.getCredit=function(clientContext, service){

        // Return null if no service match
        // TODO: Remove from this method
        if(service==null){
            if(aLogger["inDebug"]) aLogger.debug("arm.getCredit: No serviceMatch");
            return null;
        }

        // null values mean no limit
        var creditGranted={
            bytes: 0,
            seconds: 0,
            expirationDate: null,
            fui: false,                             // Final Unit Indication
            fua: service.oocAction                  // Final Unit Action
        };

        // Return if no credit control is to be performed
        if(!service.preAuthorized){
            creditGranted.bytes=configProperties.maxBytesCredit;
            creditGranted.seconds=configProperties.maxSecondsCredit;
            if(aLogger["inDebug"]) aLogger.debug("arm.getCredit: Service without credit control");
            return creditGranted;
        }

        // Add credit by iterating through the credit pools
        getTargetCreditPools(clientContext, service).forEach(function(credit){
            // null values will remain unmodified (they mean unlimited credit)
            if(typeof(credit.bytes)=='undefined') creditGranted.bytes=null; else if(credit.bytes!=null && creditGranted.bytes!=null) creditGranted.bytes+=credit.bytes;
            if(typeof(credit.seconds)=='undefined') creditGranted.seconds=null; else if(credit.seconds!=null && creditGranted.seconds!=null) creditGranted.seconds+=credit.seconds;
            // IMPORTANT: Set expiration date to minimum value among all credits
            if(!creditGranted.expirationDate) creditGranted.expirationDate=credit.expirationDate;
            else if(credit.expirationDate && credit.expirationDate.getTime()<creditGranted.expirationDate) creditGranted.expirationDate=credit.expirationDate;
        });

        // If any resource is zero, should be returned as zero
        // isFinal flag is only set if maxSeconds or maxBytes is defined
        if(creditGranted.bytes!==0 && creditGranted.seconds!==0) {
            // Enforce maximum value
            if (configProperties.maxBytesCredit){
                if (!creditGranted.bytes || creditGranted.bytes > configProperties.maxBytesCredit) creditGranted.bytes = configProperties.maxBytesCredit;
                else creditGranted.fui=true;
            }
            if (configProperties.maxSecondsCredit){
                if (!creditGranted.seconds || creditGranted.seconds > configProperties.maxSecondsCredit) creditGranted.seconds = configProperties.maxSecondsCredit;
                else creditGranted.fui=true;
            }
            if (configProperties.maxSecondsCredit){
                if (!creditGranted.expirationDate || creditGranted.expirationDate.getTime() - Date.now() > configProperties.maxSecondsCredit * 1000) creditGranted.expirationDate = new Date(Date.now() + configProperties.maxSecondsCredit * 1000);
                else creditGranted.fui=true;
            }

            // Enforce minimum value
            if (configProperties.maxBytesCredit) if (creditGranted.bytes && creditGranted.bytes < configProperties.minBytesCredit) creditGranted.bytes = configProperties.minBytesCredit;
            if (configProperties.maxSecondsCredit)if (creditGranted.seconds && creditGranted.seconds < configProperties.minSecondsCredit) creditGranted.seconds = configProperties.minSecondsCredit;
            if (configProperties.maxSecondsCredit) if (creditGranted.expirationDate && creditGranted.expirationDate.getTime() - Date.now() < configProperties.minSecondsCredit * 1000) creditGranted.expirationDate = new Date(Date.now() + configProperties.minSecondsCredit * 1000);
        }

        // Randomize validity date, but only if expiration date looks like a day or month edge
        if(configProperties.expirationRandomSeconds) if(creditGranted.expirationDate && creditGranted.expirationDate.getMinutes()==0 && creditGranted.expirationDate.getSeconds()==0){
            creditGranted.expirationDate=new Date(creditGranted.expirationDate.getTime()+Math.floor(Math.random()*1000*configProperties.expirationRandomSeconds));
        }

        return creditGranted;
    };

    /**
     * Updates the clientContext object passed with the credits updated and the dirtyCreditPools mark if applicable
     * @param clientContext
     * @param serviceName
     * @param bytes
     * @param seconds
     */
    arm.discountCredit=function(clientContext, service, bytes, seconds){
        var toDiscount;

        getTargetCreditPools(clientContext, service).forEach(function(credit){
            // All credits are here valid (i.e. before expiration date)

            // Discount the bytes
            if(!(typeof(credit.bytes)=='undefined') && bytes){
                clientContext.client.creditsDirty=true;
                if(credit.mayUnderflow) {
                    credit.bytes-=bytes;
                    bytes=0;
                }
                else{
                    toDiscount=Math.min(credit.bytes, bytes);
                    credit.bytes-=toDiscount;
                    bytes-=toDiscount;
                }
            }
            // Discount the seconds
            if(!(typeof(credit.seconds)=='undefined') && seconds){
                clientContext.client.creditsDirty=true;
                if(credit.mayUnderflow) {
                    credit.seconds-=seconds;
                    seconds=0;
                }
                else{
                    toDiscount=Math.min(credit.seconds, seconds);
                    credit.seconds-=toDiscount;
                    usage.seconds-=toDiscount;
                }
            }
        });
    };

    /**
     * Creates or updates the client recurring credits
     * @param clientContext
     */
    arm.updateRecurringCredits=function(clientContext){
        var i;
        var creditPools;
        var creditPool=null;
        var isCreditValid=false;
        var currentTime=Date.now();

        clientContext.plan.services.forEach(function(service){
            if(service.recharges) service.recharges.forEach(function(recharge){
                if(recharge.creationType===3){
                    // Found recurring recharge
                    creditPools=clientContext.client.creditPools;
                    for(i=0; i<creditPools.length; i++){
                        if(creditPools[i].poolName==recharge.creditPool){
                            // Found credit pool for the recurring recharge
                            creditPool=creditPools[i];
                            if(creditPool.expirationDate && creditPool.expirationDate.getTime()<currentTime){
                                // Credit expired. Do refill
                                creditPool.bytes=recharge.bytes;
                                creditPool.seconds=recharge.seconds;
                                creditPool.expirationDate=getNextExpirationDate(new Date(), recharge.validity);
                                clientContext.client.creditsDirty=true;
                            }
                            break;
                        }
                    }
                    if(creditPool==null){
                        // No credit pool. Create one
                        creditPool={
                            poolName: recharge.creditPool,
                            mayUnderflow: recharge.mayUnderflow,
                            bytes: recharge.bytes,
                            seconds: recharge.seconds,
                            expirationDate: getNextExpirationDate(new Date(), recharge.validity)
                        };
                        creditPools.push(creditPool);
                        clientContext.client.creditsDirty=true;
                    }
                }
            });
        });

    };

    /**
     * Deletes expired
     * @param clientContext
     */
    arm.cleanupCredits=function(clientContext){
        var currentTime=Date.now();

        // Loop backwards, because we are modifying the array while iterating through it, and array
        // is re-indexed when removing an element
        var creditPools=clientContext.client.creditPools;
        for(var i=0; i<creditPools.length; i++){
            if(creditPools[i].expirationDate && creditPools[i].expirationDate.getTime()<currentTime){
                creditPools.splice(i--, 1);
            }
        }
    };

    /**
     *
     * @param clientContext
     * @param ccRequestType
     * @param ccElements array of {
     *      serviceId:<>,
     *      ratingGroup: <>,
     *      used: {
     *          bytes: <>,
     *          seconds: <>
     *      },
     *      granted: {
     *          bytes: <>,
     *          seconds: <>,
     *          expirationDate: <>,
     *          fui: <>,        // Final Unit Indication
     *          fua: <>
     *     }
     *
     * ccElements are decorated with serivceNames
     */
    arm.executeCCRequest=function(clientContext, ccRequestType, ccElements){

        // First discount credit without updating
        if(ccRequestType==arm.UPDATE_REQUEST || ccRequestType==arm.TERMINATE_REQUEST) ccElements.forEach(function(ccElement){
            // Decorate with service
            if(!ccElement.service) ccElement.service=guideService(clientContext, ccElement.serviceId, ccElement.ratingGroup);
            // Do discount
            if(ccElement.service) arm.discountCredit(clientContext, ccElement.service, (ccElement["used"]||{}).bytes, (ccElement["used"]||{}).seconds);
        });

        // Update recurrent credits and do cleanup
        arm.updateRecurringCredits(clientContext);
        arm.cleanupCredits(clientContext);

        // Decorate with credits
        if(ccRequestType==arm.INITIAL_REQUEST || ccRequestType==arm.UPDATE_REQUEST) ccElements.forEach(function(ccElement){
            // Decorate with service if not done yet
            if(!ccElement.service) ccElement.service=guideService(clientContext, ccElement.serviceId, ccElement.ratingGroup);
            if(ccElement.service) ccElement.granted=arm.getCredit(clientContext, ccElement.service);
        });
    };

    /**
     *
     * @param usageEvents
     *
     * UsageEvent format {clientId: <>, eventDate: <>, eventType: <>, serviceName: <>, sessionId: <>, used: <>, granted: <>
     */
    arm.writeUsageEventArray=function(clientContext, usages, ccRequestType, date, callback){
        var event={
            clientId: clientContext.client._id,
            eventDate: date ? date : new Date(),
            eventType: ccRequestType
        }
    };

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

    // Supporting functions

    function getNextExpirationDate(now, validity){
        var elements=/([0-9]+)([MDH])/.exec(validity);
        if(elements.length!=3) return null;

        var expDate=now;
        if(elements[2]=="M"){
            expDate.setMonth(expDate.getMonth()+1, 1);
            expDate.setHours(0, 0, 0, 0);
        }
        else if(elements[2]=="D"){
            expDate.setDate(expDate.getDate()+1, 1);
            expDate.setHours(0, 0, 0, 0);
        }
        else if(elements[2]=="H"){
            expDate.setHours(expDate.getHours()+1, 0, 0, 0);
        }
        return expDate;
    }

    /**
     * Gets the service corresponding to the specified serviceId and rating group for the given clientContext
     * @param clientContext
     * @param serviceId
     * @param ratingGroup
     */
    function guideService(clientContext, serviceId, ratingGroup){
        var i;
        var service=null;
        var services;
        services=clientContext.plan.services;
        for(i=0; i<services.length; i++){
            if(services[i].ratingGroup==ratingGroup && (services[i].serviceId==0 || services[i].serviceId==serviceId)){
                service=services[i];
                break;
            }
        }

        return service;
    }

    /**
     * Returns an array of ordered credit pools for the target service, as pointers to the clientContext
     * @param clientContext
     * @param service
     */
    function getTargetCreditPools(clientContext, service){

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

        return targetCreditPools;
    }

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

arm.setConfigProperties({
    maxBytesCredit:null,
    maxSecondsCredit:null,
    minBytesCredit:0,
    minSecondsCredit:0,
    expirationRandomSeconds: null});

arm.setupDatabaseConnections().then(function(){
    test();
}, function(err){
    console.log("Initialization error due to "+err);
}).done();


function test(){
    console.log("testing...");

    arm.getClientContext({
        nasPort: 1001,
        nasIPAddress: "127.0.0.1"
    }).then(function(clientContext){
        console.log("Credits before event");
        console.log("---------------------------");
        console.log(JSON.stringify(clientContext.client.creditPools, null, 2));

        var ccElements=[
            {ratingGroup: 101, serviceId: 3, used: {bytes:500, seconds: 3600}},
            {ratingGroup: 101, serviceId: 4, used: {bytes:600, seconds: 3600}}
        ];
        arm.executeCCRequest(clientContext, arm.UPDATE_REQUEST, ccElements);
        ccElements.forEach(function(ccElement){
            if(ccElement.service){
                ccElement.serviceName=ccElement.service.name;
                delete ccElement.service;
            }
        });

        console.log("Credit granted");
        console.log("---------------------------");
        console.log(JSON.stringify(ccElements, null, 2));

        console.log("---------------------------");
        console.log("Credits after event");
        console.log(JSON.stringify(clientContext.client.creditPools, null, 2));

    }, function(err){
        console.log("Error: "+err);
    }).then(function(){
        process.exit(1);
    }).done();
}


