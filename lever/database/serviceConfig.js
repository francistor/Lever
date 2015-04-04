load("urlConfig.js");

printjson("----------------------------------");
printjson("Creating Calendar");
printjson("----------------------------------");

var db=connect(leverConfigDatabase.substring(10));
db.calendars.drop();

// Array items must be in the appropriate order
var speedyNightCalendar=
{
	name: "speedyNight",
	calendarItems:
	[
	 	{
	 		type: 1,
	 		startDate: "2014-01-01",
	 		endDate: "2014-01-02",
	 		tag: "speedynight"
	 	},
	 	{
	 		type: 2,
	 		startWeekDay: 6,
	 		startTime: "20:00",
	 		endWeekDay: 2,
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

db.calendars.insert(speedyNightCalendar);

print("done");
print("");

printjson("----------------------------------");
printjson("Creating Service Configuration");
printjson("----------------------------------");

db.plans.drop();

var plan1001=
{
	name: "1001",
	description: "Bytes recurring prepaid",
	services:
	[
		{
			name: "bytesservice",
			description: "Bytes recurring prepaid",
			serviceId: 0,
			ratingGroup: 101,
			subscribable: false,
			autoactivated: true,
			roamingAreas: null,
			creditPoolNames: ["bytesrecurring", "bytespurchased"],
			lastAction: 1,          // Whether to deny access if no credit (1) or continue (0)
			poolSearchPolicy: 1,    // May be 0 for fixed or 1 for expirationdate
			recharges: 
			[
				{
					name: "1001 recurring",
					bytes: 1024,
					seconds: 1000000000000,
					validity: "1M", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months
					creationType: 3,		// 1: initial, 2: per_use, 3: recurring, 4: portal, 5: external
					prepaidType: 2,			// 1: postpaid, 2: prepaid
					creditPool: "bytesrecurring"
				},
				{
					name: "1001 purchase",
					bytes: 1024,
					seconds: 1000000000000,
					validity: "2M",
					creationType: 4,		// Portal
					prepaidType: 2,			// Prepaid
					creditPool: "bytespurchased",
					price:
					[
						{startDate: "1/1/2010", endDate: "1/1/2013", value: 17.99},
						{startDate: "1/1/2013", value: 19.99}
					]
				}
			]
		}
		,
		{
			name: "ott",
			description: "onVideo",
			serviceId: 0,
			ratingGroup: 1001,
			subscribable: true,
			autoactivated: false
		}
	]
}

var plan1002=
{
	name: "1002",
	description: "Pay per use",
	services:
	[
		{
			name: "ppu",
			description: "default",
			serviceId: 0,
			ratingGroup: 102,
			subscribable: false,
			autoactivated: true,
			roamingAreas: null,
			creditPoolNames: ["ppu", "ppupurchased"],
			lastAction: 1,			
			poolSearchPolicy: 1,
			recharges: 
			[
				{
					name: "1002 ppu",
					bytes: 2048,
					seconds: 1000000000000,
					validity: "1h", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months
					creationType: 1,		// Pay Per Use
					prepaidType: 1,			// Prepaid
					creditPool: "ppu",
					price:
					[
						{value: 19.99}
					]
				},
				{
					name: "1002 purchase",
					bytes: 1000000000000,
					seconds: 1000000000000,
					validity: "2h",
					creationType: 4,		// Portal	
					prepaidType: 2,			// Prepaid
					creditPool: "ppupurchased",
					price:
					[
						{startDate: "1/1/2010", endDate: "1/1/2013", value: 0.99},
						{startDate: "1/1/2013", value: 1.99}
					]
				}
			]
		}
	]
};

var plan1003=
{
	name: "1003",
	description: "SpeedyNight",
	services:
	[
		{
			name: "speedynight",
			description: "Speedy Night",
			serviceId: 0,
			ratingGroup: 103,
			subscribable: false,
			autoactivated: true,
			roamingAreas: null,
			creditPoolNames: ["speedyNightPeakPool"],
			calendarName: "speedynight",
			lastAction: 0,				// Whether to deny access if no credit (1) or continue (0)
			poolSearchPolicy: 0,		// May be 0 for fixed or 1 for expirationdate
			recharges: 
			[
				{
					name: "SpeedyNight Recurring",
					bytes: 0,
					seconds: 0,
					validity: "1h", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months
					creationType: 3,		// Recurring
					prepaidType: 1,			// Postpaid
					creditPool: "speedyNightPeakPool",
					calendarTags: ["default"]
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

printjson("----------------------------------");
printjson("Creating Capturesets");
printjson("----------------------------------");

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

