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
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var molo_client_app_1 = require("./molo_client_app");
var local_session_1 = require("./local_session");
var molo_socket_1 = require("./lib/molo_socket");
var RemoteSession = /** @class */ (function (_super) {
    __extends(RemoteSession, _super);
    function RemoteSession(clientid, rhost, rport, lhost, lport) {
        var _this = _super.call(this) || this;
        _this._id = molo_client_app_1.genUniqueId();
        _this.clientid = clientid;
        _this.rhost = rhost;
        _this.rport = rport;
        _this.lhost = lhost;
        _this.lport = lport;
        return _this;
    }
    RemoteSession.prototype.sendRaw = function (rawData) {
        if (this.client)
            this.client.sendRaw(rawData);
    };
    RemoteSession.prototype.onDisconnect = function () {
        var localSession = molo_client_app_1.remoteID2LocalSess(this._id);
        if (localSession) {
            localSession.sockClose();
            molo_client_app_1.breakSessionPair(this._id);
        }
    };
    RemoteSession.prototype.sockConnect = function () {
        var _this = this;
        this.client = new molo_socket_1.MoloSocket(this.rhost, this.rport, "RemoteSession");
        this.client.connect();
        this.client.on("connect", function () {
            var bodyData = {};
            bodyData['Type'] = 'RegProxy';
            bodyData['Payload'] = {};
            bodyData['Payload']['ClientId'] = _this.clientid;
            if (_this.client)
                _this.client.send(bodyData);
        });
        this.client.on("data", function (data, rawData) {
            if (data) {
                _this.processJsonPack(data, rawData);
            }
            else {
                _this.processTransparencyPack(rawData);
            }
        });
        this.client.on("end", this.onDisconnect.bind(this));
        this.client.on("error", function () {
            console.log('remote sesion sock error!!');
            _this.onDisconnect();
        });
    };
    RemoteSession.prototype.sockClose = function () {
        if (this.client) {
            this.client.destroy();
            this.client = undefined;
        }
    };
    RemoteSession.prototype.processJsonPack = function (jdata, leftData) {
        console.log('remote session processJsonPack: ' + JSON.stringify(jdata));
        var protocolType = jdata['Type'];
        if (protocolType == 'StartProxy')
            this.onStartProxy(leftData);
    };
    RemoteSession.prototype.onStartProxy = function (rawData) {
        var _this = this;
        var local = new local_session_1.LocalSession(this.lhost, this.lport);
        local.on("connect", function (localID, localSess) {
            if (_this.client) {
                _this.client.setTransparency(true);
            }
            _this.emit("add", localID, localSess, _this._id, _this);
            _this.processTransparencyPack(rawData);
        });
        local.sockConnect();
    };
    RemoteSession.prototype.processTransparencyPack = function (buf) {
        var localSession = molo_client_app_1.remoteID2LocalSess(this._id);
        if (!localSession) {
            console.log('processTransparencyPack() localsession session not found');
            this.sockClose();
            return;
        }
        localSession.sendRaw(buf);
    };
    RemoteSession.prototype.dumpInfo = function () {
        if (this.client)
            return "RemoteSession(" + this._id + "): TransMode(" + this.client.getTransparency() + ")";
    };
    Object.defineProperty(RemoteSession.prototype, "id", {
        get: function () {
            return this._id;
        },
        enumerable: true,
        configurable: true
    });
    return RemoteSession;
}(events_1.EventEmitter));
exports.RemoteSession = RemoteSession;
