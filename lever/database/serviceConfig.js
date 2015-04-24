load("urlConfig.js");

print("");
print("----------------------------------");
print("Creating Calendar");
print("----------------------------------");

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

print("----------------------------------");
print("Creating Service Configuration");
print("----------------------------------");

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
			autoActivated: true,
			roamingAreas: null,
            preAuthorized: true,
			creditPoolNames: ["bytesRecurring", "bytesPurchased"],
            sortCreditsByExpirationDate: true,      // If false, credits will be used in the order declared in "creditPoolNames"
			oocAction: 0,                           // 0: Terminate. 1: Redirect. 2: Restrict_access
			recharges: 
			[
				{
					name: "1001 recurring",
					bytes: 1024,
					validity: "1M", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months
					creationType: 3,		// 1: initial, 2: per_use, 3: recurring, 4: portal, 5: external
					mayUnderflow: false,
					creditPool: "bytesRecurring"
				},
				{
					name: "1001 purchase",
					bytes: 1024,
					validity: "2M",
					creationType: 4,		// Portal
					mayUnderflow: false,
					creditPool: "bytesPurchased",
					price:
					[
						{startDate: ISODate("2013-01-01T03:00:00Z"), endDate: ISODate("2015-07-07T03:00:00Z"), value: 17.99},
						{startDate: ISODate("2015-07-07T03:00:00Z"), value: 19.99}
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
			autoActivated: false
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
			autoActivated: true,
			roamingAreas: null,
            preAuthorized: true,
            creditPoolNames: ["ppu", "ppupurchased"],
            sortCreditsByExpirationDate: true,      // If false, credits will be used in the order declared in "creditPoolNames"
            oocAction: 1,                           // 0: Terminate. 1: Redirect. 2: Restrict_access
			recharges: 
			[
				{
					name: "1002 ppu",
					validity: "1h", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months
					creationType: 2,		// Pay Per Use
					mayUnderflow: false,
					creditPool: "ppu",
					price:
					[
						{value: 19.99}
					]
				},
				{
					name: "1002 purchase",
					validity: "2h",
					creationType: 4,		// Portal	
                    mayUnderflow: false,
					creditPool: "ppupurchased",
					price:
					[
						{startDate: ISODate("2013-01-01T03:00:00Z"), endDate: ISODate("2015-07-07T03:00:00Z"), value: 0.99},
						{startDate: ISODate("2015-07-07T03:00:00Z"), value: 1.99}
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
			autoActivated: true,
			roamingAreas: null,
            calendarName: "speedynight",
			creditPoolNames: ["speedyNightPeakPool"],
            oocAction: 0,                           // 0: Terminate. 1: Redirect. 2: Restrict_access
            sortCreditsByExpirationDate: false,     // If false, credits will be used in the order declared in "creditPoolNames"
			recharges: 
			[
				{
					name: "SpeedyNight Recurring",
					bytes: 0,
					seconds: 0,
					validity: "1h", 		// h: hours, d: days, m: months, H until the end of $$ hours, D: until the end of $$ days, M: until the end of $$ months
					creationType: 3,		// Recurring
					mayUnderflow: true,			// Postpaid
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

