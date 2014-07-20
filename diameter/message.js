// Object for manipulating diameter messages

var logger=require("./log").logger;
var ipaddr=require('ipaddr.js');
var dictionary=require("./dictionary").diameterDictionary;

var INITIAL_BUFF_LEN=1024;
var INCREMENT_BUFF_LEN=1024;
var INCREMENT_BUFF_THRESHOLD=512;
var DIAMETER_VERSION=1;

function createMessage(){

	// Message remains private
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
			if(avp.isVendorSpecific){ avp.vendorId=buff.readUInt32BE(readPtr+8); readPtr+=12; dataSize=avpLen-12;} else {avp.VendorId=null; readPtr+=8; dataSize=avpLen-8}
		
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
		buff.writeUInt8(4, flags);

		buff.writeUInt16BE(5, message.commandCode/256);
		buff.writeUInt8(7, message.commandCode % 256);

		buff.writeUInt32BE(8, message.applicationId);
		buff.writeUInt32BE(12, message.hopByHopId);
		buff.writeUInt32BE(16, message.endToEndId);

		var avpDef;
		var avp;
		avpFlags;
		var avpLen=0;
		var writePtr=0;
		var writeLenPtr;
		var ipAddr;

		// Iterate through AVPs
		var i, j;
		for(i=0; i<avps.length; i++){
			avp=message.avps[i];
			avpDef=dictionary.avp[avp.vendorId||"0"][avp.name];
			if(!avpDef){
				logger.warn("Unknown attribute :" +JSON.stringify(avp));
				continue;
			}
			
			writePtr=encodeAVP();
		}

		return buff;

		function encodeAVP(){
			// Write AVP Header
			buff.writeUInt32BE(writePtr, avpDef.code);
					
			avpFlags=0;
			if(avpDef.vendorId) avpFlags+=128;
			if(avp.isMandatory) avpFlags+=64;
			buff.writeUInt8(writePtr+4, avpFlags);

			// Defer writting length
			writeLenPtr=writePtr+5;

			if(avp.vendorId){
				buff.writeUInt32BE(writePtr+8, avp.vendorId);
				writePtr+=12;
			}
			else writePtr+=8;

			switch(avpDef.type){
				case "Unsigned32":
					buff.writeUInt32BE(writePtr, avp.value);
					avpLen=4;
					break;
				case "OctetString":
					break;

				case "DiamIdent":
					buff.writeString(avp.value, writePtr, "ascii");
					avpLen=buff.byteLength(avp.value, "ascii");
					break;

				case "UTF8String":
					buff.writeString(avp.value, writePtr, "utf8");
					avpLen=buff.byteLength(avp.value, "utf8");
					break;

				case "Address":
					ipAddr=ipaddr.parse(avp.value);
					if(ipAddr.kind()==="ipv4"){
						buff.writeUInt16(writePtr, 1);
						for(j=0; j<4; j++) buff.writeUInt8(writePtr+2+j, ipAddr.octects[j]);
						avpLen=2+4;
					}
					else if(ipAddr.kind()==="ipv6"){
						buff.writeUInt16(writePtr, 2);
						for(j=0; j<8; j++) buff.writeUInt16BE(writePtr+2+j, ipAddr.parts[j]);
						avpLen=2+8;
					}
					
					
			}

			// Write length
			buff.writeUInt16BE(writeLenPtr, avpLen/256);
			buff.writeUInt8(writeLenPtr+2, avplen % 256);

			// Pad until 4 byte boundary
			writePtr+=avpLen;
			while(writePtr % 4 !==0){
				buff.writeUInt8(writePtr, 0);
				writePtr+=1;
			}
			
			// Enlarge if necessary
			if(buff.length-writePtr < INCREMENT_BUFF_THRESHOLD) buff=Buffer.concat([buff, new Buffer(INITIAL_BUFF_LEN)], buff.length+INITIAL_BUFF_LEN);

			return writePtr;
		}
	}

	return message;
}

exports.createMessage=createMessage;
