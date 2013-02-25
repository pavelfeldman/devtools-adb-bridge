function AdbClient(host, port)
{
    this._adbHost = host;
    this._adbPort = port;

    this._portFrom = 9223;
    this._portTo = 9233;
    this._nextPort = this._portFrom;
}

AdbClient.prototype = {
    devices: function(callback)
    {
        this.sendCommand("host:devices", function(response) {
            if (response === null) {
                callback(null);
                return;
            }

            var lines = response.split("\n");
            var serialNumbers = [];
            for (var i = 0; i < lines.length; ++i) {
                if (!lines[i])
                    continue;
                var tokens = lines[i].split("\t");
                serialNumbers.push(tokens[0]);
            }
            callback(serialNumbers);
        });
    },

    forward: function(serialNumber, port, callback)
    {
        if (!port) {
            port = this._nextPort++;
            if (this._nextPort == this._portTo)
                this._nextPort = this._portFrom;
        }
        this.sendCommand("host-serial:" + serialNumber + ":forward:tcp:" + port + ";localabstract:chrome_devtools_remote", callback.bind(null, port));
    },

    sendCommand: function(command, callback)
    {
        this._connect(this._sendCommand.bind(this, command, callback));
    },

    _connect: function(callback)
    {
        chrome.socket.create('tcp', {}, onCreate.bind(this));
        var socketId;

        function onCreate(createInfo)
        {
            socketId = createInfo.socketId;
            chrome.socket.connect(socketId, this._adbHost, this._adbPort, callback.bind(null, socketId));
        }
    },

    _sendCommand: function(command, callback, socketId)
    {
        var lengthString = new Number(command.length).toString(16).toUpperCase();
        lengthString = "0000".substring(0, 4 - lengthString.length) + lengthString;
        var blob = new Blob([lengthString + command]);
        var fileReader = new FileReader();
        fileReader.onload = function(e) {
            chrome.socket.write(socketId, e.target.result, onWritten);
        };
        fileReader.readAsArrayBuffer(blob);

        function onWritten()
        {
            chrome.socket.read(socketId, null, onDataRead);
        }

        function onDataRead(readInfo)
        {
            if (readInfo.resultCode <= 0) {
                callback(null);
                return;
            }
            var blob = new Blob([new Uint8Array(readInfo.data)]);
            var fileReader = new FileReader();
            fileReader.onload = function(e)
            {
                var result = e.target.result;
                if (!result.indexOf("OKAY"))
                    callback(result.substring(8));
                else {
                    console.error(result);
                    callback(null);
                }
            };
            fileReader.readAsText(blob);
        }
    }
}

adbClient = new AdbClient("127.0.0.1", 5037);
setInterval(updateDevices, 1000);

function updateDevices()
{
    adbClient.devices(function(serialNumbers) {
        if (!serialNumbers)
            return;

        var listElement = document.getElementById("list");
        var toRemove = [];
        for (var itemElement = listElement.firstChild; itemElement; itemElement = itemElement.nextSibling) {
            var index = serialNumbers.indexOf(itemElement._serialNumber);
            if (index === -1)
                toRemove.push(itemElement);
            else
                serialNumbers.splice(index, 1);
        }
        for (var i = 0; i < toRemove.length; ++i)
            listElement.removeChild(toRemove[i]);
        for (var i = 0; i < serialNumbers.length; ++i) {
            var serialNumber = serialNumbers[i];
            var itemElement = document.createElement("a");
            itemElement._serialNumber = serialNumber;
            itemElement.textContent = serialNumber;
            itemElement.className = "item";
            itemElement.href = "javascript:void()";
            itemElement.target = "_blank";
            itemElement.onclick = attach.bind(null, itemElement);
            listElement.appendChild(itemElement);
        }
    });
}

function attach(itemElement)
{
    adbClient.forward(itemElement._serialNumber, itemElement._port, function(port) {
        itemElement._port = port;
        itemElement.textContent = itemElement._serialNumber + " :" + itemElement._port;
        chrome.app.window.create("devtools-page.html?url=http://localhost:" + port, {
            width: 800,
            height: 600
        });
    });
}
