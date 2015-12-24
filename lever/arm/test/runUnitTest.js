// Unit testing for arm

var Q=require("q");
var arm=require("../arm").arm;

var testSpec="./testSpec.js";

var testItems=require(testSpec).testItems;
var maxBytesCredit=require(testSpec).maxBytesCredit;
var maxSecondsCredit=require(testSpec).maxSecondsCredit;

unitTest();

function unitTest(){

    arm.setConfigProperties({
        maxBytesCredit: maxBytesCredit,
        maxSecondsCredit: maxSecondsCredit,
        minBytesCredit: 0,
        minSecondsCredit: 0,
        expirationRandomSeconds: null});

    arm.pSetupDatabaseConnections().then(function () {
        return arm.pReloadPlansAndCalendars();
    }).then(function(){
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
            arm.pGetGuidedClientContext(testItem.clientPoU).then(function(clientContext){
                if(!clientContext) throw new Error("Client not found");
                if(!clientContext["plan"]) throw new Error("Plan not found");
                var requestType;
                if(testItem.subtype=="INITIAL") requestType=arm.INITIAL_REQUEST;
                if(testItem.subtype=="UPDATE") requestType=arm.UPDATE_REQUEST;
                if(testItem.subtype=="TERMINATE") requestType=arm.TERMINATE_REQUEST;

                if(testItem["_check_creditPoolsBefore"]) checkCreditPools(clientContext, testItem["_check_creditPoolsBefore"]);

                arm.pExecuteCCRequest(clientContext, requestType, testItem.ccElements, testItem.sessionId, testItem.date).then(function(){
                    if(testItem.subtype!="TERMINATE") checkGrantedResult(testItem.ccElements);
                    if(testItem._check_creditPoolsAfter) checkCreditPools(clientContext, testItem._check_creditPoolsAfter);

                    // Next test
                    setTimeout(nextTestItem, 0);
                }).done();

            }).done();
        } else if(testItem.type=="BuyRecharge"){
            arm.pGetGuidedClientContext(testItem.clientPoU).then(function(clientContext){
                if(!clientContext) throw new Error("Client not found");
                if(!clientContext["plan"]) throw new Error("Plan not found");
                arm.pBuyRecharge(clientContext, testItem.rechargeName, testItem.date).then(function(/*isDone*/){
                    if(testItem._check_creditPoolsAfter) checkCreditPools(clientContext, testItem._check_creditPoolsAfter);
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
            if(!clientContext.client.credit || !clientContext.client.credit.creditPools){
                console.log("\t[Test][ERROR] "+spec.description+" Client has no pools");
                return;
            }

            clientContext.client.credit.creditPools.forEach(function(clientPoolItem){
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
            var spec=decoratedCCElement._check_resultGranted;
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

