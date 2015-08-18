/**
 * Created by frodriguezg on 27/12/2014.
 *
 * Client and Service API for Lever
 * Requires three MongoDB database connections, for Service Database, Client Database and Event database
 */

var fs=require("fs");
var Q=require("q");
var MongoClient=require("mongodb").MongoClient;

var createArm=function(){

    // Object to be returned
    var arm={};

    // Constants
    arm.INITIAL_REQUEST=1;
    arm.UPDATE_REQUEST=2;
    arm.TERMINATE_REQUEST=3;

    // Database connections
    var configDB;
    var clientDB;
    var eventDB;
    var queryOptions;
    var writeOptions;

    var aLogger={};

    // Initial values, to be overriden by setConfigProperties
    var configProperties={
        maxBytesCredit:null,
        maxSecondsCredit:null,
        minBytesCredit:0,
        minSecondsCredit:0,
        expirationRandomSeconds: null
    };

    /**
     * Returns promise resolved when both connections to databases are established.
     * To be used for standalone testing
     *
     * @returns {*}
     */
    arm.setupDatabaseConnections=function() {
        var dbParams = {};
        dbParams["configDatabaseURL"]=process.env["LEVER_CONFIGDATABASE_URL"];
        dbParams["clientDatabaseURL"]=process.env["LEVER_CLIENTDATABASE_URL"];
        dbParams["eventDatabaseURL"]=process.env["LEVER_EVENTDATABASE_URL"];
        if(!dbParams["configDatabaseURL"]||!dbParams["clientDatabaseURL"]||!dbParams["eventDatabaseURL"]) throw Error("LEVER_CONFIGDATABASE_URL environment variable not set");

        return  Q.all([
                    Q.ninvoke(MongoClient, "connect", dbParams["configDatabaseURL"], dbParams["databaseOptions"]),
                    Q.ninvoke(MongoClient, "connect", dbParams["clientDatabaseURL"], dbParams["databaseOptions"]),
                    Q.ninvoke(MongoClient, "connect", dbParams["eventDatabaseURL"], dbParams["databaseOptions"])
                ]).spread(function(coDb, clDb, evDb){
                    // Store the connections when available
                    configDB=coDb;
                    clientDB=clDb;
                    eventDB=evDb;
                });
    };

    /**
     * Gets database connections already established from external application. Normal use.
     * @param configDatabase
     * @param clientDatabase
     * @param eventDatabase
     * @param qOptions
     * @param wOptions
     */
    arm.setDatabaseConnections=function(configDatabase, clientDatabase, eventDatabase, qOptions, wOptions){
        configDB=configDatabase;
        clientDB=clientDatabase;
        eventDB=eventDatabase;
        queryOptions=qOptions||{};
        writeOptions=wOptions||{};
    };

    /**
     * Inject logger
     * @param logger
     */
    arm.setLogger=function(logger){
        aLogger=logger||{};
    };

    /**
     * Setup configuration properties
     */
    arm.setConfigProperties=function(cp){
        configProperties=cp;
    };

    /**
     * Returns a promise to be fulfilled with the client object, or null if not found
     * clientPoU may have one of the following properties set: "phone", "userName", "nasPort, nasIPAddress"
     * @param clientPoU
     */
    arm.getClient=function(clientPoU){
        var collectionName;

        // Find collection where to do the looking up
        if(clientPoU.phone) collectionName="phones"; else if(clientPoU.userName) collectionName="userNames"; else collectionName="lines";

        var deferred= Q.defer();

        // Find clientId in the appropriate collection
        clientDB.collection(collectionName).findOne(clientPoU, {}, queryOptions, function(err, pou){
            if(err) deferred.reject(err);
            else if(!pou) deferred.resolve(null);
            else{
                // Find the client object given the _id
                clientDB.collection("clients").findOne({clientId: pou.clientId}, {}, queryOptions, function(err, client){
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

        configDB.collection("plans").findOne({name: planName}, {}, queryOptions, function(err, plan){
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
     * @returns {*} null if client not found
     */
    arm.getClientContext=function(clientPoU){
        var clientContext;

        return arm.getClient(clientPoU).
            then(function(client){
                if(!client) return null;
                else{
                    clientContext={client:client};
                    return arm.getPlan(client.provision.planName).
                        then(function(plan){
                            if(plan) clientContext["plan"]=plan;
                            return clientContext;
                        });
                }});
    };

    /**
     * Returns and object with the credit for the specified service.
     * @param clientContext
     * @param service
     * @param eventDate if not specified, will be taken as current date
     * @returns {*}
     */
    arm.getCredit=function(clientContext, service, eventDate){

        if(!eventDate) eventDate=new Date();

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
        var timeFrameData=getTimeFrameData(eventDate, service.calendarName);
        getTargetCreditPools(clientContext, service, timeFrameData.tag).forEach(function(credit){
            // null values will remain unmodified (they mean unlimited credit)
            if(typeof(credit.bytes)=='undefined') creditGranted.bytes=null; else if(credit.bytes!=null && creditGranted.bytes!=null) creditGranted.bytes+=credit.bytes;
            if(typeof(credit.seconds)=='undefined') creditGranted.seconds=null; else if(credit.seconds!=null && creditGranted.seconds!=null) creditGranted.seconds+=credit.seconds;

            // Expiration date for a pool with calendar is the next validity of the timeFrame
            if(credit.calendarTags) if(credit.expirationDate && timeFrameData.endDate.getTime()<credit.expirationDate) credit.expirationDate=timeFrameData.endDate;

            // IMPORTANT: Expiration date is set to minimum value among all credits
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
            // TODO: Check if this is really necessary
            /*
            if (configProperties.maxSecondsCredit){
                if (!creditGranted.expirationDate || creditGranted.expirationDate.getTime() - eventDate.getTime() > configProperties.maxSecondsCredit * 1000) creditGranted.expirationDate = new Date(eventDate.getTime() + configProperties.maxSecondsCredit * 1000);
                else creditGranted.fui=true;
            }
            */

            // Enforce minimum value
            if (configProperties.minBytesCredit) if (creditGranted.bytes && creditGranted.bytes < configProperties.minBytesCredit) creditGranted.bytes = configProperties.minBytesCredit;
            if (configProperties.minSecondsCredit) if (creditGranted.seconds && creditGranted.seconds < configProperties.minSecondsCredit) creditGranted.seconds = configProperties.minSecondsCredit;
            if (configProperties.minSecondsCredit) if (creditGranted.expirationDate && creditGranted.expirationDate.getTime() - eventDate.getTime() < configProperties.minSecondsCredit * 1000) creditGranted.expirationDate = new Date(eventDate.getTime() + configProperties.minSecondsCredit * 1000);
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
     * @param service
     * @param bytes
     * @param seconds
     * @param tag
     */
    arm.discountCredit=function(clientContext, service, bytes, seconds, tag){
        var toDiscount;

        getTargetCreditPools(clientContext, service, tag).forEach(function(credit){
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
                    credit.seconds-=toDiscount;
                }
            }
        });
    };

    /**
     * Creates or updates the client recurring credits
     * @param clientContext
     * @eventDate
     */
    arm.updateRecurringCredits=function(clientContext, eventDate){

        if(!eventDate) eventDate=new Date();

        var i;
        var creditPools;
        var creditPool=null;
        var currentTime=eventDate.getTime();

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
                                creditPool.expirationDate=getNextExpirationDate(eventDate, recharge.validity, clientContext.client.billingDay);
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
                            expirationDate: getNextExpirationDate(eventDate, recharge.validity, clientContext.client.billingDay)
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
     * @param eventDate
     */
    arm.cleanupCredits=function(clientContext, eventDate){

        if(!eventDate) eventDate=new Date();
        var currentTime=eventDate.getTime();

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
     * Returns promise to be solved after writing event and updated credit. Event writing does not cause
     * failure in promise
     *
     * @param clientContext
     * @param ccRequestType
     * @param sessionId
     * @param eventDate
     * @param ccElements array of {
     *      serviceId:<>,       --> input
     *      ratingGroup: <>,    --> input
     *      service: <>,        --> output
     *      used: {             --> input
     *          startDate: <>   ==> Calculated for internal use (in break event)
     *          bytesDown: <>,  ==> Discounted from the bytes of the credit pool
     *          bytesUp: <>,
     *          seconds: <>
     *      },
     *      granted: {          --> output
     *          bytes: <>,
     *          seconds: <>,
     *          expirationDate: <>,
     *          fui: <>,        // Final Unit Indication
     *          fua: <>
     *     }
     *
     * ccElements are decorated with serviceNames
     *
     * Each ccElement is broken into events in single timeFrame and discounting is performed. Resources
     * are discounted from the pools with no calendar tag or a matching calendar tag.
     *
     * After that, recurring credits are generated and expired pools are deleted
     *
     * Finally, new granted units are calculated. The tag for the eventDate is obtained, and credit is
     * drawn from the pools with matching or no tag. If matching tag, expiration date is calculated for
     * that particular pool as the date of the end of the current timeFrame.
     */
    arm.executeCCRequest=function(clientContext, ccRequestType, ccElements, sessionId, eventDate){

        if(!eventDate) eventDate=new Date();

        // First discount credit without updating recurrent credits or deleting expired items
        if(ccRequestType==arm.UPDATE_REQUEST || ccRequestType==arm.TERMINATE_REQUEST){
            ccElements.forEach(function(ccElement){
                // Decorate with service
                if(!ccElement.service) ccElement.service=guideService(clientContext, ccElement.serviceId, ccElement.ratingGroup);
                var brokenCCElements=arm.breakCCElement(ccElement, ccElement.service.calendarName);
                // Do discount
                if(ccElement.service){
                    brokenCCElements.forEach(function(brokenCCElement){
                        arm.discountCredit(clientContext, ccElement.service, (brokenCCElement["used"]||{}).bytesDown, (brokenCCElement["used"]||{}).seconds, brokenCCElement.tag);
                    });
                } else throw new Error("Service not found for event "+JSON.stringify(ccElement));
            });
        }

        // Update recurrent credits and do cleanup
        arm.updateRecurringCredits(clientContext, eventDate);
        arm.cleanupCredits(clientContext, eventDate);

        // Decorate with credits granted
        if(ccRequestType==arm.INITIAL_REQUEST || ccRequestType==arm.UPDATE_REQUEST){
            ccElements.forEach(function(ccElement){
                // Decorate with service if not done yet
                if(!ccElement.service) ccElement.service=guideService(clientContext, ccElement.serviceId, ccElement.ratingGroup);
                if(ccElement.service) ccElement.granted=arm.getCredit(clientContext, ccElement.service, eventDate);
                else throw new Error("Service not found for event "+JSON.stringify(ccElement));
            });
        }

        // WriteEvent
        return arm.writeCCEvent(clientContext, ccRequestType, ccElements, sessionId, eventDate).
            catch(function(err){
                aLogger.error("Could not write ccEvent due to: "+err.message);
            }).
            then(function(){
                // Update client credits
                if(clientContext.client.creditsDirty) {
                    return Q.ninvoke(clientDB.collection("clients"), "updateOne",
                        {clientId: clientContext.client.clientId},
                        {$set: {"creditPools": clientContext.client.creditPools}},
                        writeOptions);
                }
                else return null;
            });
    };

    /**
     * Returns promise to be resolved when event is written to database or error.
     * ccEvents parameter is cleaned up
     *
     * @param clientContext
     * @param ccRequestType
     * @param ccElements (cleaned up!)
     * @param sessionId
     * @parame eventDate
     *
     * CCEvent={
     *  clientId,
     *  eventTimestap,
     *  sessionId,
     *  ccRequestType,
     *  ccElements: [<array of ccElements>]
     *  }
     */
    arm.writeCCEvent=function(clientContext, ccRequestType, ccElements, sessionId, eventDate){

        if(!eventDate) eventDate=new Date();
        var eventTimestamp=eventDate.getTime();

        // Cleanup all service data attached to the credit element
        ccElements.forEach(function (ccElement) {
            if (ccElement.service) {
                ccElement.serviceName = ccElement.service.name;
                delete ccElement.service;
            }
        });

        var event={
            clientId: clientContext.client.clientId,
            eventTimestamp: eventTimestamp/1000,
            sessionId: sessionId,
            ccRequestType: ccRequestType,
            ccElements: ccElements
        };

        return Q.ninvoke(eventDB.collection("ccEvents"), "insertOne", event, writeOptions);
    };

    /**
     * Returns an array of events, each one spanning only one calendar item
     * @param ccElement
     * @param calendar
     * @returns {Array}
     *
     * ccElement={
     *      serviceId: <>,
     *      ratingGroup: <>,
     *      service: <>,
     *      eventDate: <>,
     *      sessionId: <>,
     *      used: {
     *          startDate. <>, --> Calculated
     *          bytesDown: <>,
     *          bytesUp: <>,
     *          seconds: <>
     *      },
     *      tag: <> --> Calculated
     * }
     */
    arm.breakCCElement=function(ccElement, calendar){

        // Do nothing if no calendar specified
        if(!calendar) return [ccElement];

        var i;
        var fragmentSeconds;
        var remainingSeconds=ccElement.used.seconds;
        var nextTimeFrame;
        var nextDate=new Date(ccElement.eventDate.getTime()-1000*ccElement.used.seconds); // Start date
        var brokenCCElements=[];

        while(remainingSeconds>0){
            // Iterate through all calendar items
            for(i=0; i<calendar.calendarItems.length; i++){
                nextTimeFrame=getTimeFrameEndDate(nextDate, calendar.calendarItems[i]);
                if(nextTimeFrame!=null){
                    fragmentSeconds=(nextTimeFrame.getTime()-nextDate.getTime())/1000;
                    if(fragmentSeconds>remainingSeconds) fragmentSeconds=remainingSeconds;
                    brokenCCElements.push({
                        serviceId: ccElement.serviceId,
                        ratingGroup: ccElement.ratingGroup,
                        service: ccElement.service,
                        eventDate: ccElement.eventDate,
                        sessionId: ccElement.sessionId,
                        used:{
                            startDate: nextDate,
                            seconds: fragmentSeconds,
                            bytesUp: Math.round(ccElement.used.bytesUp*fragmentSeconds/ccElement.used.seconds),
                            bytesDown: Math.round(ccElement.used.bytesDown*fragmentSeconds/ccElement.used.seconds)
                        },
                        tag: calendar.calendarItems[i].tag||"default"
                    });
                    nextDate=nextTimeFrame;
                    remainingSeconds-=fragmentSeconds;
                    break;
                }
            }
            if(nextTimeFrame==null) throw new Error("Bad calendar "+calendar.name);
        }

        return brokenCCElements;
    };

    ////////////////////////////////////////////////////////////////////////////
    // Supporting functions
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Returns the expiration date given the current date and a validity in (M)onths, (D)ays or (H)ours
     * @param eventDate
     * @param validity
     * @param billingDay
     * @returns {*}
     */
    function getNextExpirationDate(eventDate, validity, billingDay){
        var elements=/([0-9]+)([CMDHmdh])/.exec(validity);
        if(elements.length!=3) throw new Error("Bad validity specification "+validity);

        var expDate=eventDate;

        if(elements[2]=="C"){
            if(eventDate.getDate()>=billingDay) expDate.setMonth(expDate.getMonth()+1);
            expDate.setDate(billingDay);
            expDate.setHours(0, 0, 0, 0);
        }
        if(elements[2]=="M"){
            expDate.setMonth(expDate.getMonth()+1, 1);
            expDate.setHours(0, 0, 0, 0);
        }
        else if(elements[2]=="D"){
            expDate.setDate(expDate.getDate()+1);
            expDate.setHours(0, 0, 0, 0);
        }
        else if(elements[2]=="H"){
            expDate.setHours(expDate.getHours()+1, 0, 0, 0);
        }
        else if(elements[2]=="m"){
            expDate.setMonth(expDate.getMonth()+1);
        }
        else if(elements[2]=="d"){
            expDate.setDate(eventDate.getDate()+1);
        }
        else if(elements[2]=="h"){
            expDate.setHours(expDate.getHours()+1);
        }
        return expDate;
    }

    /**
     * Gets the service corresponding to the specified serviceId and rating group for the given clientContext
     * The service matched must have the same ratingGroup and (same serviceId or serviceId=0)
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
     * @param tag
     */
    function getTargetCreditPools(clientContext, service, tag){

        var targetCreditPools=[];

        var clientCreditPools=clientContext.client.creditPools;
        service.creditPoolNames.forEach(function(servicePoolName){
            clientCreditPools.forEach(function(clientPool){
                if(clientPool.poolName==servicePoolName){
                    // Include pool if matching calendarTag
                    if(clientPool.calendarTags){
                        for(var c=0; c<clientPool.calendarTags.length; c++){
                            if(clientPool.calendarTags[c]==tag){ targetCreditPools.push(clientPool); break}
                        }
                    }
                    // Include pool if client pool has no calendarTag
                    else targetCreditPools.push(clientPool);
                }
            });
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
    function getTimeFrameEndDate(date, calendarItem){
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
            var currentWeeklyTimeSeconds=date.getDay()*86400+date.getHours()*3600+date.getMinutes()*60+date.getSeconds();
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
            var currentDailyTimeSeconds=date.getHours()*3600+date.getMinutes()*60+date.getSeconds();
            if(endDailyTimeSeconds>startDailyTimeSeconds && (currentDailyTimeSeconds>=startDailyTimeSeconds && currentDailyTimeSeconds<endDailyTimeSeconds)||
                endDailyTimeSeconds<startDailyTimeSeconds && (currentDailyTimeSeconds<endDailyTimeSeconds || currentDailyTimeSeconds>=startDailyTimeSeconds)){
                // Set next date
                nextDate.setSeconds(nextDate.getSeconds()+(endDailyTimeSeconds-currentDailyTimeSeconds));
                if(endDailyTimeSeconds<currentDailyTimeSeconds) nextDate.setSeconds(nextDate.getSeconds()+86400);
                return nextDate;
            } else return null;
        }
    }

    /**
     * Returns the tag and endDate corresponding to a specific date in specific calendar.
     * 
     * @param date
     * @param calendar
     * @returns {*}
     */
    function getTimeFrameData(date, calendar){
        var emptyTimeFrameData={tag: null, endDate: null};

        if(!calendar) return emptyTimeFrameData;

        var endDate;
        for(var i=0; i<calendar.calendarItems.length; i++){
            endDate=getTimeFrameEndDate(date, calendar.calendarItems[i]);
            if(endDate)  return {tag: calendar.calendarItems[i].tag, endDate: endDate};
        }
        // Should never be here
        return emptyTimeFrameData;
    }
    
    return arm;
};

exports.arm=createArm();

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
    serviceId: 0,
    ratingGroup: 0,
    service: "none",
    eventDate: new Date(),
    sessionId: "1-1",
    used:{
        bytesDown:1000,
        bytesUp:1000,
        seconds:300000
    }
};

/*
console.log(serviceMgr.getTimeFrameEndDate(
    new Date("2015-01-07T18:30:00"),
    {
        type: 3,
        startTime: "07:00",
        endTime: "20:00"
    }
));
*/

var arm=exports.arm;
//unitTest();

//var brokenEvents=arm.breakCCElement(event, speedyNightCalendar);
//console.log(JSON.stringify(brokenEvents, null, 2));

function unitTest() {

    arm.setConfigProperties({
        maxBytesCredit: 2*1024*1024*1024,
        maxSecondsCredit: null,
        minBytesCredit: 0,
        minSecondsCredit: 0,
        expirationRandomSeconds: null});

    arm.setupDatabaseConnections().then(function () {
        test();
    }, function (err) {
        console.log("Initialization error due to " + err);
    }).done();


    function test() {
        console.log("testing...");

        arm.getClientContext({
            nasPort: 1001,
            nasIPAddress: "127.0.0.1"
        }).then(function (clientContext) {
            console.log("");
            console.log("Credits before event");
            console.log("---------------------------");
            console.log(JSON.stringify(clientContext.client.creditPools, null, 2));

            var ccElements = [
                {ratingGroup: 101, serviceId: 3, used: {bytes: 500, seconds: 3600}},
                {ratingGroup: 101, serviceId: 4, used: {bytes: 600, seconds: 3600}}
            ];

            arm.executeCCRequest(clientContext, arm.UPDATE_REQUEST, ccElements, "1-1", null).
                then(function(){
                        // Clean up all verbose info
                        ccElements.forEach(function (ccElement) {
                            if (ccElement.service) {
                                ccElement.serviceName = ccElement.service.name;
                                delete ccElement.service;
                            }
                        });

                        console.log("Credits granted");
                        console.log("---------------------------");
                        console.log(JSON.stringify(ccElements, null, 2));

                        console.log("");
                        console.log("Credits after event");
                        console.log("---------------------------");
                        console.log(JSON.stringify(clientContext.client.creditPools, null, 2));

                    }, function(err){
                        console.log("Error updating credit: "+err.message);
                    });

        }, function (err) {
            console.log("Error getting client: " + err.message);
        }).done();
    }
}