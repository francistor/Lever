/**
 * Created by frodriguezg on 27/12/2014.
 *
 * Client and Service API for Lever
 * Requires three MongoDB database connections, for Service Database, Client Database and Event database
 */

var fs=require("fs");
var Q=require("q");
var request=require('request');
var MongoClient=require("mongodb").MongoClient;
var ObjectID=require('mongodb').ObjectID;

var phoneRegEx=/[0-9]{9,11}/;
var nasIPAddressRegEx=/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/;
var nasPortRegEx=/[0-9]{1,10}/;
var userNameRegEx=/.+@.+/;

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

    // Logger injected externally
    var logger={};

    // Initial values, to be overriden by setConfigProperties
    var configProperties={
        maxBytesCredit:null,
        maxSecondsCredit:null,
        minBytesCredit:0,
        minSecondsCredit:0,
        expirationRandomSeconds: null,
        ooCQuarantineSeconds: 300,
        itSinkTimeoutMillis: 1000
    };

    // Cache of configured plans
    var plansCache={};
    // Cache of calendars
    var calendarsCache={};

    /**
     * Returns promise resolved when both connections to databases are established.
     * To be used for standalone testing. Connection URLs to be got from environment variables
     * only
     *
     * @returns {*}
     */
    arm.pSetupDatabaseConnections=function() {
        var dbParams = {};
        dbParams["configDatabaseURL"]=process.env["LEVER_CONFIGDATABASE_URL"];
        dbParams["clientDatabaseURL"]=process.env["LEVER_CLIENTDATABASE_URL"];
        dbParams["eventDatabaseURL"]=process.env["LEVER_EVENTDATABASE_URL"];
        if(!dbParams["configDatabaseURL"]||!dbParams["clientDatabaseURL"]||!dbParams["eventDatabaseURL"]) throw Error("Missing database URL environment variable");

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
     * Sets database connections already established from external application.
     * Normal use.
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
     * For testing only
     * @returns {{configDB: *, clientDB: *, eventDB: *}}
     */
    arm.getDatabaseConnections=function(){
        return {configDB: configDB, clientDB: clientDB, eventDB: eventDB}
    };


    /**
     * Setup configuration properties
     */
    arm.setConfigProperties=function(cp){
        configProperties.maxBytesCredit=cp.maxBytesCredit||configProperties.maxBytesCredit;
        configProperties.maxSecondsCredit=cp.maxSecondsCredit||configProperties.maxSecondsCredit;
        configProperties.minBytesCredit=cp.minBytesCredit||configProperties.minBytesCredit;
        configProperties.minSecondsCredit=cp.minSecondsCredit||configProperties.minSecondsCredit;
        configProperties.expirationRandomSeconds=cp.expirationRandomSeconds||configProperties.expirationRandomSeconds;
        configProperties.ooCQuarantineSeconds=cp.ooCQuarantineSeconds||configProperties.ooCQuarantineSeconds;
        configProperties.itSinkTimeoutMillis=cp.itSinkTimeoutMillis||configProperties.itSinkTimeoutMillis;
    };

    /**
     * Inject logger
     * @param l
     */
    arm.setLogger=function(l){
        logger=l||{};
    };

    /** Returns promise to be resolved when plans and calendars are read
     *  To be called on initialization.
     *
     *  Applications SHOULD call this function periodically, using
     *  a timer function
     */
    arm.pReloadPlansAndCalendars=function(){
        var deferred= Q.defer();

        var newPlansCache={}, newCalendarsCache={};

        // Read plans
        configDB.collection("plans").find({}).toArray(function(err, plansArray){
            if(err) deferred.reject(err);
            else{
                configDB.collection("calendars").find({}).toArray(function(err, calendarsArray){
                    if(err) deferred.reject(err);
                    else {
                        // Cook result
                        plansArray.forEach(function (plan) {
                            newPlansCache[plan["name"]] = plan;
                        });
                        calendarsArray.forEach(function (calendar) {
                            newCalendarsCache[calendar["name"]] = calendar;
                        });

                        // Swap
                        plansCache = newPlansCache;
                        calendarsCache = newCalendarsCache;

                        deferred.resolve(null);
                    }
                });
            }
        });

        return deferred.promise;
    };

    /**
     * Returns a promise to be fulfilled with the client object, given the _id
     * or legacyClientId.
     *
     * Resolves to null if not found
     *
     * @param clientData object containing _id or provision.legacyClientId
     * @returns {*} promise
     */
    arm.pGetClient=function(clientData){
        var deferred= Q.defer();

        if(clientData._id && typeof(clientData._id)=="string") clientData._id=ObjectID.createFromHexString(clientData._id);

        // Find client
        clientDB.collection("clients").findOne(clientData, {}, queryOptions, function(err, client){
            if(err) deferred.reject(err);
            else{
                if(!client) deferred.resolve(null); else deferred.resolve(client);
            }
        });

        return deferred.promise;
    };

    /**
     * Returns a promise to be fulfilled with the client object, or null if not found
     * clientPoU may have one of the following properties set: "phone", "userName", "nasPort, nasIPAddress"
     *
     * Resolves to null if not found
     *
     * @param clientPoU
     * @returns {*} promise
     */
    arm.pGetGuidedClient=function(clientPoU){
        var collectionName;

        // Find collection where to do the looking up
        if(clientPoU.phone) collectionName="phones"; else if(clientPoU.userName) collectionName="userNames"; else if(clientPoU.nasPort && clientPoU.nasIPAddress) collectionName="lines";
        else throw Error("Bad clientPoU "+JSON.stringify(clientPoU));

        var deferred= Q.defer();

        // Find _id in the appropriate collection
        clientDB.collection(collectionName).findOne(clientPoU, {}, queryOptions, function(err, pou){
            if(err) deferred.reject(err);
            else{
                if (!pou) deferred.resolve(null);
                else arm.pGetClient({_id: pou.clientId}).then(function (client) {
                    deferred.resolve(client);
                }, function (err) {
                    deferred.reject(err);
                });
            }
        });

        return deferred.promise;
    };

    /**
     * Returns promise containing an object will all Points of Usage for the specified clientId.
     *
     * @param _id
     * @returns {*} promise
     */
    arm.pGetClientAllPoU=function(_id){
        return Q.all(
            // Connect to all three databases
            [
                Q.ninvoke(clientDB.collection("phones").find({clientId: _id}, {}, queryOptions), "toArray"),
                Q.ninvoke(clientDB.collection("userNames").find({clientId: _id}, {}, queryOptions), "toArray"),
                Q.ninvoke(clientDB.collection("lines").find({clientId: _id}, {}, queryOptions), "toArray")
            ]).spread(function(phones, userNames, lines){
                return {
                    phones: phones,
                    userNames: userNames,
                    lines: lines
                }
            });
    };

    /**
     * Returns a plan object, if applicable decorated with calendars on each service
     * @param planName
     * @returns {*} plan object
     */
    arm.planInfo=function(planName){
        var thisPlan=plansCache[planName];

        // Decorate with calendars
        if(thisPlan){
            if(thisPlan.services) thisPlan.services.forEach(function(service){
                if(service.calendarName){
                    service.calendar=calendarsCache[service.calendarName];
                }
            });
        }

        return thisPlan;
    };

    /**
     * Returns a promise to be resolved with a client context object, which contains a "client"
     * attribute and a "plan" attribute
     * @param clientData, containing and _id or legacyClientId attribute
     * @returns {*} promise
     */
    arm.pGetClientContext=function(clientData){

        return arm.pGetClient(clientData).
            then(function(client){
                return buildClientContext(client);
            });
    };

    /**
     * Returns a promise to be resolved with the ClientContext object, which contains a "client" attribute and a
     * "plan" attribute. Promise is resolved to null if client is not found
     * @param clientPoU
     * @returns {*} promise
     */
    arm.pGetGuidedClientContext=function(clientPoU){

        return arm.pGetGuidedClient(clientPoU).
            then(function(client){
                return buildClientContext(client);
            });
    };

    /** Returns promise to be resolved with the client object
     *
     * @param query may contain a point of usage or an attribute of the client object
     * @returns {*} promise
     */
    arm.pFindClient=function(query){
        if(query.hasOwnProperty("phone") || query.hasOwnProperty("nasIPAddress") || query.hasOwnProperty("userName")) return arm.pGetGuidedClient(query);
        else return arm.pGetClient(query);
    };

    /** Returns promise to be resolved with the clientContext object
     *
     * @param query may contain a point of usage or an attribute of the client object
     * @returns {*} promise
     */
    arm.pFindClientContext=function(query){
        if(query.hasOwnProperty("phone") || query.hasOwnProperty("nasIPAddress") || query.hasOwnProperty("userName")) return arm.pGetGuidedClientContext(query);
        else return arm.pGetClientContext(query);
    };

    /**
     * Creates a new client given the provision data only.
     * Returns a promise to be solved to true if the client was created
     *
     * @param clientProvisionData
     */
    arm.pCreateClient=function(clientProvisionData){
        // Make sure there is nothing but the provision property
        for(var propertyName in clientProvisionData) if(client.hasOwnProperty(propertyName) && propertyName!="provision") delete clientProvisionData[propertyName];

        clientProvisionData.provision._version=1;

        return clientDB.collection("clients").insertOne(clientProvisionData, writeOptions).then(function(result){
            if(result.insertedCount==1) return true;
            else throw new Error("Client was not created");
        });
    };


    /**
     * Deletes the client with the specified id
     * Returns a promise to be solved to true when the client is deleted, false if the client is not found
     * @param clientId
     */
    arm.pDeleteClient=function(clientId){
        var _id;
        if(typeof(clientId)=="string") _id=ObjectID.createFromHexString(clientId); else _id=clientId;

        return clientDB.collection("lines").deleteMany({clientId: _id}).
            then(function(){
                return clientDB.collection("userNames").deleteMany({clientId: _id});
            }).
            then(function(){
                return clientDB.collection("phones").deleteMany({clientId: _id});
            }).
            then(function(){
                return clientDB.collection("clients").deleteOne({_id: _id});
            }).
            then(function(result){
                return result.deletedCount == 1;
            });
    };

    /**
     * Returns a promise solved when the specified point of usage is added to the specified clientId
     *
     * @param clientId
     * @param pointOfUsage
     * @returns {*}
     */
    arm.pAddPoU=function(clientId, pointOfUsage){

        var _id;
        if(!clientId) throw new Error("clientId not specified");
        if(typeof(clientId)=="string") _id=ObjectID.createFromHexString(clientId); else _id=clientId;

        var pouDocument={clientId: _id};
        var pouCollection;

        if(pointOfUsage.hasOwnProperty("phone")){
            if(!phoneRegEx.test(pointOfUsage.phone)) return Q.reject(new Error("Bad phone"));
            pouCollection="phones";
            pouDocument.phone=pointOfUsage.phone;
        } else if(pointOfUsage.hasOwnProperty("userName")){
            if(!userNameRegEx.test(pointOfUsage.userName)) return Q.reject(new Error("Bad userName"));
            pouCollection="userNames";
            pouDocument.userName=pointOfUsage.userName;
        } else if(pointOfUsage.hasOwnProperty("nasIPAddress")){
            if(!nasIPAddressRegEx.test(pointOfUsage.nasIPAddress)) return Q.reject(new Error("Bad NAS-IP-Address"));
            if(!nasPortRegEx.test(pointOfUsage.nasPort)) return Q.reject(new Error("Bad NAS-Port"));
            pouCollection="lines";
            pouDocument.nasIPAddress=pointOfUsage.nasIPAddress;
            pouDocument.nasPort=pointOfUsage.nasPort;
        } else throw new Error(new Error("Bad point of usage"));

        return clientDB.collection(pouCollection).insertOne(pouDocument, writeOptions);
    };

    /**
     * Returns a promise solved when the point of usage is deleted
     */
    arm.pDeletePoU=function(pointOfUsage){

        if(typeof(pointOfUsage._id)=="string") pointOfUsage._id=ObjectID.createFromHexString(pointOfUsage._id);
        if(typeof(pointOfUsage.clientId)=="string") pointOfUsage.clientId=ObjectID.createFromHexString(pointOfUsage.clientId);

        if(pointOfUsage.hasOwnProperty("phone")){
            return clientDB.collection("phones").deleteMany(pointOfUsage, writeOptions);
        } else if(pointOfUsage.hasOwnProperty("userName")){
            return clientDB.collection("userNames").deleteMany(pointOfUsage, writeOptions);
        } else if(pointOfUsage.hasOwnProperty("nasIPAddress")){
            return clientDB.collection("lines").deleteMany(pointOfUsage, writeOptions);
        } else throw new Error(new Error("Bad point of usage"));
    };

    /**
     * Returns a promise to be solved when the provision data is updated. Fails if the client is not updated,
     * probably because of a concurrent modification.
     *
     * @param clientProvisionData
     */
    arm.pUpdateClientProvisionData=function(clientProvisionData){

        if(typeof(clientProvisionData._id)=="string") clientProvisionData._id=ObjectID.createFromHexString(clientProvisionData._id);
        clientProvisionData.provision._version++;

        return clientDB.collection("clients").updateOne(
            {_id: clientProvisionData._id, "provision._version": clientProvisionData.provision._version-1},
            {$set: {provision: clientProvisionData.provision}}
        ).then(function(result){
            if(result.modifiedCount!=1) throw new Error("Client was not updated. Data was modified by another user");
        });
    };

    /** 
        Returns promise to be resolved when the recharge is executed and written to database

         The promise resolves to:
         - true if recharge authorized and performed
         - false if the recharge was not applicable or not authorized
         - failure in case of error

        buyRecharge(clientId, rechargeName) --> pDoRecharge(client, recharge) --> validate; addRechargeToCreditPool(); writePurchaseEvent
    */
    arm.pBuyRecharge=function(clientContext, rechargeName, eventDate){

        // Find the recharge object to pass to pDoRecharge()
        var recharges=clientContext.plan.recharges||[];
        for(var i=0; i<recharges.length; i++){
            if(recharges[i].name==rechargeName) return pDoRecharge(clientContext.client, recharges[i], eventDate).then(function(rechargeDone){

               if(!rechargeDone) return false;

                // Update client credits in database
               return Q.ninvoke(clientDB.collection("clients"), "updateOne",
                    {"_id": clientContext.client._id, "credit._version": clientContext.client.credit._version},
                    {$set: {"credit": {_version: clientContext.client.credit._version+1, creditPools: clientContext.client.credit.creditPools}}}, writeOptions).
                    then(function(updateResult){
                    // Commit to itSink
                    if(updateResult.modifiedCount==1){
                        if((clientContext.client.credit||{}).commitRequests) for(var k=0; k<clientContext.client.credit.commitRequests.length; k++){
                            if(logger.isDebugEnabled) logger.debug("Invoking commit for %s", clientContext.client.provision.legacyClientId);
                            request.post(clientContext.client.credit.commitRequests[k], function(error, response /* ,body*/){
                                // Commit response received
                                if(!error){
                                    if(logger.isVerboseEnabled) logger.verbose("Purchase commited with result code %d", response.statusCode);
                                } else {
                                    if(logger.isErrorEnabled) logger.error("Could not commit purchase for %d due to %s", clientContext.client._id, error.message);
                                }
                            });
                        }
                        return true;
                    } else{
                        if(logger.isErrorEnabled) logger.error("Concurrent modification exception for %d", clientContext.client._id);
                        throw new Error("Concurrent modification exception");
                    }
                });
            });
        }

        // No recharge found
        return Q.reject(new Error("No recharge with name "+rechargeName));
    };

    /**
     * Returns and object with the credit for the specified service.
     * @param clientContext
     * @param service
     * @param eventDate if not specified, will be taken as current date
     * @param isOnlineSession if true, randomization and minimum/maximum values are applied. Use 'false' to
     * show credit to the user or in management applications. Use 'true' in CreditControl
     * @returns {*}
     */
    arm.getCreditFromClientContext=function(clientContext, service, eventDate, isOnlineSession){

        if(!service) throw new Error("arm.getCredit: service is empty");

        if(!eventDate) eventDate=new Date();

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
            if(logger.isDebugEnabled) logger.debug("arm.getCredit: Service without credit control");
            return creditGranted;
        }

        // Expiration date for a service with calendar is at most the next validity of the timeFrame
        // if onlineSession only
        var timeFrameData=getTimeFrameData(eventDate, service.calendar);
        if(isOnlineSession && timeFrameData.endDate) creditGranted.expirationDate=timeFrameData.endDate;

        // Add credit by iterating through the credit pools
        getTargetCreditPools(clientContext, service, timeFrameData.tag).forEach(function(creditPool){
            // Skip expired pools
            if(creditPool.expirationDate && creditPool.expirationDate.getTime()<=eventDate.getTime()) return;

            // null values will remain unmodified (they mean unlimited credit)
            if(typeof(creditPool.bytes)!='number'||creditPool.mayUnderflow) creditGranted.bytes=null; else if(creditPool.bytes!=null && creditGranted.bytes!=null) creditGranted.bytes+=creditPool.bytes;
            if(typeof(creditPool.seconds)!='number'||creditPool.mayUnderflow) creditGranted.seconds=null; else if(creditPool.seconds!=null && creditGranted.seconds!=null) creditGranted.seconds+=creditPool.seconds;

            // IMPORTANT: Expiration date is set to minimum value among all credits
            if(!creditGranted.expirationDate) creditGranted.expirationDate=creditPool.expirationDate;
            else if(creditPool.expirationDate && creditPool.expirationDate.getTime()<=creditGranted.expirationDate.getTime()) creditGranted.expirationDate=creditPool.expirationDate;
        });

        // If any resource is zero, should be returned as zero
        // isFinal flag is only set if maxSeconds or maxBytes is defined
        if(creditGranted.bytes!==0 && creditGranted.seconds!==0) {
            // Enforce maximum value
            if (configProperties.maxBytesCredit && isOnlineSession){
                if (!creditGranted.bytes || creditGranted.bytes > configProperties.maxBytesCredit) creditGranted.bytes = configProperties.maxBytesCredit;
                else creditGranted.fui=true;
            }
            if (configProperties.maxSecondsCredit && isOnlineSession){
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
            if (configProperties.minBytesCredit && isOnlineSession) if (creditGranted.bytes && creditGranted.bytes < configProperties.minBytesCredit) creditGranted.bytes = configProperties.minBytesCredit;
            if (configProperties.minSecondsCredit && isOnlineSession) if (creditGranted.seconds && creditGranted.seconds < configProperties.minSecondsCredit) creditGranted.seconds = configProperties.minSecondsCredit;
            if (configProperties.minSecondsCredit && isOnlineSession) if (creditGranted.expirationDate && creditGranted.expirationDate.getTime() - eventDate.getTime() < configProperties.minSecondsCredit * 1000) creditGranted.expirationDate = new Date(eventDate.getTime() + configProperties.minSecondsCredit * 1000);
        }

        // Randomize validity date, but only if expiration date looks like a day or month edge
        if(configProperties.expirationRandomSeconds && isOnlineSession) if(creditGranted.expirationDate && creditGranted.expirationDate.getMinutes()==0 && creditGranted.expirationDate.getSeconds()==0){
            creditGranted.expirationDate=new Date(creditGranted.expirationDate.getTime()+Math.floor(Math.random()*1000*configProperties.expirationRandomSeconds));
        }
        return creditGranted;
    };

    /**
     * Updates the clientContext object passed with the credits updated and marks dirtyCreditPools if applicable
     * @param clientContext
     * @param service
     * @param bytes
     * @param seconds
     * @param tag
     */
    arm.discountCreditFromClientContext=function(clientContext, service, bytes, seconds, tag){
        var toDiscount;

        getTargetCreditPools(clientContext, service, tag).forEach(function(creditPool){
            // All credits are here valid (i.e. before expiration date)

            // Discount the bytes
            if(!(typeof(creditPool.bytes)!='number') && bytes){
                clientContext.client.creditsDirty=true;
                if(creditPool.mayUnderflow) {
                    creditPool.bytes-=bytes;
                    bytes=0;
                }
                else{
                    toDiscount=Math.min(creditPool.bytes, bytes);
                    creditPool.bytes-=toDiscount;
                    bytes-=toDiscount;
                }
            }
            // Discount the seconds
            if(!(typeof(creditPool.seconds)!='number') && seconds){
                clientContext.client.creditsDirty=true;
                if(creditPool.mayUnderflow) {
                    creditPool.seconds-=seconds;
                    seconds=0;
                }
                else{
                    toDiscount=Math.min(creditPool.seconds, seconds);
                    creditPool.seconds-=toDiscount;
                    seconds-=toDiscount;
                }
            }
        });
    };

    /**
     * Returns promise to be solved after having written the event and having updated the credit.
     * for the client. The passed ccElements are decorated with the "granted" units 
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
     * that particular pool as the date of the end of the current timeFrame. Since expiration date is set
     * to the minimum among all credit pools, expiration will be at most the date of the next timeframe
     */
    arm.pExecuteCCRequest=function(clientContext, ccRequestType, ccElements, sessionId, eventDate){

        if(!ccElements) throw new Error("executeCCRequest: empty ccElements");
        if(!eventDate) eventDate=new Date();

        // First discount credit without updating recurrent credits or deleting expired items
        if(ccRequestType==arm.UPDATE_REQUEST || ccRequestType==arm.TERMINATE_REQUEST){
            ccElements.forEach(function(ccElement){
                // Decorate with service
                if(!ccElement.service) ccElement.service=guideService(clientContext, ccElement.serviceId, ccElement.ratingGroup);
                var brokenCCElements=arm.breakCCElement(ccElement, ccElement.service.calendar, eventDate);
                // Do discount
                if(ccElement.service){
                    brokenCCElements.forEach(function(brokenCCElement){
                        arm.discountCreditFromClientContext(clientContext, ccElement.service, (brokenCCElement["used"]||{}).bytesDown, (brokenCCElement["used"]||{}).seconds, brokenCCElement.tag);
                    });
                } else throw new Error("Service not found for event "+JSON.stringify(ccElement));
            });
        }

        var perUseRecharges=[];
        var perUseRechargeNamesPushed=[];

        // Update recurrent credits and do cleanup
        return pUpdateRecurringCreditsFromClientContext(clientContext, eventDate).
           then(function(/*perUseRechargesSnapshots[], not used*/){  // Array of promises snapshots. Could get final status using [i].state === "fulfilled" || "rejected"
           /*
           if(rechargesStatus.length>0){
               clientContext.client.creditsDirty=true;
           }
           */
        }).then(function() {
            cleanupCreditsFromClientContext(clientContext, eventDate);

            // Decorate with credits granted
            if (ccRequestType == arm.INITIAL_REQUEST || ccRequestType == arm.UPDATE_REQUEST) {
                ccElements.forEach(function (ccElement) {
                    // Decorate with service if not done yet
                    if (!ccElement.service) ccElement.service = guideService(clientContext, ccElement.serviceId, ccElement.ratingGroup);
                    if (ccElement.service) ccElement.granted = arm.getCreditFromClientContext(clientContext, ccElement.service, eventDate, true);

                    // Fill promises for per-use credits
                    // Each update will perform authorization/update of commit URL (if applicable), writing of event, update of credit elements
                    if (ccElement.granted.bytes == 0 || ccElement.granted.seconds == 0) perUseRecharges.push(pUpdatePerUseCredit(clientContext, ccElement.service, perUseRechargeNamesPushed, eventDate));
                });
            }

            // Settled promise is never rejected
            if(perUseRecharges.length==0) return Q(null); else return Q.allSettled(perUseRecharges);

        }).then(function(/*perUseRechargesSnapshots[], not used*/){ // Array of promises snapshots. Could get final status using [i].state === "fulfilled" || "rejected"

            // Re-evaluate credits for which there might be per-use purchases here (granted was 0)
            ccElements.forEach(function (ccElement) {
                if(ccElement.granted) if (ccElement.granted.bytes == 0 || ccElement.granted.seconds == 0) ccElement.granted=arm.getCreditFromClientContext(clientContext, ccElement.service, eventDate, true);
            });

            // WriteEvent and update credits
            return pWriteCCEvent(clientContext, ccRequestType, ccElements, sessionId, eventDate).
            catch(function(err){
                if(logger.isErrorEnabled) logger.error("Could not write ccEvent due to %s", err.message);
            }).
            then(function(){
                // Update client credits
                if(clientContext.client.creditsDirty) {
                    // Clean client object
                    delete clientContext.client.creditsDirty;

                    // Write to database. If credit._version is not in database, will look correctly for "undefined"
                    var currentCreditVersion=clientContext.client.credit._version;
                    if(currentCreditVersion) clientContext.client.credit._version++; else clientContext.client.credit._version=1;
                    return Q.ninvoke(clientDB.collection("clients"), "updateOne",
                        {"_id": clientContext.client._id, "credit._version": currentCreditVersion},
                        {$set: {"credit": clientContext.client.credit}}, writeOptions).
                    then(function(updateResult){
                        // Commit to itSink
                        if(updateResult.modifiedCount==1){
                            if((clientContext.client.credit||{}).commitRequests) for(var k=0; k<clientContext.client.credit.commitRequests.length; k++){
                                if(logger.isDebugEnabled) logger.debug("Invoking commit for %s", clientContext.client.provision.legacyClientId);
                                request.post(clientContext.client.credit.commitRequests[k], function(error, response){
                                    // Commit response received
                                    if(!error){
                                        if(logger.isVerboseEnabled) logger.verbose("Purchase committed with result code %d", response.statusCode);
                                    } else {
                                        if(logger.isErrorEnabled) logger.error("Could not commit purchase for %d due to %s", clientContext.client._id, error.message);
                                    }
                                });
                            }
                        } else{
                            if(logger.isErrorEnabled) logger.error("Concurrent modification exception for %d", clientContext.client._id);
                            throw new Error("Concurrent modification exception");
                        }
                    });
                }
            });
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
     * @param eventDate
     *
     * CCEvent={
     *  clientId: <>,
     *  ccRequestType: <>,
     *  sessionId: <>,
     *  eventDate: <>,
     *  ccElements [
     *      {
     *      serviceId:<>,
     *      ratingGroup: <>,
     *      serviceName: <>,      --> Note this is the serviceName, not the full service
     *      used: {
     *          startDate: <>,
     *          bytesDown: <>,
     *          bytesUp: <>,
     *          seconds: <>
     *      },
     *      granted: {
     *          bytes: <>,
     *          seconds: <>,
     *          expirationDate: <>,
     *          fui: <>,
     *          fua: <>
     *     }
     */
    arm.pWriteCCEvent=pWriteCCEvent;

    /**
     * Writes a recharge event
     *
     * PurchaseEvent={
     *  clientId: <>,
     *  eventDate: <>,
     *  rechargeType: <>,
     *  rechargeName: <>,
     *  planName: <>,
     *  price: <>
     * }
     */
    arm.pWriteRechargeEvent=pWriteRechargeEvent;

    /**
     * Returns an array of events, each one spanning only one calendar item
     * @param ccElement
     * @param calendar
     * @param eventDate
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
     *      tag: <>
     * }
     */
    arm.breakCCElement=function(ccElement, calendar, eventDate){

        // Do nothing if no calendar specified
        if(!calendar) return [ccElement];

        var i;
        var fragmentSeconds;
        var remainingSeconds=ccElement.used.seconds;
        var nextTimeFrame;
        var nextDate=new Date(eventDate.getTime()-1000*ccElement.used.seconds); // Start date
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

    function buildClientContext(client){

        if(!client) return null;

        if(!client.credit) client.credit={creditPools:[]};

        return {client:client, plan:arm.planInfo(client.provision.planName)};
    }

    var pWriteCCEvent=function(clientContext, ccRequestType, ccElements, sessionId, eventDate){
        if(!eventDate) eventDate=new Date();

        // Cleanup all service data attached to the credit element
        ccElements.forEach(function (ccElement) {
            if (ccElement.service) {
                ccElement.serviceName = ccElement.service.name;
                delete ccElement.service;
            }
        });

        var event={
            clientId: clientContext.client._id,
            eventDate: eventDate,
            sessionId: sessionId,
            ccRequestType: ccRequestType,
            ccElements: ccElements
        };

        return Q.ninvoke(eventDB.collection("ccEvents"), "insertOne", event, writeOptions);
    };

    var pWriteRechargeEvent=function(client, recharge, eventDate) {
        if (!eventDate) eventDate = new Date();
        var event = {
            clientId: client._id,
            eventDate: eventDate,
            rechargeType: recharge.creationType,
            rechargeName: recharge.name,
            planName: client.provision.planName
        };

        return Q.ninvoke(eventDB.collection("rechargeEvents"), "insertOne", event, writeOptions);
    };

    /**
     *  Creates or updates the client recurring credits. Returns promise with array of results
     * @param clientContext
     * @param eventDate
     * @returns {*}
     */
    function pUpdateRecurringCreditsFromClientContext(clientContext, eventDate){

        if(!eventDate) eventDate=new Date();

        var creditPool;
        var rechargeNeeded;
        var rechargeNamesPushed=[];
        var pRecharges=[];

        if(clientContext.plan) (clientContext.plan.recharges||[]).forEach(function(recharge){
            if(recharge.creationType==3){
                rechargeNeeded=false;
                // Check if recharge needed: at least one of the resources of the pool is expired
                for(var i=0; i<recharge.resources.length; i++) {
                    creditPool=getPoolWithName(clientContext.client, recharge.resources[i].creditPool);

                    if(!creditPool || (creditPool.expirationDate && creditPool.expirationDate.getTime()<=eventDate.getTime())){
                        rechargeNeeded=true;
                        break;
                    }
                }

                // Add to recharges to be done if not already pushed
                if(rechargeNeeded && rechargeNamesPushed.indexOf(recharge.name)==-1){
                    pRecharges.push(pDoRecharge(clientContext.client, recharge, eventDate));
                    rechargeNamesPushed.push(recharge.name);
                }
            }
        });

        if(pRecharges.length==0) return Q([]); else return Q.allSettled(pRecharges);
    }

    /**
     * Returns promise to be solved when per-use credits are updated. Only one
     * per-use recharge per service is performed.
     *
     * The promise resolves to (pDoRecharge):
     * - true if recharge authorized and performed
     * - false if the recharge was not applicable or not authorized
     * - failure in case of authorization error

     * @param clientContext
     * @param service
     * @param rechargeNamesAlreadyUpdated
     * @param eventDate
     */
    function pUpdatePerUseCredit(clientContext, service, rechargeNamesAlreadyUpdated, eventDate){

        var recharges=clientContext.plan.recharges||[];

        if(!rechargeNamesAlreadyUpdated) rechargeNamesAlreadyUpdated=[];

        // Look for per-use recharge
        for(var i=0; i<recharges.length; i++){
            if(recharges[i].creationType==2){
                // Skip if oocQuarantineDate
                if(clientContext.client.credit && clientContext.client.credit.oocQuarantineDate && clientContext.client.credit.oocQuarantineDate.getTime()>eventDate.getTime()){
                    if(logger.isDebugEnabled) logger.debug("Skipping per-use recharge due to oocQuarantine for clientId %s", clientContext.client._id);
                    return Q(false);
                }

                // Check if recharge may replenish credit for the service
                for(var j=0; j<recharges[i].resources.length; j++){
                    if((service.creditPoolNames||[]).indexOf(recharges[i].resources[j].creditPool)!=-1){
                        // Execute recharge only if not already done
                        if(rechargeNamesAlreadyUpdated.indexOf(recharges[i].name)==-1){
                            rechargeNamesAlreadyUpdated.push(recharges[i].name);
                            return pDoRecharge(clientContext.client, recharges[i], eventDate);
                        }
                    }
                }
            }
        }

        return Q(false);
    }

    /* 
        Returns promise resolved after authorizing (if applicable) and updating the client credits.
        The promise resolves to:
            - true if recharge authorized and performed
            - false if the recharge was not applicable or not authorized
            - failure in case of authorization error

        May update the client.creditsDirty object
    */
    function pDoRecharge(client, recharge, eventDate){

        var authPromise;

        // Ensure sanity
        if(!eventDate) eventDate=new Date();
        if(!client.credit) client.credit={creditPools:[]};

        if(recharge.preAuthURL){
            // TODO: add price
            authPromise=Q.ninvoke(request, "post",
                {url: recharge.preAuthURL, timeout: configProperties.itSinkTimeoutMillis, json: {lcid: client.provision.legacyClientId} });
            if(logger.isDebugEnabled) logger.debug("Invoking authorization for %s", client.provision.legacyClientId);
        } else authPromise=Q(null);

        return authPromise.then(function(authResult){
            if(authResult) if(logger.isVerboseEnabled) logger.verbose("Purchase authorization with result code %d", response.statusCode);
            if(authResult==null || authResult[0].statusCode==200){
                addRechargeToCreditPool(client, recharge, eventDate);
                // Recharge event is written asynchronously
                pWriteRechargeEvent(client, recharge, eventDate).catch(function(/*error*/){
                    if(logger.isErrorEnabled) logger.error("Could not write recharge event ");
                }).done();
                // Set commit URL to be invoked later
                if(recharge.commitURL){
                    if(!client.credit.commitRequests) client.credit.commitRequests=[];
                    client.credit.commitRequests.push({url: recharge.commitURL, timeout: configProperties.itSinkTimeoutMillis, json: {lcid: client.provision.legacyClientId} });
                }
                return true;
            } else{
                // Authorization denied. Set quarantine
                if(!client.credit) client.credit={creditPools:[]};
                client.credit.oocQuarantineDate=new Date(eventDate.getTime()+1000*(configProperties.ooCQuarantineSeconds||300));
                return false;
            }
        }, function(error){
            // Authorization error. Set quarantine
            if(logger.isErrorEnabled) logger.error("Purchase authorization error %s", error.message);
            if(!client.credit) client.credit={creditPools:[]};
            client.credit.oocQuarantineDate=new Date(eventDate.getTime()+1000*(configProperties.ooCQuarantineSeconds||300));
            throw new Error("Could not perform recharge: "+error.message);
        });
    }

    /*
    * Updates the specified credit elements of a client with the also specified recharge,
    * adding seconds, bytes
    */
    function addRechargeToCreditPool(client, recharge, eventDate){

        // Just in case
        if(!client.credit) client.credit={creditPools: []};
        if(!client.credit.creditPools) client.credit.creditPools=[];

        if(!eventDate) eventDate=new Date();

        for(var r=0; r<recharge.resources.length; r++) {
            // Find the creditPool to recharge
            var poolIndex=-1;
            var resource;
            var creditPools=client.credit.creditPools;
            for(var i=0; i<creditPools.length; i++){
                if(creditPools[i].poolName==recharge.resources[r].creditPool){
                    poolIndex=i;
                    break;
                }
            }

            // If was expired, remove
            if(poolIndex!=-1 && creditPools[poolIndex].expirationDate && creditPools[poolIndex].expirationDate.getTime()<=eventDate.getTime()){
                creditPools.splice(poolIndex, 1);
                poolIndex=-1;
                client.creditsDirty=true;
            }

            resource=recharge.resources[r];

            // If no previous credit pool, create one
            if(poolIndex==-1){
                client.credit.creditPools.push({
                    poolName: resource.creditPool,
                    seconds: resource.seconds,
                    bytes: resource.bytes,
                    expirationDate: getNextExpirationDate(null, eventDate, resource.validity, client.provision.billingDay),
                    mayUnderflow: resource.mayUnderflow,
                    calendarTags: resource.calendarTags
                });
                client.creditsDirty=true;
            }else {
                // Add to old non expired recharge
                var creditPool=creditPools[poolIndex];

                // Check if the recurring recharge is not expired
                if(recharge.creationType==3 && creditPool.expirationDate && creditPool.expirationDate.getTime()>eventDate.getTime()){
                    // No need to recharge
                } else {
                    if ((creditPool.bytes||creditPool.bytes===0) && resource.bytes) creditPool.bytes += recharge.resources[r].bytes;
                    // If recharge specifies now no control for bytes, set it!
                    if (!recharge.resources[r].bytes) delete creditPool.bytes;

                    if ((creditPool.seconds||creditPool.seconds===0) && resource.seconds) creditPool.seconds += resource.seconds;
                    // If recharge specifies now no control for seconds, set it!
                    if (!resource.seconds) delete creditPool.seconds;

                    creditPool.expirationDate = getNextExpirationDate(creditPool.expirationDate, eventDate, resource.validity, client.provision.billingDay);
                    creditPool.mayUnderflow = resource.mayUnderflow;
                    creditPool.calendarTags = resource.calendarTags;
                    client.creditsDirty=true;
                }
            }
        }
    }

    function cleanupCreditsFromClientContext(clientContext, eventDate){

        if(!eventDate) eventDate=new Date();
        var currentTime=eventDate.getTime();

        // Loop backwards, because we are modifying the array while iterating through it, and array
        // is re-indexed when removing an element
        var creditPools=(clientContext.client.credit||{}).creditPools;
        if(creditPools) for(var i=0; i<creditPools.length; i++){
            if(creditPools[i].expirationDate && creditPools[i].expirationDate.getTime()<=currentTime){
                creditPools.splice(i--, 1);
                clientContext.client.creditsDirty=true;
            }
        }
    }

    /**
     * Returns the expiration date given the current date and a validity in (M)onths, (D)ays or (H)ours
     * @param currentExpirationDate
     * @param eventDate
     * @param validity
     * @param billingDay
     * @returns {*}

     * h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months, C: until the end of the billing cycle
     */
    function getNextExpirationDate(currentExpirationDate, eventDate, validity, billingDay){
        var elements=/(\+*)([0-9]+)([CMDHmdh])/.exec(validity);
        if(elements.length!=4) throw new Error("Bad validity specification "+validity);

        var isIncremental=(elements[1]==='+');
        var numberOfUnits=parseInt(elements[2]||'1');
        var unitType=elements[3];

        // Copy object. Otherwise object passed would be modified
        var expDate=new Date(eventDate.getTime());

        // If specification says the current expiration date should be incremented
        if(isIncremental && (currentExpirationDate.getTime()>eventDate.getTime())) expDate=currentExpirationDate;

        if(unitType=="C"){
            if(eventDate.getDate()>=billingDay) expDate.setMonth(expDate.getMonth()+numberOfUnits);
            expDate.setDate(billingDay);
            expDate.setHours(0, 0, 0, 0);
        }
        if(unitType=="M"){
            expDate.setMonth(expDate.getMonth()+numberOfUnits, 1);
            expDate.setHours(0, 0, 0, 0);
        }
        else if(unitType=="D"){
            expDate.setDate(expDate.getDate()+numberOfUnits);
            expDate.setHours(0, 0, 0, 0);
        }
        else if(unitType=="H"){
            expDate.setHours(expDate.getHours()+numberOfUnits, 0, 0, 0);
        }
        else if(unitType=="m"){
            expDate.setMonth(expDate.getMonth()+numberOfUnits);
        }
        else if(unitType=="d"){
            expDate.setDate(eventDate.getDate()+numberOfUnits);
        }
        else if(unitType=="h"){
            expDate.setHours(expDate.getHours()+numberOfUnits);
        }
        return expDate;
    }

    /**
     * Gets the service corresponding to the specified serviceId and rating group for the given clientContext
     * The service matched must have the same ratingGroup and (same serviceId or serviceId=0)
     * @param clientContext
     * @param serviceId
     * @param ratingGroup
     * @return {*} service object
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

        if(service) return service; else throw new Error("No service found for serviceId "+serviceId+" and rating group "+ratingGroup);
    }

    /**
     * Returns an array of ordered credit pools for the target service, as pointers to the clientContext
     * @param clientContext
     * @param service
     * @param tag
     * @return {*} array of credit pools
     */
    function getTargetCreditPools(clientContext, service, tag){

        var targetCreditPools=[];

        var clientCreditPools=(((clientContext.client.credit)||{}).creditPools)||[];
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

    function getPoolWithName(client, poolName){

        if(!client.credit) return null;
        if(!client.credit.creditPools) return null;

        for(var i=0; i<client.credit.creditPools.length; i++){
            if(client.credit.creditPools[i].poolName==poolName) return client.credit.creditPools[i];
        }
        return null;
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

var eventDate=new Date();
var event={
    serviceId: 0,
    ratingGroup: 0,
    service: "none",
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

//var brokenEvents=arm.breakCCElement(event, speedyNightCalendar, eventDate);
//console.log(JSON.stringify(brokenEvents, null, 2));

function unitTest() {

    arm.setConfigProperties({
        maxBytesCredit: null,
        maxSecondsCredit: null,
        minBytesCredit: 0,
        minSecondsCredit: 0,
        expirationRandomSeconds: null});

    arm.pSetupDatabaseConnections().then(function(){
        return arm.pReloadPlansAndCalendars();
    }).then(function () {
        test();
    }).fail(function(err){
        console.log("Initialization error due to " + err);
    });

    function test() {
        console.log("testing...");

        var theClientContext;
        var ccElements=[{serviceId: 0, ratingGroup: 1, used: {bytesDown: 0, bytesUp: 0, seconds: 0}}];

        arm.pGetGuidedClientContext({
            nasPort: 1003,
            nasIPAddress: "127.0.0.1"
        }).then(function (clientContext) {
            theClientContext=clientContext;
            console.log(JSON.stringify(clientContext, null, 2));
            //return arm.pBuyRecharge(clientContext, "Daily", null);
            return arm.pExecuteCCRequest(clientContext, arm.UPDATE_REQUEST, ccElements, "1-1", null);
        }).then(function(rechargeDone){
            // console.log("Recharge done: "+rechargeDone);
            console.log(JSON.stringify(ccElements, null, 2));
        }, function(error){
            console.log("Error in unit test: "+error.message);
            console.log(error.stack);
        }).done();
    }
}