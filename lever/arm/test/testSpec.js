// Specification of tests to run

var maxBytesCredit;         // undefined
var maxSecondsCredit;

var client1RecurringExpDate=new Date("2015-06-30T22:00:00Z");
var client1PurchasedExpDate=new Date("2015-06-28T22:00:00Z");
var client1SessionDate=new Date("2015-06-15T15:00:00Z");
var client1Phone="999999991";

var client2Line={nasPort: 1002, nasIPAddress: "127.0.0.1"};
var client2Session1Date=new Date("2015-12-15T13:00:00Z");
var client2Session1ExpDate=new Date("2015-12-15T19:00:00Z");
var client2Session2Date=new Date("2015-12-15T17:00:00Z");
var client2Session2ExpDate=new Date("2015-12-15T19:00:00Z");
var client2Session3Date=new Date("2015-12-19T21:00:00Z");
var client2Session3ExpDate=new Date("2015-12-21T06:00:00Z");
var client2SpeedyNightCreditExpDate=new Date("2015-12-31T23:00:00Z");
var client2DefaultExpDate=new Date("2015-12-31T23:00:00Z");

var client3Login={userName: "test-ixd@test"};
var client3Session1Date=new Date("2016-07-20T08:00:00Z");
var client3Session1ExpDate=new Date("2016-07-20T22:00:00Z");
var client3Session2Date=new Date("2016-07-20T12:00:00Z");
var client3PerUse1PurchaseExpirationDate=new Date("2016-07-20T22:00:00Z"); // Next day GMT+2
var client3PurchaseDate=new Date("2016-07-20T16:00:00Z");
var client3PurchaseExpirationDate=new Date("2016-07-20T22:00:00Z"); // Next day GMT+2


