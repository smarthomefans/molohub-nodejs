"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var os = __importStar(require("os"));
var process = __importStar(require("process"));
var molo_client_app_1 = require("./molo_client_app");
var remote_session_1 = require("./remote_session");
var molo_socket_1 = require("./lib/molo_socket");
var events_1 = require("events");
var CLIENT_STATUS_UNBINDED = "unbinded";
var CLIENT_STATUS_BINDED = "binded";
var CONNECTE_STATUS_DISCONNECT = 100;
var CONNECTE_STATUS_CONNECTING = 101;
var CONNECTE_STATUS_CONNECTED = 102;
var MolohubClient = /** @class */ (function (_super) {
    __extends(MolohubClient, _super);
    function MolohubClient(rhost, rport, lhost, lport, seed) {
        var _this = _super.call(this) || this;
        _this.clientid = "";
        _this.clientStatus = CLIENT_STATUS_BINDED;
        _this.token = "";
        _this.connectStatus = CONNECTE_STATUS_DISCONNECT;
        _this.rhost = rhost;
        _this.rport = rport;
        _this.lhost = lhost;
        _this.lport = lport;
        _this.localSeed = seed;
        return _this;
    }
    MolohubClient.prototype.clear = function () {
        this.clientStatus = CLIENT_STATUS_UNBINDED;
        this.connectStatus = CONNECTE_STATUS_DISCONNECT;
    };
    MolohubClient.prototype.newLocalSeedHandler = function (seed) {
        this.emit("newSeed", seed);
    };
    MolohubClient.prototype.sockConnect = function () {
        var _this = this;
        this.clear();
        this.client = new molo_socket_1.MoloSocket(this.rhost, this.rport, "Client");
        this.client.connect();
        this.connectStatus = CONNECTE_STATUS_CONNECTING;
        this.client.on("connect", function () {
            console.log("on client connect");
            _this.connectStatus = CONNECTE_STATUS_CONNECTED;
            var bodyData = {};
            bodyData['Type'] = 'Auth';
            bodyData['Payload'] = {};
            bodyData['Payload']['OS'] = os.platform() + "_" + os.arch() + "_" + os.release();
            bodyData['Payload']['PyVersion'] = process.version; //TODO: node version
            bodyData['Payload']['App'] = 'MolohubNodeJs';
            bodyData['Payload']['MacAddr'] = 'testMac'; //TODO:
            if (_this.localSeed) {
                bodyData['Payload']['LocalSeed'] = _this.localSeed;
            }
            else {
                var seed = Math.random().toString(36).substr(2);
                bodyData['Payload']['LocalSeed'] = seed;
                _this.newLocalSeedHandler(seed);
            }
            if (_this.client)
                _this.client.send(bodyData);
        });
        this.client.on("data", function (data) {
            _this.processJsonPack(data);
        });
        this.client.on("end", function () {
            console.log('onDisconnect');
            _this.clear();
        });
        this.client.on('error', function () {
            console.log("sock Error:!!!");
            _this.clear();
        });
        setInterval(function () {
            _this.sendPing();
            //reconnect server when disconnected.
            if (_this.connectStatus == CONNECTE_STATUS_DISCONNECT) {
                console.log("reconnecting...");
                _this.sockConnect();
            }
        }, 5000);
    };
    MolohubClient.prototype.processJsonPack = function (jdata) {
        var protocolType = jdata['Type'];
        if (protocolType == 'AuthResp')
            this.onAuthResp(jdata);
        else if (protocolType == 'NewTunnel')
            this.onNewTunnel(jdata);
        else if (protocolType == 'TokenExpired')
            this.onTokenExpired(jdata);
        else if (protocolType == 'BindStatus')
            this.onBindStatus(jdata);
        else if (protocolType == 'ReqProxy')
            this.onReqProxy();
    };
    MolohubClient.prototype.sendPing = function () {
        if (this.connectStatus != CONNECTE_STATUS_CONNECTED)
            return;
        var payload = {};
        payload['Token'] = this.token;
        payload['Status'] = this.clientStatus;
        var bodyData = {};
        bodyData['Payload'] = payload;
        bodyData['Type'] = 'Ping';
        if (this.client)
            this.client.send(bodyData);
    };
    MolohubClient.prototype.onAuthResp = function (jdata) {
        this.clientid = jdata['Payload']['ClientId'];
        var payload = {};
        payload['ReqId'] = 1;
        payload['MacAddr'] = 'testMacAddr';
        payload['ClientId'] = this.clientid;
        payload['Protocol'] = 'tcp';
        var bodyData = {};
        bodyData['Payload'] = payload;
        bodyData['Type'] = 'ReqTunnel';
        console.log('clienid: ' + this.clientid);
        console.log('payload: ' + JSON.stringify(payload));
        if (this.client)
            this.client.send(bodyData);
    };
    MolohubClient.prototype.onNewTunnel = function (jdata) {
        this.token = jdata['Payload']['token'];
        console.log('!!!login succeed clientid:' + this.clientid + " token:" + this.token);
        //online config, such as markdown template
        var onlineConfig = jdata['OnlineConfig'];
        this.emit("newTunnel", onlineConfig);
        this.onBindStatus(jdata);
    };
    MolohubClient.prototype.onBindStatus = function (jdata) {
        var payload = jdata['Payload'];
        this.clientStatus = payload['Status'];
        payload['token'] = this.token;
        this.emit("updateStatus", this.clientStatus);
        //TODO update client status to ui by markdown
    };
    MolohubClient.prototype.onUnBindAuth = function () {
        //TODO update to ui by markdown
    };
    /*
    onPong(jdata) {
        //console.log("onPong " + jdata.toString());
    }*/
    MolohubClient.prototype.onTokenExpired = function (jdata) {
        // token expired, update a new one.
        this.token = jdata['Payload']['token'];
    };
    MolohubClient.prototype.onReqProxy = function () {
        //TODO new remote session to build new tunnel
        var remote = new remote_session_1.RemoteSession(this.clientid, this.rhost, this.rport, this.lhost, this.lport);
        remote.on("add", function (localID, localSess, remoteID, remoteSess) {
            molo_client_app_1.newSessionPair(localID, localSess, remoteID, remoteSess);
        });
        remote.sockConnect();
    };
    return MolohubClient;
}(events_1.EventEmitter));
exports.MolohubClient = MolohubClient;
