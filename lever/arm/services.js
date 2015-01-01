/**
 * Created by frodriguezg on 27/12/2014.
 */


var createServiceMgr=function(){

    var serviceMgr={};

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

    serviceMgr.breakEvent=function(event, calendar){
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

    return serviceMgr;
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

var serviceMgr=createServiceMgr();

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

var brokenEvents=serviceMgr.breakEvent(event, speedyNightCalendar);
console.log(JSON.stringify(brokenEvents, undefined, 2));