var testItems=[
    /*
    // FUP
    // Client initially has 5GB in recurring credit and 1GB in purchased credit
    // All credit is consumed. In the first UPDATE, 5,5GB (in two ccElements) and thus 0,5GB is granted
    {
        execute: true,
        type: "CCR",
        subtype: "INITIAL",
        sessionId: "session-client1-1",
        description: "Initial CCR for client 1. FUP service",
        clientPoU: {phone: client1Phone},
        date: client1SessionDate,
        _check_creditPoolsBefore:[
            {poolName: "bytesRecurring", bytes: 5*1024*1024*1024, expirationDate: client1RecurringExpDate, description: "bytesRecurring pool."},
            {poolName: "bytesPurchased", bytes: 1024*1024*1024, expirationDate: client1PurchasedExpDate, description: "bytesPurchased pool."}
        ],
        ccElements:[
            // Returned all 6GB credit
            {ratingGroup: 1, serviceId: 1, _check_resultGranted:{ bytes: 6*1024*1024*1024, expirationDate: client1PurchasedExpDate, fui: false, fua: 0, description: "Granted from 5GB recurring plus 1GB purchased."}}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "UPDATE",
        sessionId: "session-client1-1",
        description: "Update CCR for client 1. FUP service",
        clientPoU: {phone: client1Phone},
        date: new Date(client1SessionDate.getTime()+1000*3600),
        ccElements:[
            // Credit granted is the same for both ccElements, since they are taken from the same service
            // Note that first credit is discounted for all ccElements, and then credit is calculated
            {ratingGroup: 1, serviceId: 1, used: {bytesDown: 4*1024*1024*1024+512*1024*1024, seconds: 3600}, _check_resultGranted:{bytes: 512*1024*1024, expirationDate: client1PurchasedExpDate, fui: false, fua: 0, description: "Consumed 4GB recurring - Granted 0.5GB purchased."}},
            {ratingGroup: 1, serviceId: 1, used: {bytesDown: 1024*1024*1024, seconds: 3600}, _check_resultGranted:{bytes: 512*1024*1024, expirationDate: client1PurchasedExpDate, fui: false, fua: 0, description: "Consumed 1GB recurring plus 0.5GB purchased - Granted 0.5GB purchased."}}

        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "TERMINATE",
        sessionId: "session-client1-1",
        description: "Final CCR for client 1. FUP service. Overflow",
        clientPoU: {phone: client1Phone},
        date: new Date(client1SessionDate.getTime()+2000*3600),
        ccElements:[
            {ratingGroup: 1, serviceId: 1, used: {bytesDown: 600*1024*1024, seconds: 3600}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "bytesRecurring", bytes: 0, expirationDate: client1RecurringExpDate, description: "bytesRecurring pool now 0."},
            {poolName: "bytesPurchased", bytes: 0, expirationDate: client1PurchasedExpDate, description: "bytesPurchased pool now 0."}
        ]
    },

    // SpeedyNight
    // Client initially has no credit. Two recurring credit pools are created on first usage
    // First session: Tuesday 14:00 to 15:00, 1 Hour discounted from default pool. 6 H credit (until 8:00 pm)
    // Second session: Tuesday 18:00 to 23:00. 2 Hours discounted from default pool, 3 hours discounted from speedyNight pool
    // Third session: Saturday 10:00 to Monday 10:00. 17 discounted from speedyNight pool, 31 hours discounted from default pool
    // Since default pool may underflow, seconds is set to -34 hours

    // First session
    {
        execute: true,
        type: "CCR",
        subtype: "INITIAL",
        sessionId: "session-client2-1",
        description: "Initial CCR for session 1 client 2. SpeedyNight service",
        clientPoU: client2Line,
        date: new Date(client2Session1Date.getTime()),
        ccElements:[
            // bytes and seconds are null due to mayUnderflow
            {ratingGroup: 2, serviceId: 1, _check_resultGranted:{ bytes: null, seconds: null, expirationDate: client2Session1ExpDate, fui: false, fua: 0, description: "Granted until speedy-night timeFrame."}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "speedyNightPool", seconds: 20*3600, expirationDate: client2SpeedyNightCreditExpDate, description: "SpeedyNight pool."},
            {poolName: "defaultPool", seconds: 0, expirationDate: client2DefaultExpDate, description: "Default pool."}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "TERMINATE",
        sessionId: "session-client2-1",
        description: "Termination CCR for session 1 client 2. SpeedyNight service",
        clientPoU: client2Line,
        date: new Date(client2Session1Date.getTime()+1000*3600),
        ccElements:[
            // bytes and seconds are null due to mayUnderflow
            {ratingGroup: 2, serviceId: 1, used: {bytesDown: 1234567, seconds: 3600}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "speedyNightPool", seconds: 20*3600, expirationDate: client2SpeedyNightCreditExpDate, description: "SpeedyNight pool."},
            {poolName: "defaultPool", seconds: -3600, expirationDate: client2DefaultExpDate, description: "Default pool."}
        ]
    },

    // Second session
    {
        execute: true,
        type: "CCR",
        subtype: "INITIAL",
        sessionId: "session-client2-2",
        description: "Initial CCR for session 2 client 2. SpeedyNight service",
        clientPoU: client2Line,
        date: new Date(client2Session2Date.getTime()),
        ccElements:[
            // bytes and seconds are null due to mayUnderflow
            {ratingGroup: 2, serviceId: 1, _check_resultGranted:{ bytes: null, seconds: null, expirationDate: client2Session2ExpDate, fui: false, fua: 0, description: "Granted until speedy-night timeFrame."}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "speedyNightPool", seconds: 20*3600, expirationDate: client2SpeedyNightCreditExpDate, description: "SpeedyNight pool."},
            {poolName: "defaultPool", seconds: -3600, expirationDate: client2DefaultExpDate, description: "Default pool."}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "TERMINATE",
        sessionId: "session-client2-2",
        description: "Termination CCR for session 2 client 2. SpeedyNight service",
        clientPoU: client2Line,
        date: new Date(client2Session2Date.getTime()+5*1000*3600),
        ccElements:[
            // bytes and seconds are null due to mayUnderflow. Expiration date in INITIAL is not honored!
            {ratingGroup: 2, serviceId: 1, used: {bytesDown: 1234567, seconds: 5*3600}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "speedyNightPool", seconds: 17*3600, expirationDate: client2SpeedyNightCreditExpDate, description: "SpeedyNight pool."},
            {poolName: "defaultPool", seconds: -3600*3, expirationDate: client2DefaultExpDate, description: "Default pool."}
        ]
    },

    // Third session
    {
        execute: true,
        type: "CCR",
        subtype: "INITIAL",
        sessionId: "session-client2-3",
        description: "Initial CCR for session 3 client 2. SpeedyNight service",
        clientPoU: client2Line,
        date: new Date(client2Session3Date.getTime()),
        ccElements:[
            // bytes and seconds are null due to mayUnderflow
            {ratingGroup: 2, serviceId: 1, _check_resultGranted:{ bytes: null, seconds: null, expirationDate: client2Session3ExpDate, fui: false, fua: 0, description: "Granted until speedy-night timeFrame."}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "speedyNightPool", seconds: 17*3600, expirationDate: client2SpeedyNightCreditExpDate, description: "SpeedyNight pool."},
            {poolName: "defaultPool", seconds: -3600*3, expirationDate: client2DefaultExpDate, description: "Default pool."}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "TERMINATE",
        sessionId: "session-client2-3",
        description: "Termination CCR for session 3 client 2. SpeedyNight service",
        clientPoU: client2Line,
        date: new Date(client2Session3Date.getTime()+48*1000*3600),
        ccElements:[
            // bytes and seconds are null due to mayUnderflow. Expiration date in INITIAL is not honored!
            {ratingGroup: 2, serviceId: 1, used: {bytesDown: 1234567, seconds: 48*3600}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "speedyNightPool", seconds: 0, expirationDate: client2SpeedyNightCreditExpDate, description: "SpeedyNight pool."},
            {poolName: "defaultPool", seconds: -3600*(3+31), expirationDate: client2DefaultExpDate, description: "Default pool."}
        ]
    },
    */

    // IxD
    // Client initially has no credit
    // First session of duration 1h and 5MB. Remanent credit is
    //      - Pool lowSpeed: until the end of the day
    //      - Pool highSpeed: until the end of the day, 5MB
    // Second session with interim for the remanent 5MB and end of session with additional 2MB
    //      An implicit purchase is done at the first interim

    // First session
    {
        execute: true,
        type: "CCR",
        subtype: "INITIAL",
        sessionId: "session-client3-1",
        description: "Initial CCR for session 1 client 3. IxD plan",
        clientPoU: client3Login,
        date: new Date(client3Session1Date.getTime()),
        ccElements:[
            {ratingGroup: 0, serviceId: 0, _check_resultGranted:{ bytes: null, seconds: null, expirationDate: client3Session1ExpDate, fui: false, fua: 0, description: "Rating group 0. Granted until end of the day"}},
            {ratingGroup: 1, serviceId: 0, _check_resultGranted:{ bytes: 10000000, seconds: null, expirationDate: client3Session1ExpDate, fui: false, fua: 0, description: "Rating group 1. Granted 10MB until end of the day"}}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "TERMINATE",
        sessionId: "session-client3-1",
        description: "Termination CCR for session 1 client 3. IxD plan",
        clientPoU: client3Login,
        date: new Date(client2Session3Date.getTime()+1*1000*3600),
        ccElements:[
            {ratingGroup: 0, serviceId: 0, used:{bytesDown: 0, seconds: 3600}},
            {ratingGroup: 1, serviceId: 0, used:{bytesDown: 5000000, seconds: 3600}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "lowSpeed", expirationDate: client3Session1ExpDate, description: "lowSpeed pool."},
            {poolName: "highSpeed", bytes: 5000000, expirationDate: client3Session1ExpDate, description: "highSpeed pool."}
        ]
    },

    // Second session
    {
        execute: true,
        type: "CCR",
        subtype: "INITIAL",
        sessionId: "session-client3-2",
        description: "Initial CCR for session 2 client 3. IxD plan",
        clientPoU: client3Login,
        date: new Date(client3Session2Date.getTime()),
        ccElements:[
            {ratingGroup: 0, serviceId: 0, _check_resultGranted:{ bytes: null, seconds: null, expirationDate: client3Session1ExpDate, fui: false, fua: 0, description: "Rating group 0. Granted until end of the day"}},
            {ratingGroup: 1, serviceId: 0, _check_resultGranted:{ bytes: 5000000, seconds: null, expirationDate: client3Session1ExpDate, fui: false, fua: 0, description: "Rating group 1. Granted remaining 5MB until end of the day"}}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "UPDATE",
        sessionId: "session-client3-2",
        description: "Update CCR for session 2 client 3. IxD plan",
        clientPoU: client3Login,
        date: new Date(client3Session2Date.getTime()+1*1000*3600),
        ccElements:[
            {ratingGroup: 0, serviceId: 0, used:{bytesDown: 0, seconds: 3600}, _check_resultGranted:{ bytes: null, seconds: null, expirationDate: client3Session1ExpDate, fui: false, fua: 0, description: "Rating group 0. Granted until end of the day"}},
            {ratingGroup: 1, serviceId: 0, used:{bytesDown: 5000010, seconds: 3600}, _check_resultGranted:{ bytes: 10000000, seconds: null, expirationDate: client3Session1ExpDate, fui: false, fua: 0, description: "Rating group 1. Purchase of 10MB done"}}
        ]
    },
    {
        execute: true,
        type: "CCR",
        subtype: "TERMINATE",
        sessionId: "session-client3-1",
        description: "Termination CCR for session 2 client 3. IxD plan",
        clientPoU: client3Login,
        date: new Date(client3Session2Date.getTime()+2*1000*3600),
        ccElements:[
            {ratingGroup: 0, serviceId: 0, used:{bytesDown: 0, seconds: 3600}},
            {ratingGroup: 1, serviceId: 0, used:{bytesDown: 2000000, seconds: 3600}}
        ],
        _check_creditPoolsAfter:[
            {poolName: "lowSpeed", expirationDate: client3Session1ExpDate, description: "lowSpeed pool. Until the end of the day"},
            {poolName: "highSpeed", bytes: 8000000, expirationDate: client3Session1ExpDate, description: "highSpeed pool. Remaining 8MB."}
        ]
    }

    /*
    {
        execute: true,
        type: "BuyRecharge",
        description: "Buy recharge",
        clientPoU: client3Login,
        rechargeName: "Turbo",
        date: new Date(client3PurchaseDate.getTime()),
        _check_creditPoolsAfter:[
            {poolName: "highSpeed", bytes: 10000000, expirationDate: client3PurchaseExpirationDate, description: "highSpeed pool update."}
        ]
    }
    */
];

exports.testItems=testItems;
exports.maxBytesCredit=maxBytesCredit; 
exports.maxSecondsCredit=maxSecondsCredit;
