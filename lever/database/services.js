load("urlConfig.js");

print("");
print("----------------------------------");
print("Creating Calendar");
print("----------------------------------");

var db=connect(leverConfigDatabase.substring(10));
db.calendars.drop();

// Array items must be in the appropriate order
var noCalendar=
{
    name: "emptyCalendar",
    calendarItems:
    [
        {
            type: 3,
            startTime: "00:00",
            endTime: "00:00",
            tag: "default"
        }
    ]
};

// Sunday : 0
var speedyNightCalendar=
{
	name: "speedyNight",
	calendarItems:
	[
	 	{
	 		type: 1,
	 		startDate: "2014-01-01",
	 		endDate: "2014-01-02",
	 		tag: "offPeak"
	 	},
	 	{
	 		type: 2,
	 		startWeekDay: 5,
	 		startTime: "20:00",
	 		endWeekDay: 1,
	 		endTime: "07:00",
	 		tag: "offPeak"
	 	},
	 	{
	 		type: 3,
	 		startTime: "20:00",
	 		endTime: "07:00",
	 		tag: "offPeak"
	 		
	 	},
	 	{
	 		type: 3,
	 		startTime: "07:00",
	 		endTime: "20:00",
            tag: "default"
	 	}
	]	
};

db.calendars.insert(speedyNightCalendar);

print("done");
print("");

print("----------------------------------");
print("Creating Service Configuration");
print("----------------------------------");

db.plans.drop();

var plan1001=
{
    name: "1001",
    description: "Fair Usage Policy 6GB/Month. Daily purchasable recharges",
    services:
    [
        {
            name: "FUPHigh",
            description: "FUP with quota",
            serviceId: 0,
            ratingGroup: 1,
            subscribable: false,
            autoActivated: true,
            roamingAreas: null,
            preAuthorized: true,
            creditPoolNames: ["bytesRecurring", "bytesPurchased"],
            sortCreditsByExpirationDate: false,      // If false, credits will be used in the order declared in "creditPoolNames"
            oocAction: 0,                            // 0: Terminate. 1: Redirect. 2: Restrict_access, 3: None
            recharges:
            [
                {
                    name: "Monthly automatic recharge",
                    creationType: 3,		// 1: initial, 2: per_use, 3: recurring, 4: portal, 5: external
                    resources:
                    [
                        {
                            bytes: 6*1024*1024*1024,
                            validity: "1M", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months, C: until next billing cycle, C: until the end of the billing cycle
                            mayUnderflow: false,
                            creditPool: "bytesRecurring"
                        }
                    ]
                },
                {
                    name: "Recharge one day",
                    creationType: 4,		// Portal
                    price:
                        [
                            {startDate: ISODate("2013-01-01T03:00:00Z"), endDate: ISODate("2015-07-07T03:00:00Z"), value: 17.99},
                            {startDate: ISODate("2015-07-07T03:00:00Z"), value: 19.99}
                        ],
                    resources:
                    [
                        {
                            bytes: 1024*1024*1024,
                            validity: "1D",
                            mayUnderflow: false,
                            creditPool: "bytesPurchased"
                        }
                    ]
                }
            ]
        },
        {
            name: "FUPLow",
            description: "Low speed service",
            serviceId: 0,
            ratingGroup: 0,
            subscribable: false,
            autoActivated: true,
            roamingAreas: null,
            preAuthorized: false
        }
    ]
};

var plan1002=
{
    name: "1002",
    description: "20 hours free on nights and weekends. Otherwise pay per time of usage",
    services:
        [
            {
                name: "speedyNight",
                description: "Speedy Night and Weekend",
                serviceId: 1,
                ratingGroup: 2,
                subscribable: false,
                autoActivated: true,
                roamingAreas: null,
                preAuthorized: true,
                calendarName: "speedyNight",
                creditPoolNames: ["speedyNightPool", "defaultPool"],
                oocAction: 3,                           // 0: Terminate. 1: Redirect. 2: Restrict_access. 3: Nothing
                sortCreditsByExpirationDate: false,     // If false, credits will be used in the order declared in "creditPoolNames"
                recharges:
                [
                    {
                        name: "SpeedyNight 20H Recurring",
                        creationType: 3,		// Recurring
                        resources:
                        [
                            {
                                seconds: 20*3600,
                                validity: "1C", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months, C: until next billing cycle
                                mayUnderflow: false,	// Postpaid
                                creditPool: "speedyNightPool",
                                calendarTags: ["offPeak"]
                            }
                        ]
                    },
                    {
                        name: "Default traffic",
                        creationType: 3,		// Recurring
                        resources:
                        [
                            {
                                seconds: 0,             // Placeholder to count seconds
                                validity: "1C", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months, C: until next billing cycle
                                mayUnderflow: true,	    // Postpaid
                                creditPool: "defaultPool"
                            }
                        ]
                    }
                ]
            }
        ]
};

var plan1003=
{
	name: "1003",
	description: "IxD",
	services:
	[
		{
			name: "lowSpeedIxD",
			description: "Low speed IxD",
			serviceId: 0,
			ratingGroup: 102,
			subscribable: false,
			autoActivated: true,
			roamingAreas: null,
            preAuthorized: true,
            creditPoolNames: ["lowSpeed"],
            sortCreditsByExpirationDate: true,      // If false, credits will be used in the order declared in "creditPoolNames"
            oocAction: 1,                           // 0: Terminate. 1: Redirect. 2: Restrict_access
			recharges: 
			[
				{
					name: "Daily",
                    creationType: 2,		// Pay Per Use
					preAuthValidator: "http://localhost:8888/success",
                    resources:
                    [
                        {
                            validity: "1D", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months, C: until the end of the billing cycle
                            mayUnderflow: false,
                            creditPool: "lowSpeed"
                        }
                    ]
				},
				{
					name: "Purchasable",
                    creationType: 4,		// Portal
					price:
					[
						{startDate: ISODate("2013-01-01T03:00:00Z"), endDate: ISODate("2015-07-07T03:00:00Z"), value: 17.99},
						{startDate: ISODate("2015-07-07T03:00:00Z"), value: 19.99}
					],
                    resources:
                    [
                        {
                            validity: "1D", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months, C: until the end of the billing cycle
                            mayUnderflow: false,
                            creditPool: "lowSpeed"
                        }
                    ]
				}
			]
		}
	]
};

db.plans.insert(plan1001);
db.plans.insert(plan1002);
db.plans.insert(plan1003);

print("done");
print("");

print("----------------------------------");
print("Creating Capturesets");
print("----------------------------------");

db.captureSets.drop();

var captureSet1=
{
	name: "notificacion morosidad",
	enabled: true,
	startDate: 0,
	endDate: 0,
	URL: "http://localhost:9999/blockedUser",
	deactivateOnHit: true
};

db.captureSets.insert(captureSet1);

print("done");
print("");

