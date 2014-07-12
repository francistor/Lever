// Diameter message decoding and encoding functions

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
function parseMessage(buff, dictionary){

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
		var avp={};

		// AVP Code
		var avpCode=buff.readUInt32BE(readPtr);
console.log("----------- ptr: "+readPtr+" code: "+avpCode);
		avp.code=avpCode;

		// Flags
		var avpFlags=buff.readUInt8(readPtr+4);
		avp.isVendorSpecific=(avpFlags & 128)!==0;
		avp.isMandatory=(avpFlags & 64)!==0;

		// Length
		var avpLen=buff.readUInt16BE(readPtr+5)*256+buff.readUInt8(readPtr+7);
console.log("-----------avpLen: "+avpLen);

		var dataSize;
		if(avp.isVendorSpecific){ avp.vendorId=buff.readUInt32BE(readPtr+8); readPtr+=12; dataSize=avpLen-12;} else {avp.VendorId=null; readPtr+=8; dataSize=avpLen-8}
		
		var avpDef=dictionary.avpCodeMap[avp.vendorId||"0"][avpCode];
		if(avpDef){
			avp.name=avpDef.name;
			switch(avpDef.type){
				case "OctetString":
				break;

				case "UTF8String":
					avp.value=buff.toString("utf8", readPtr, readPtr+dataSize);
				break;

				default:
				console.error("Unknown AVP type: "+avpDef.type);
			}
		}
		else console.error("Unknown AVP Code: "+avpCode);
		
		// Advance pointer up to a 4 byte boundary
		readPtr+=dataSize;
		if(readPtr%4 > 0) readPtr+=(4-readPtr%4);

		return avp;
	}
}

exports.parseMessage=parseMessage;
