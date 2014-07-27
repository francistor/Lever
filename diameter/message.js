// Object for manipulating diameter messages

var logger=require("./log").logger;
var ipaddr=require('ipaddr.js');
var dictionary=require("./dictionary").diameterDictionary;

var INITIAL_BUFF_LEN=1024;
var INCREMENT_BUFF_LEN=1024;
var INCREMENT_BUFF_THRESHOLD=512;
var DIAMETER_VERSION=1;

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
//
//	]
// }

function createMessage(){

	var message={};
	
	// decode method
	message.decode=function(buff){
		// Message length
		var totalLength=buff.readUInt16BE(1)*256+buff.readUInt8(3);

		// Flags
		var flags=buff.readUInt8(4);
		message.isRequest=(flags & 128)!==0;
		message.isProxyable=(flags & 64)!==0;
		message.isError=(flags & 32)!==0;
		message.isRetransmission=(flags & 16)!==0;

		// Code
		message.commandCode=buff.readUInt16BE(5)*256+buff.readUInt8(7);

		// Application-Id
		message.applicationId=buff.readUInt32BE(8);

		// Identifiers
		message.hopByHopId=buff.readUInt32BE(12);
		message.endToEndId=buff.readUInt32BE(16);

		// AVP
		var readPtr=20;
		var decodedAVP;
		message.avps={};
	
		while(totalLength>readPtr){
			decodedAVP={};
			readPtr+=decodeAVP(readPtr, decodedAVP);
			if(decodedAVP.value){
				// Create array of values if not yet existing
				if(!message.avps[decodedAVP.name]) message.avps[decodedAVP.name]=[];
				
				message.avps[decodedAVP.name].push(decodedAVP.value);
			}
		}

		return message;

		function decodeAVP(ptr, avp){
			var i;
			var initialPtr=ptr;
			var addrFamily;
			var ipv4Parts=[0, 0, 0, 0];
			var ipv6Parts=[0, 0, 0, 0, 0, 0, 0, 0];

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
						if(avp.value===undefined) logger.warn("Unknown enumerated code: "+buff.readInt32BE(ptr)+ " for "+avpDef.name);
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
						else logger.error("Unknown address family: "+addrFamily);
						break;

					default:
						logger.error("Unknown AVP type: "+avpDef.type);
				}
			}
			else logger.warn("Unknown AVP Code: "+avpCode);
		
			// Advance pointer up to a 4 byte boundary
			ptr+=dataSize;
			if(ptr%4 > 0) ptr+=(4-ptr%4);

			// Make up return values
			return ptr-initialPtr;
		}
	}

	// encode method
	// Returns a buffer with the binary contents, to be sent to the wire
	message.encode=function(){
		var buff=new Buffer(INITIAL_BUFF_LEN);

		// Encode header
		buff.writeUInt8(0, DIAMETER_VERSION);
		
		var flags=0;
		if(message.isRequest) flags+=128;
		if(message.isProxiable) flags+=64;
		if(message.isError) flags+=32;
		if(message.isRetransmission) flags+=16;
		buff.writeUInt8(flags, 4);

		buff.writeUInt16BE((message.commandCode - message.commandCode % 256)/256, 5);
		buff.writeUInt8(message.commandCode % 256, 7);

		buff.writeUInt32BE(message.applicationId, 8);
		buff.writeUInt32BE(message.hopByHopId, 12);
		buff.writeUInt32BE(message.endToEndId, 16);

		var writePtr=20;

		// Iterate through AVPs
		var i;
		var avpName;
		for(avpName in message.avps){
			for(i=0; i<message.avps[avpName].length; i++){
				// TODO: Mandatory bit is now always false
				writePtr+=encodeAVP(writePtr, avpName, message.avps[avpName][i], false);
			}
		}
		
		// Encode length of message
		buff.writeUInt16BE((writePtr - writePtr % 256)/256, 1);
		buff.writeUInt8(writePtr % 256, 3);

		return buff;

		function encodeAVP(ptr, name, value, isMandatory){
			var ipAddr;
			var initialPtr=ptr;
			var avpCode;
			var avpLen=0;
			var avpFlags=0;
			var avpDef=dictionary.avpNameMap[name];
			if(!avpDef){
				logger.warn("Unknown attribute :" +JSON.stringify(message.avps[name]));
				return 0;
			}

			// Defer writting length
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

			switch(avpDef.type){
				case "Unsigned32":
					buff.writeUInt32BE(value, ptr);
					ptr+=4;
					break;
				case "Enumerated":
					avpCode=avpDef.enumValues[value];
					if(avpCode==undefined){
						logger.warn("Unknown enumerated value: "+value+ "for "+avpDef.name);
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
	}

	return message;
}

exports.createMessage=createMessage;
