// Provides functions to write CDR
// either to file or to database

var fs=require("fs");
var endOfLine=require('os').EOL;
var fieldSeparator=",";

var checkIntervalMillis=100;

var createCDRService=function(){

    var cdrService={};

    var cdrConfig=JSON.parse(fs.readFileSync(__dirname+"/conf/cdr.json", {encoding: "utf8"}));
    if(!cdrConfig) throw Error("Bad cdr.json syntax");

    var lastCheckDate=new Date().getTime();

    // Helper functions
    var rollChannelFile=function(channel){

        if((new Date().getTime()-lastCheckDate) < checkIntervalMillis) return;

        var dateSpec=null;
        var now;
        var fileName;

        function twoDigit(d){
            if(d<10) return "0"+d; else return String(d);
        }

        // Build file name
        now=new Date();
        if(channel["rolling"]=="day"){
            dateSpec=String(now.getFullYear())+twoDigit(now.getMonth()+1)+twoDigit(now.getDate());
            fileName=channel.location+dateSpec+channel.extension;
        }
        else if(channel["rolling"]=="hour"){
            dateSpec=String(now.getFullYear())+twoDigit(now.getMonth()+1)+twoDigit(now.getDate())+twoDigit(now.getHours());
            fileName=channel.location+dateSpec+channel.extension;
        }
        else if(channel["rolling"]=="minute"){
            dateSpec=String(now.getFullYear())+twoDigit(now.getMonth()+1)+twoDigit(now.getDate())+twoDigit(now.getHours())+twoDigit(now.getMinutes());
            fileName=channel.location+dateSpec+channel.extension;
        }
        else{
            // No rolling over
            fileName=channel.location+channel.extension;
        }

        // Create the file stream
        var ws=fs.createWriteStream(fileName, {flags: "a+", encoding: "utf8", mode: "0666"});
        channel.dateSpec=dateSpec;
        if(channel.ws) channel.ws.end();
        channel.ws=ws;

        ws.on("error", function(err){
            throw err;
        });
    };

    // Add pointers to real stores in the configuration
    var channel;
    for(var i=0; i<cdrConfig.length; i++){
        channel=cdrConfig[i];
        if(channel.type=="file"){
            channel.fd=null;
            channel.dateSpec=null;

            rollChannelFile(channel);
        } else {
            console.log("channel type not supported");
        }
    }

    cdrService.writeCDR=function(message){

        var chunk;
        var channel;
        var avpName;
        var avps=message.avps||message.attributes; // Diameter or radius
        var cdrDoc={};

        // Iterate through filters
        for(var i=0; i<cdrConfig.length; i++){
            // Write on each one of the channels
            channel=cdrConfig[i];

            // Write
            if(channel.type==="file"){
                rollChannelFile(channel);

                chunk="";
                if(channel.format==="livingstone"){
                    // Write date
                    chunk+=new Date().toISOString()+endOfLine;

                    // Write attributes
                    if(channel.filter) for(var j=0; j<channel.filter.length; j++){
                        chunk+="\t"+channel.filter[j]+"="+avps[channel.filter[j]]+endOfLine;
                    } else for(avpName in avps) if(avps.hasOwnProperty(avpName)){
                        chunk+="\t"+avpName+"="+avps[avpName]+endOfLine;
                    }
                    chunk+=endOfLine;
                } else if(channel.format==="fixed"){

                    // Write attributes
                    if(channel.filter) for(var j=0; j<channel.filter.length; j++){
                        chunk+=avps[channel.filter[j]]+endOfLine;
                    } else for(avpName in avps) if(avps.hasOwnProperty(avpName)){
                        chunk+=avps[avpName]+endOfLine;
                    }
                    chunk+=endOfLine;
                }
                channel.ws.write(chunk);

            } else if(channel.type==="database"){
                if(channel.filter) {
                    for (var j = 0; j < channel.filter.length; j++) {
                        cdrDoc[channel.filter[j]] = message[channel.filter[j]];
                    }
                } else cdrDoc=avps;

                // Write doc here
                console.log("Not implemented")
            }
        }
    };

    return cdrService;
};

exports.CDRService=createCDRService();