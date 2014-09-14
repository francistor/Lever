// Object for manipulating diameter messages

var dLogger=require("./log").dLogger;
var ipaddr=require('ipaddr.js');
var config=require("./config").config;

var INITIAL_BUFF_LEN=1024;
var INCREMENT_BUFF_THRESHOLD=512;
var DIAMETER_VERSION=1;

var resultCodes={
	DIAMETER_SUCCESS: 2001,
	DIAMETER_LIMITED_SUCCESS: 2002,
	DIAMETER_UNKNOWN_SESSION_ID: 5002,
	DIAMETER_UNABLE_TO_COMPLY: 5012
};

// ID generators
// HopByHopId is a random number
var nextHopByHopId=Math.floor(Math.random()*4294967296);    // 2^32
// EndToEndId is 12 bits date and 20 bits random number
var nextEndToEndId=(new Date().getTime() % 65535)+Math.floor(Math.random()*1048576);

// message.avps example structure
// 
// {name: [<value>, <value>], }
// where
// <value>=
// basic type or {name: [<value>, <value>], }
//
// avps:{
// 	Origin-Host: [
//		"my.origin.host"
//	],
//	Host-IP-Address: [
//		"127.0.0.1",
//		"fe80::1"
//	],
//	AGroupedValue: [
//		{
//		firstInternalAttribute:[
//			"avalue"
//		],
//		secondInternalAttribute:[
//			"onevalue",
//			"anothervalue"
//		]
//		}
//	]
// }

