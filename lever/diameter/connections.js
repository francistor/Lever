// Diameter connection functions
// Handle reading messages from TCP sockets, invoking diameterStateMachine
// for each complete message

var dLogger=require("./log").dLogger;

var MAX_MESSAGE_SIZE=4096;

var createConnection=function(diameterStateMachine, socket, hostName, state)
{
    var dc={};

    // Public properties
    dc.socket=socket;
    dc.hostName=hostName;
    dc.state=state||"Closed";
    dc.diameterStateMachine=diameterStateMachine;

    // Connection buffer
    var data=new Buffer(MAX_MESSAGE_SIZE);
    var currentMessageLength=0;
    var currentDataLength=0;

    // Socket buffer
    var bufferPtr=0;

    // Helper function
    // Copies data in the data buffer up to the specified total message size
    // Returns true if target was met
    function copyData(targetSize, buff){
        // Data to copy is rest to get the target size or whatever is available in the buffer
        var copySize=Math.min(targetSize-currentDataLength, buff.length-bufferPtr);

        // Copy from buffer to data
        // targetBuffer, targetStart, sourceStart, sourceEnd
        buff.copy(data, currentDataLength, bufferPtr, bufferPtr+copySize);
        currentDataLength+=copySize;
        bufferPtr+=copySize;

        // true if all data was written
        return bufferPtr === targetSize;
    }

    // Helper function
    // Gets the diameter message size
    function getMessageLength(){
        return data.readInt16BE(1)*256+data.readUInt8(3);
    }

    // Data received
    dc.socket.on("data", function(buffer) {
        var messageBuffer;
        dLogger.debug("Receiving " + buffer.length + " bytes from " + dc.hostName);

        bufferPtr = 0;

        try{
            // Iterate until all the received buffer has been copied
            // The buffer may span multiple diameter messages
            while (bufferPtr < buffer.length) {
                if (currentMessageLength === 0) {
                    // Still the message size is unknown. Try to copy the length
                    if (copyData(4, buffer)) {
                        currentMessageLength = getMessageLength();
                    }
                }
                else {
                    if (copyData(currentMessageLength, buffer)) {
                        // Create new buffer
                        messageBuffer = new Buffer(currentMessageLength);

                        // Copy data to new buffer
                        data.copy(messageBuffer, 0, 0, currentMessageLength);

                        // Reset buffer
                        currentMessageLength = 0;
                        currentDataLength = 0;

                        // Process message
                        dc.diameterStateMachine.onMessageReceived(dc, messageBuffer);
                    }
                }
            }
        }
        catch(e){
            dLogger.error("Diameter decoding error: "+e.message);
            dLogger.error(e.stack);
            socket.end();
            state="Closing";
        }
    });

    dc.socket.on("connect", function(){
        dc.diameterStateMachine.onConnectionACK(dc);
    });

    // When socket is closed, inform StateMachine
    dc.socket.on("close", function(){
        dc.diameterStateMachine.onConnectionClosed(dc);
    });

    // Error received. Just log. TODO
    dc.socket.on("error", function(err){
        dLogger.error("Error event received: "+err.message);
    });

    return dc;
};

exports.createConnection=createConnection;

