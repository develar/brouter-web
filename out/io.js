"use strict";
var io;
(function (io) {
    var Texture = PIXI.Texture;
    var Rectangle = PIXI.Rectangle;

    var InputStream = (function () {
        function InputStream(dataView) {
            this.dataView = dataView;
            this.cursor = 0;
            this.length = this.dataView.byteLength;
        }
        InputStream.prototype.readUnsignedByte = function () {
            return this.dataView.getUint8(this.cursor++);
        };

        InputStream.prototype.readByte = function () {
            return this.dataView.getInt8(this.cursor++);
        };

        InputStream.prototype.readTwipsAndConvert = function () {
            return this.readSignedVarInt() / 20;
        };

        InputStream.prototype.readSignedVarInt = function () {
            var v = this.readUnsignedVarInt();
            return ((v >>> 1) ^ -(v & 1)) | 0;
        };

        InputStream.prototype.readUnsignedVarInt = function () {
            var b = this.readUnsignedByte();
            if (b < 128) {
                return b;
            }

            var value = (b & 0x7F) << 7;
            if ((b = this.readUnsignedByte()) < 128) {
                return value | b;
            }

            value = (value | (b & 0x7F)) << 7;
            if ((b = this.readUnsignedByte()) < 128) {
                return value | b;
            }

            return ((value | (b & 0x7F)) << 8) | this.readUnsignedByte();
        };

        InputStream.prototype.readUnsighedShort = function () {
            var r = this.dataView.getUint16(this.cursor);
            this.cursor += 2;
            return r;
        };

        InputStream.prototype.readRgb = function () {
            return (this.readUnsignedByte() << 16) + (this.readUnsignedByte() << 8) + (this.readUnsignedByte() << 0);
        };
        return InputStream;
    })();
    io.InputStream = InputStream;

    function loadData(url, loaded) {
        var request = new XMLHttpRequest();
        request.responseType = 'arraybuffer';
        request.onload = function (event) {
            var request = event.target;
            if (request.status === 200 || request.status === 0) {
                loaded(request.response);
            } else {
                throw new Error(request.responseText);
            }
        };
        request.open("get", url);
        request.send();
    }
    io.loadData = loadData;

    function callOrWaitTexture(baseTexture, result, callback) {
        if (baseTexture.hasLoaded) {
            callback(result);
        } else {
            baseTexture.addEventListener('loaded', function () {
                callback(result);
            });
        }
    }
    io.callOrWaitTexture = callOrWaitTexture;

    function loadTextureAtlas(name, loaded) {
        var baseTexture = Texture.fromImage(name).baseTexture;
        loadData(name + ".atl", function (result) {
            var dataView = new InputStream(new DataView(result));
            var n = dataView.readUnsignedVarInt();
            var textures = new Array(n);
            for (var i = 0; i < n; i++) {
                textures[i] = new Texture(baseTexture, new Rectangle(dataView.readUnsignedVarInt(), dataView.readUnsignedVarInt(), dataView.readUnsignedVarInt(), dataView.readUnsignedVarInt()));
            }
            callOrWaitTexture(baseTexture, textures, loaded);
        });
    }
    io.loadTextureAtlas = loadTextureAtlas;

    function readCharCode(dataView) {
        var char1 = dataView.readUnsignedByte();
        if (char1 <= 127) {
            return char1;
        } else {
            switch (char1 >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    break;

                case 12:
                case 13:
                    if (dataView.cursor + 2 > dataView.length) {
                        throw new Error("malformed input: partial character at end");
                    }

                    var char2 = dataView.readUnsignedByte();
                    if ((char2 & 0xC0) != 0x80) {
                        throw new Error("malformed input around byte " + (dataView.cursor - 1));
                    }
                    return ((char1 & 0x1F) << 6) | (char2 & 0x3F);

                case 14:
                    if (dataView.cursor + 3 > dataView.length) {
                        throw new Error("malformed input: partial character at end");
                    }

                    var char2 = dataView.readUnsignedByte();
                    var char3 = dataView.readUnsignedByte();
                    if (((char2 & 0xC0) != 0x80) || ((char3 & 0xC0) != 0x80)) {
                        throw new Error("malformed input around byte " + (dataView.cursor - 2));
                    }
                    return ((char1 & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0);

                default:
                    throw new Error("malformed input around byte " + (dataView.cursor - 1));
            }
        }
    }
    io.readCharCode = readCharCode;
})(io || (io = {}));
