// Diameter connection functions
// Handle reading messages from TCP sockets, invoking diameterServer
// for each complete message

var dLogger=require("./log").dLogger;
var sendCER=require("./baseHandler").sendCER;
var sendWDR=require("./baseHandler").sendDWR;
var net=require("net");

var MAX_MESSAGE_SIZE=4096;

var createConnection=function(diameterServer, diameterHost, dwrInterval)
{
    var dc={};

    // Public properties
    dc.diameterServer=diameterServer;
    dc.diameterHost=diameterHost;

    // Private properties
    var dwrIntervalMs=dwrInterval||30000;
    var socket;
    var state="Closed";

    // Connection buffer
    var data=new Buffer(MAX_MESSAGE_SIZE);
    var currentMessageLength=0;
    var currentDataLength=0;

    // Public functions
    dc.connect=function(IPAddress, port){
        socket=net.connect(IPAddress, port);
        wireHandlers(socket);
        state="Wait-Conn-Ack";
    };

    dc.attachConnection=function(s){
        socket=s;
        wireHandlers(socket);
        state="Wait-CER";
    };

    dc.end=function(){
        if(socket) socket.end();
        state="Closed";
    };

    dc.write=function(buffer){
        socket.write(buffer);
    };

    dc.setOpen=function(){
        state="Open";
        setTimeout(watchdog, dwrIntervalMs);
    };
    
    dc.getState=function(){
        return state;
    };

    /////////////////////////////////////////////////////////////////
    // Socket event handlers
    /////////////////////////////////////////////////////////////////

    var wireHandlers=function(s){
        s.on("data", onData);
        s.on("connect", onConnect);
        s.on("close", onClose);
        s.on("error", onError);
    };

    // Data received handler
    var onData=function(buffer){

        // Socket buffer pointer
        var socketBufferPtr=0;

        // Helper function
        // Copies data in the data buffer up to the specified total message size
        // Returns true if target was met
        function copyData(targetSize, buff){
            // Data to copy is rest to get the target size or whatever is available in the buffer
            var copySize=Math.min(targetSize-currentDataLength, buff.length-socketBufferPtr);
            if(copySize==0) throw new Error();

            // Copy from buffer to data
            // targetBuffer, targetStart, sourceStart, sourceEnd
            buff.copy(data, currentDataLength, socketBufferPtr, socketBufferPtr+copySize);
            currentDataLength+=copySize;
            socketBufferPtr+=copySize;

            // true if all data was written
            return currentDataLength===targetSize;
        }

        // Helper function
        // Gets the diameter message size
        function getMessageLength(){
            return data.readInt16BE(1)*256+data.readUInt8(3);
        }

        var messageBuffer;
        dLogger.debug("Receiving " + buffer.length + " bytes from " + dc.diameterHost);

        try{
            // Iterate until all the received buffer has been copied
            // The buffer may span multiple diameter messages
            while (socketBufferPtr < buffer.length) {
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
                        dc.diameterServer.onMessageReceived(dc, messageBuffer);
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
    };

    /**
     * Called when the peer accepts the connection.
     * A CER command is sent.
     */
    var onConnect=function(){
        dLogger.verbose("Connection established with "+dc.diameterHost);
        sendCER(dc);
    };

    /**
     * When socket is closed, just change state
     */
    var onClose=function(){
        state="Closed";
    };

    // Error received. Just log. End event will be received
    var onError=function(err){
        dLogger.error("Error event received for connection "+dc.diameterHost+": "+err.message);
    };

    ///////////////////////////////////////////////////////////////////////////
    // Watchdog
    ///////////////////////////////////////////////////////////////////////////
    var watchdog=function() {
        if (state == "Open") sendWDR(dc);
    };

    return dc;
};

exports.createConnection=createConnection;