function createMessage(request){
    var dictionary=config.dictionary;

	var message={};
	message.avps={};
	
	// createMessage from request
	if(request){
		// Build basic response
		message.isRequest=false;
		message.isProxiable=request.isProxiable;
		message.isError=false;
		message.isRetransmission=false;
		message.commandCode=request.commandCode;
		message.applicationId=request.applicationId;
		message.hopByHopId=request.hopByHopId;
		message.endToEndId=request.endToEndId;
	}else{
        // Build basic message
        message.isRequest=true;
        message.isProxiable=true;
        message.isError=false;
        message.isRetransmission=false;
        message.commandCode=0;
        message.applicationId=0;
        message.hopByHopId=nextHopByHopId++;
        message.endToEndId=nextEndToEndId++;
    }
	
	// decode method
	message.decode=function(buff){
		// Make sure it is empty
		message.avps={};
		
		// Message length
		var totalLength=buff.readUInt16BE(1)*256+buff.readUInt8(3);

		// Flags
		var flags=buff.readUInt8(4);
		message.isRequest=(flags & 128)!==0;
		message.isProxyable=(flags & 64)!==0;
		message.isError=(flags & 32)!==0;
		message.isRetransmission=(flags & 16)!==0;

		// Code
		var commandCode=buff.readUInt16BE(5)*256+buff.readUInt8(7);
		if(dictionary.commandCodeMap[commandCode]) message.commandCode=dictionary.commandCodeMap[commandCode].name;
		else message.commandCode="commandCode-"+commandCode;

		// Application-Id
		var applicationId=buff.readUInt32BE(8);
		if(dictionary.applicationCodeMap[applicationId]) message.applicationId=dictionary.applicationCodeMap[applicationId].name;
		else message.applicationId="applicationId-"+applicationId;

		// Identifiers
		message.hopByHopId=buff.readUInt32BE(12);
		message.endToEndId=buff.readUInt32BE(16);

		// AVP
		var readPtr=20;
	
		while(totalLength>readPtr){
			readPtr+=decodeAVP(message.avps, readPtr);
		}

		return message;

		function decodeAVP(root, ptr){
			var avp={};
			var i;
			var initialPtr=ptr;
			var addrFamily;
			var ipv4Parts=[0, 0, 0, 0];
			var ipv6Parts=[0, 0, 0, 0, 0, 0, 0, 0];
			var groupedPtr;

			// AVP Code
			var avpCode=buff.readUInt32BE(ptr);
			avp.code=avpCode;

			// Flags
			var avpFlags=buff.readUInt8(ptr+4);
			avp.isVendorSpecific=(avpFlags & 128)!==0;
			avp.isMandatory=(avpFlags & 64)!==0;

			// Length
			var avpLen=buff.readUInt16BE(ptr+5)*256+buff.readUInt8(ptr+7);

			var dataSize;
			if(avp.isVendorSpecific){ avp.vendorId=buff.readUInt32BE(ptr+8); ptr+=12; dataSize=avpLen-12;} else {avp.vendorId=null; ptr+=8; dataSize=avpLen-8}
		
			var avpDef=dictionary.avpCodeMap[avp.vendorId||"0"][avpCode];
			if(avpDef){
				avp.name=avpDef.name;
				switch(avpDef.type){
					case "Unsigned32":
						avp.value=buff.readUInt32BE(ptr);
						break;
					case "Enumerated":
						avp.value=avpDef.enumCodes[buff.readInt32BE(ptr)];
						if(avp.value===undefined) dLogger.warn("Unknown enumerated code: "+buff.readInt32BE(ptr)+ " for "+avpDef.name);
						break;

					case "OctetString":
						break;

					case "DiamIdent":
						avp.value=buff.toString("ascii", ptr, ptr+dataSize);
						break;

					case "UTF8String":
						avp.value=buff.toString("utf8", ptr, ptr+dataSize);
						break;

					case "Address":
						addrFamily=buff.readUInt16BE(ptr);
						if(addrFamily===1){
							for(i=0; i<4; i++) ipv4Parts[i]=buff.readUInt8(ptr+2+i);
							avp.value=new ipaddr.IPv4(ipv4Parts).toString();
						}
						else if(addrFamily===2){
							for(i=0; i<8; i++) ipv6Parts[i]=buff.readUInt16BE(ptr+2+i);
							avp.value=new ipaddr.IPv6(ipv6Parts).toString();
						}
						else dLogger.error("Unknown address family: "+addrFamily);
						break;
						
					case "Grouped":
						// groupedPtr: internal pointer for the grouped avp
						groupedPtr=ptr;
						avp.value={};
						while(initialPtr+avpLen>groupedPtr){
							groupedPtr+=decodeAVP(avp.value, groupedPtr);
						}
						
						break;

					default:
						dLogger.error("Unknown AVP type: "+avpDef.type);
				}
			}
			else dLogger.warn("Unknown AVP Code: "+avpCode);
			
			// Add value
			if(avp.value){
				// Create array of values if not yet existing
				if(!root[avp.name]) root[avp.name]=[];
				root[avp.name].push(avp.value);
			}
		
			// Advance pointer up to a 4 byte boundary
			ptr+=dataSize;
			if(ptr%4 > 0) ptr+=(4-ptr%4);

			// Make up return values
			return ptr-initialPtr;
		}
	};

	// encode method
	// Returns a buffer with the binary contents, to be sent to the wire
	message.encode=function(){
        var dictionary=config.dictionary;
		
		var buff=new Buffer(INITIAL_BUFF_LEN);
		var commandCode, applicationId;
        var messageSpec;

		// Encode header
		buff.writeUInt8(DIAMETER_VERSION, 0);
		
		var flags=0;
		if(message.isRequest) flags+=128;
		if(message.isProxiable) flags+=64;
		if(message.isError) flags+=32;
		if(message.isRetransmission) flags+=16;
		buff.writeUInt8(flags, 4);

		// Encode command code
		if(!dictionary.commandNameMap[message.commandCode]) throw new Error("Unknown command code: "+message.commandCode);
		commandCode=dictionary.commandNameMap[message.commandCode].code;
		buff.writeUInt16BE((commandCode - commandCode % 256)/256, 5);
		buff.writeUInt8(commandCode % 256, 7);

		// Encode applicationId
		if(!dictionary.applicationNameMap[message.applicationId]) throw new Error("Unknown application id: "+message.applicationId);
		applicationId=dictionary.applicationNameMap[message.applicationId].code;
		buff.writeUInt32BE(applicationId, 8);

        // Get message spec from dictionary
        if(message.isRequest) messageSpec=dictionary.commandNameMap[message.commandCode]["request"];
        else messageSpec=dictionary.commandNameMap[message.commandCode]["response"];
        if(!messageSpec) throw new Error("Unknown message for command code: "+message.commandCode);

		buff.writeUInt32BE(message.hopByHopId, 12);
		buff.writeUInt32BE(message.endToEndId, 16);

		var writePtr=20;

		// Iterate through AVPs
		writePtr+=encodeAVPs(writePtr, message.avps);
		
		// Encode length of message
		buff.writeUInt16BE((writePtr - writePtr % 256)/256, 1);
		buff.writeUInt8(writePtr % 256, 3);

		return buff.slice(0, writePtr);
		
		// Iterate through avp names and array values
		// avps: { name: [value], name: [ {name: value}, {name: value}] }
		function encodeAVPs(ptr, root){
            var isMandatory;
			var i;
			var avpName;
			var initialPtr=ptr;
			for(avpName in root) if(root.hasOwnProperty(avpName)) {
				// TODO: Mandatory bit is now always true
                if(messageSpec[avpName] && messageSpec[avpName]["mandatory"] === true ) isMandatory=true; else isMandatory=false;
                if (Array.isArray(root[avpName])) for (i = 0; i < root[avpName].length; i++) {
                    ptr += encodeAVP(ptr, avpName, root[avpName][i], isMandatory);
                } else {
                    ptr += encodeAVP(ptr, avpName, root[avpName], isMandatory);
                }
			}
			
			return ptr-initialPtr;
		}

		// Encode a single AVP
		function encodeAVP(ptr, name, value, isMandatory){

            var j;
			var ipAddr;
			var initialPtr=ptr;
			var avpCode;
			var avpLen;
			var avpFlags=0;
			var avpDef=dictionary.avpNameMap[name];
			if(!avpDef){
				dLogger.warn("Unknown attribute :" +JSON.stringify(message.avps[name]));
				return 0;
			}

			// Defer writing length
			var writeLenPtr=ptr+5;
			
			// Write AVP Header
			// Code
			buff.writeUInt32BE(avpDef.code, ptr);
			// Flags
			if(avpDef.vendorId) avpFlags+=128;
			if(isMandatory) avpFlags+=64;
			buff.writeUInt8(avpFlags, ptr+4);

			// VendorId
			if(avpDef.vendorId){
				buff.writeUInt32BE(avpDef.vendorId, ptr+8);
				ptr+=12;
			}
			else ptr+=8;

			try{
				switch(avpDef.type){
					case "Unsigned32":
						buff.writeUInt32BE(value, ptr);
						ptr+=4;
						break;

					case "Enumerated":
						avpCode=avpDef['enumValues'][value];
						if(avpCode==undefined){
							dLogger.warn("Unknown enumerated value: "+value+ "for "+avpDef.name);
							return 0;
						}
						buff.writeInt32BE(avpCode, ptr);
						ptr+=4;
						break;

					case "OctetString":
						break;

					case "DiamIdent":
						ptr+=buff.write(value, ptr, Buffer.byteLength(value, "ascii"), "ascii");
						break;

					case "UTF8String":
						ptr+=buff.write(value, ptr, Buffer.byteLength(value, "utf8"), "utf8");
						break;

					case "Address":
						ipAddr=ipaddr.parse(value);
						if(ipAddr.kind()==="ipv4"){
							buff.writeUInt16BE(1, ptr);
							for(j=0; j<4; j++) buff.writeUInt8(ipAddr.octets[j], ptr+2+j);
							ptr+=2+4;
						}
						else if(ipAddr.kind()==="ipv6"){
							buff.writeUInt16BE(2, ptr);
							for(j=0; j<8; j++) buff.writeUInt16BE(ipAddr.parts[j], ptr+2+j);
							ptr+=2+8;
						}
						break;
						
					case "Grouped":
						ptr+=encodeAVPs(ptr, value);
						break;
				}
			}
			catch(e){
				dLogger.warn("Error encoding "+name+" with value: "+value);
                return 0;
			}

			// Write length of attribute
			avpLen=ptr-initialPtr;
			buff.writeUInt16BE((avpLen - avpLen % 256)/256, writeLenPtr);
			buff.writeUInt8(avpLen % 256, writeLenPtr+2);

			// Pad until 4 byte boundary
			while(ptr % 4 !==0){
				buff.writeUInt8(0, ptr);
				ptr+=1;
			}
			
			// Enlarge buffer if necessary
			if(buff.length-ptr < INCREMENT_BUFF_THRESHOLD) buff=Buffer.concat([buff, new Buffer(INITIAL_BUFF_LEN)], buff.length+INITIAL_BUFF_LEN);

			return ptr-initialPtr;
		}
	};

	return message;
}

exports.createMessage=createMessage;
exports.resultCodes=resultCodes;
