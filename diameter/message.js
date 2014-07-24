// Object for manipulating diameter messages

var logger=require("./log").logger;
var ipaddr=require('ipaddr.js');
var dictionary=require("./dictionary").diameterDictionary;

var INITIAL_BUFF_LEN=1024;
var INCREMENT_BUFF_LEN=1024;
var INCREMENT_BUFF_THRESHOLD=512;
var DIAMETER_VERSION=1;

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
		message.avps=[];
	
		var nextAVP;
		var formerAVP;
		var avpName;
		while(totalLength>readPtr){
			message.avps.push(decodeAVP());
		}

		return message;

		function decodeAVP(){
			var i;
			var addrFamily;
			var ipv4Parts=[0, 0, 0, 0];
			var ipv6Parts=[0, 0, 0, 0, 0, 0, 0, 0];

			var avp={};

			// AVP Code
			var avpCode=buff.readUInt32BE(readPtr);
			avp.code=avpCode;

			// Flags
			var avpFlags=buff.readUInt8(readPtr+4);
			avp.isVendorSpecific=(avpFlags & 128)!==0;
			avp.isMandatory=(avpFlags & 64)!==0;

			// Length
			var avpLen=buff.readUInt16BE(readPtr+5)*256+buff.readUInt8(readPtr+7);

			var dataSize;
			if(avp.isVendorSpecific){ avp.vendorId=buff.readUInt32BE(readPtr+8); readPtr+=12; dataSize=avpLen-12;} else {avp.vendorId=null; readPtr+=8; dataSize=avpLen-8}
		
			var avpDef=dictionary.avpCodeMap[avp.vendorId||"0"][avpCode];
			if(avpDef){
				avp.name=avpDef.name;
				switch(avpDef.type){
					case "Unsigned32":
						avp.value=buff.readUInt32BE(readPtr);
						break;

					case "OctetString":
						break;

					case "DiamIdent":
						avp.value=buff.toString("ascii", readPtr, readPtr+dataSize);
						break;

					case "UTF8String":
						avp.value=buff.toString("utf8", readPtr, readPtr+dataSize);
						break;

					case "Address":
						addrFamily=buff.readUInt16BE(readPtr);
						if(addrFamily===1){
							for(i=0; i<4; i++) ipv4Parts[i]=buff.readUInt8(readPtr+2+i);
							avp.value=new ipaddr.IPv4(ipv4Parts).toString();
						}
						else if(addrFamily===2){
							for(i=0; i<8; i++) ipv6Parts[i]=buff.readUInt16BE(readPtr+2+i);
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
			readPtr+=dataSize;
			if(readPtr%4 > 0) readPtr+=(4-readPtr%4);

			return avp;
		}
	}

	// Retrieves an AVP value by name
	// May be a simple object, or an array if the attribute is multivalued
	message.getAVP=function(key){
		
	}

	// encode method
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

		var avpDef;
		var avp;
		var avpFlags;
		var avpLen=0;
		var writePtr=20;
		var writeLenPtr;
		var ipAddr;

		// Iterate through AVPs
		var i, j;
		for(i=0; i<message.avps.length; i++){
			avp=message.avps[i];
			avpDef=dictionary.avpNameMap[avp.name];
			if(!avpDef){
				logger.warn("Unknown attribute :" +JSON.stringify(avp));
				continue;
			}
			
			encodeAVP();
		}
		
		// Encode length
		buff.writeUInt16BE((writePtr - writePtr % 256)/256, 1);
		buff.writeUInt8(writePtr % 256, 3);

		return buff;

		function encodeAVP(){
			var ipAddr;
			var initialWritePtr=writePtr;
			
			// Write AVP Header
			// Code
			buff.writeUInt32BE(avpDef.code, writePtr);
			// Flags
			avpFlags=0;
			if(avpDef.vendorId) avpFlags+=128;
			if(avp.isMandatory) avpFlags+=64;
			buff.writeUInt8(avpFlags, writePtr+4);
			// Defer writting length
			writeLenPtr=writePtr+5;
			// VendorId
			if(avp.vendorId){
				buff.writeUInt32BE(avp.vendorId, writePtr+8);
				writePtr+=12;
			}
			else writePtr+=8;

			switch(avpDef.type){
				case "Unsigned32":
					buff.writeUInt32BE(avp.value, writePtr);
					writePtr+=4;
					break;
				case "OctetString":
					break;

				case "DiamIdent":
					writePtr+=buff.write(avp.value, writePtr, Buffer.byteLength(avp.value, "ascii"), "ascii");
					break;

				case "UTF8String":
					writePtr+=buff.write(avp.value, writePtr, Buffer.byteLength(avp.value, "utf8"), "utf8");
					break;

				case "Address":
					ipAddr=ipaddr.parse(avp.value);
					if(ipAddr.kind()==="ipv4"){
						buff.writeUInt16BE(1, writePtr);
						for(j=0; j<4; j++) buff.writeUInt8(ipAddr.octets[j], writePtr+2+j);
						writePtr+=2+4;
					}
					else if(ipAddr.kind()==="ipv6"){
						buff.writeUInt16BE(2, writePtr);
						for(j=0; j<8; j++) buff.writeUInt16BE(ipAddr.parts[j], writePtr+2+j);
						writePtr+=2+8;
					}
			}

			// Write length
			avpLen=writePtr-initialWritePtr;
			buff.writeUInt16BE((avpLen - avpLen % 256)/256, writeLenPtr);
			buff.writeUInt8(avpLen % 256, writeLenPtr+2);

			// Pad until 4 byte boundary
			while(writePtr % 4 !==0){
				buff.writeUInt8(0, writePtr);
				writePtr+=1;
			}
			
			// Enlarge if necessary
			if(buff.length-writePtr < INCREMENT_BUFF_THRESHOLD) buff=Buffer.concat([buff, new Buffer(INITIAL_BUFF_LEN)], buff.length+INITIAL_BUFF_LEN);
		}
	}

	return message;
}

exports.createMessage=createMessage;
