// Unit testing for arm

var Q=require("q");
var arm=require("../arm").arm;

var maxBytesCredit=7*1024*1024*1024;

var client4RecurringExpDate=new Date("2015-07-01T01:00:00Z");
var client4PurchasedExpDate=new Date("2015-06-28T01:00:00Z");
var client4SessionDate=new Date("2015-06-15T15:00:00Z");

var testItems=[
    // FUP
    // Client initially has 5GB in recurring credit and 1GB in purchase credit
    // All credit is consumed. In the first UPDATE, 5,5GB (in two ccElements) and thus 0,5GB is granted
    {
        execute: true,
        type: "CCR",
        subtype: "INITIAL",
        sessionId: "session-client4-1",
        description: "Initial CCR for client 4. FUP service",
        clientPoU: {phone: "999999994"},
        date: client4SessionDate,
        creditPoolsBefore:[
            {poolName: "bytesRecurring", bytes: 5*1024*1024*1024, expirationDate: client4RecurringExpDate, description: "bytesRecurring pool."},
            {poolName: "bytesPurchased", bytes: 1024*1024*1024, expirationDate: client4PurchasedExpDate, description: "bytesPurchased pool."}
        ],
        ccElements:[
            {ratingGroup: 1, serviceId: 1, resultGranted:{ bytes: 6*1024*1024*1024, expirationDate: client4PurchasedExpDate, fui: true, fua: 0, description: "Granted from 5GB recurring plus 1GB purchased."}}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "UPDATE",
        sessionId: "session-client4-1",
        description: "Update CCR for client 4. FUP service",
        clientPoU: {phone: "999999994"},
        date: new Date(client4SessionDate.getTime()+1000*3600),
        ccElements:[
            // Credit granted is the same for both ccElements, since they are taken from the same service
            // Note that first credit is discounted for all ccElements, and then credit is calculated
            {ratingGroup: 1, serviceId: 1, used: {bytesDown: 4*1024*1024*1024+512*1024*1024, seconds: 3600}, resultGranted:{bytes: 512*1024*1024, expirationDate: client4PurchasedExpDate, fui: true, fua: 0, description: "Consumed 4GB recurring - Granted 0.5GB purchased."}},
            {ratingGroup: 1, serviceId: 1, used: {bytesDown: 1024*1024*1024, seconds: 3600}, resultGranted:{bytes: 512*1024*1024, expirationDate: client4PurchasedExpDate, fui: true, fua: 0, description: "Consumed 1GB recurring plus 0.5GB purchased - Granted 0.5GB purchased."}}

        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "TERMINATE",
        sessionId: "session-client4-1",
        description: "Final CCR for client 4. FUP service. Overflow",
        clientPoU: {phone: "999999994"},
        date: new Date(client4SessionDate.getTime()+2000*3600),
        ccElements:[
            {ratingGroup: 1, serviceId: 1, used: {bytesDown: 600*1024*1024, seconds: 3600}}
        ],
        creditPoolsAfter:[
            {poolName: "bytesRecurring", bytes: 0, expirationDate: client4RecurringExpDate, description: "bytesRecurring pool now 0."},
            {poolName: "bytesPurchased", bytes: 0, expirationDate: client4PurchasedExpDate, description: "bytesPurchased pool now 0."}
        ]
    }

    // SpeedyNight
    // Client initially has no credit. Two recurring credit pools are created on first usage
    // First session: Tuesday 14:00 to 15:00, 1 Hour discounted from default pool
    // Second session: Tuesday 18:00 to 23:00. 2 Hours discounted from default pool, 3 hours discounted from speedyNight pool
    // Third session: Saturday 10:00 to Monday 10:00. 17 discounted from speedyNight pool, 31 hours discounted from default pool
    // Since default pool may underflow, seconds is set to -34 hours
];

unitTest();


// Initialize
function unitTest(){

    arm.setConfigProperties({
        maxBytesCredit: maxBytesCredit,
        maxSecondsCredit: null,
        minBytesCredit: 0,
        minSecondsCredit: 0,
        expirationRandomSeconds: null});

    arm.setupDatabaseConnections().then(function () {
        console.log("[TEST] arm initialized");
        nextTestItem();
    }, function (err) {
        console.log("Initialization error due to " + err);
    }).done();


    var n=0;
    function nextTestItem() {
        // Check if we have already finished
        if (n >= testItems.length) {
            console.log("[TEST] All tests finished");
            process.exit();
            return;
        }

        var testItem = testItems[n];
        n++;

        // Skip testItem if so specified
        if (!testItem.execute) {
            setTimeout(nextTestItem, 0);
            return;
        }

        console.log("");
        console.log("[Test] " + testItem.description);

        if (testItem.type=="CCR") {
            arm.getClientContext(testItem.clientPoU).then(function(clientContext){
                var requestType;
                if(testItem.subtype=="INITIAL") requestType=arm.INITIAL_REQUEST;
                if(testItem.subtype=="UPDATE") requestType=arm.UPDATE_REQUEST;
                if(testItem.subtype=="TERMINATE") requestType=arm.TERMINATE_REQUEST;

                if(testItem.creditPoolsBefore) checkCreditPools(clientContext, testItem.creditPoolsBefore);

                arm.executeCCRequest(clientContext, requestType, testItem.ccElements, testItem.sessionId, testItem.date).then(function(){
                    if(testItem.subtype!="TERMINATE") checkGrantedResult(testItem.ccElements);
                    if(testItem.creditPoolsAfter) checkCreditPools(clientContext, testItem.creditPoolsAfter);

                    // Next test
                    setTimeout(nextTestItem, 0);
                }).done();

            }).done();
        }
    }

    function checkCreditPools(clientContext, testCreditPools){
        var clientCreditPool;
        // Check each one of the credit pools specified
        testCreditPools.forEach(function(spec){
            clientCreditPool=null;
            clientContext.client.creditPools.forEach(function(clientPoolItem){
                if(clientPoolItem.poolName==spec.poolName) clientCreditPool=clientPoolItem;
            });

            if(clientCreditPool==null){
                console.log("\t[Test][ERROR] "+spec.description+" Pool not found");
            }
            else{
                if((clientCreditPool.bytes==spec.bytes)||(typeof(clientCreditPool.bytes)=='undefined' && typeof(spec.bytes)=='undefined')) console.log("\t[Test][OK] "+spec.description+" Bytes credit"); else console.log("\t[Test][ERROR] "+spec.description+" Bytes credit. value: "+spec.bytes+" found: "+clientCreditPool.bytes);
                if((clientCreditPool.seconds==spec.seconds)||(typeof(clientCreditPool.seconds)=='undefined' && typeof(spec.seconds)=='undefined')) console.log("\t[Test][OK] "+spec.description+" Seconds credit"); else console.log("\t[Test][ERROR] "+spec.description+" Seconds credit. value: "+spec.seconds+" found: "+clientCreditPool.seconds);
                if(pGetTime(clientCreditPool.expirationDate)==pGetTime(spec.expirationDate)) console.log("\t[Test][OK] "+spec.description+" Expiration Date"); else console.log("\t[Test][ERROR] "+spec.description+" ExpirationDate. value: "+(spec.expirationDate?spec.expirationDate.toISOString():"undefined")+" found: "+(clientCreditPool.expirationDate?clientCreditPool.expirationDate.toISOString():"undefined"));
            }
        });
    }

    // ccElements injected into executeCCRequest include the a "grantedResult" as part of the testUnit data to compare the granted units
    function checkGrantedResult(decoratedCCElements){
        decoratedCCElements.forEach(function(decoratedCCElement){
            var granted=decoratedCCElement.granted;
            var spec=decoratedCCElement.resultGranted;
            if((granted.bytes==spec.bytes)||(typeof(granted.bytes)=='undefined' && typeof(spec.bytes)=='undefined')) console.log("\t[Test][OK] "+spec.description+" Bytes credit"); else console.log("\t[Test][ERROR] "+spec.description+" Bytes credit. value: "+spec.bytes+" found: "+granted.bytes);
            if((granted.seconds==spec.seconds)||(typeof(granted.seconds)=='undefined' && typeof(spec.seconds)=='undefined')) console.log("\t[Test][OK] "+spec.description+" Seconds credit"); else console.log("\t[Test][ERROR] "+spec.description+" Seconds credit. value: "+spec.seconds+" found: "+granted.seconds);
            if(pGetTime(granted.expirationDate)==pGetTime(spec.expirationDate)) console.log("\t[Test][OK] "+spec.description+" Expiration Date"); else console.log("\t[Test][ERROR] "+spec.description+" ExpirationDate. value: "+(spec.expirationDate?spec.expirationDate.toISOString():"undefined")+" found: "+(granted.expirationDate?granted.expirationDate.toISOString():"undefined"));
            if((granted.fui==spec.fui)||(typeof(granted.fui)=='undefined' && typeof(spec.fui)=='undefined')) console.log("\t[Test][OK] "+spec.description+" FUI"); else console.log("\t[Test][ERROR] "+spec.description+" FUI. value: "+spec.fui+" found: "+granted.fui);

        });
    }
}

// To compare dates that may be null or undefined
function pGetTime(d){
    return d? d.getTime():0;
}

// TODO: Bypass credits with specific tag when discounting. Use nextTimeframe as expiration date of credit with tag
// TODO: Tests for speedynight
// TODO: Include purchasing methods in arm. Include purchases in testing
