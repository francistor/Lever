// Diameter message decoding and encoding functions

var logger=require("./log").logger;
var ipaddr=require('ipaddr.js');
var dictionary=require("./dictionary").diameterDictionary;

// Returns a JSON object containing the message
// {
//	isRequest:<>
//	isProxiable:<>
//	isError:<>
//	isRetransmission:<>
//	hopByHopId:<>
//	endToEndId:<>
//	commandCode:<>
//	avps:[array of AVP]
//		{attributeName:<>, value: <>}
//			
function parseMessage(buff){

	var message={};
	
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
	
	while(totalLength>readPtr){
		message.avps.push(parseAVP());
	}

	return message;

	function parseAVP(){
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
					avp.value=buff.toString("utf8", readPtr, readPtr+dataSize);
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
		else logger.error("Unknown AVP Code: "+avpCode);
		
		// Advance pointer up to a 4 byte boundary
		readPtr+=dataSize;
		if(readPtr%4 > 0) readPtr+=(4-readPtr%4);

		return avp;
	}
}

exports.parseMessage=parseMessage;
