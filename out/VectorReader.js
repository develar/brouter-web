"use strict";
var VectorReader;
(function (VectorReader) {
    var PixiCommand;
    (function (PixiCommand) {
        PixiCommand[PixiCommand["MOVE_TO"] = 0] = "MOVE_TO";
        PixiCommand[PixiCommand["LINE_TO"] = 1] = "LINE_TO";
        PixiCommand[PixiCommand["POLYLINE"] = 2] = "POLYLINE";

        PixiCommand[PixiCommand["LINE_STYLE_RGB"] = 3] = "LINE_STYLE_RGB";
        PixiCommand[PixiCommand["LINE_STYLE_RGBA"] = 4] = "LINE_STYLE_RGBA";
        PixiCommand[PixiCommand["BEGIN_FILL_RGB"] = 5] = "BEGIN_FILL_RGB";
        PixiCommand[PixiCommand["BEGIN_FILL_RGBA"] = 6] = "BEGIN_FILL_RGBA";
        PixiCommand[PixiCommand["END_FILL"] = 7] = "END_FILL";

        PixiCommand[PixiCommand["DRAW_CIRCLE"] = 8] = "DRAW_CIRCLE";
    })(PixiCommand || (PixiCommand = {}));

    var MyDataView = (function () {
        function MyDataView(dataView) {
            this.dataView = dataView;
            this.cursor = 0;
            this.length = this.dataView.byteLength;
        }
        MyDataView.prototype.readUnsignedByte = function () {
            return this.dataView.getUint8(this.cursor++);
        };

        MyDataView.prototype.readShort = function () {
            var r = this.dataView.getInt16(this.cursor);
            this.cursor += 2;
            return r;
        };

        MyDataView.prototype.readTwipsAndConvert = function () {
            return this.readSignedVarInt() / 20;
        };

        MyDataView.prototype.readSignedVarInt = function () {
            var v = this.readUnsighedInt29();
            return ((v >>> 1) ^ -(v & 1)) | 0;
        };

        MyDataView.prototype.readUnsighedInt29 = function () {
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

        MyDataView.prototype.readUnsighedShort = function () {
            var r = this.dataView.getUint16(this.cursor);
            this.cursor += 2;
            return r;
        };

        MyDataView.prototype.readUint = function () {
            var r = this.dataView.getUint32(this.cursor);
            this.cursor += 4;
            return r;
        };

        MyDataView.prototype.readFloat = function () {
            var r = this.dataView.getFloat32(this.cursor);
            this.cursor += 4;
            return r;
        };

        MyDataView.prototype.readRgb = function () {
            return (this.readUnsignedByte() << 16) + (this.readUnsignedByte() << 8) + (this.readUnsignedByte() << 0);
        };
        return MyDataView;
    })();

    function draw(tileData, g) {
        var dataView = new MyDataView(new DataView(tileData));
        do {
            var command = dataView.readUnsignedByte();
            switch (command) {
                case 1 /* LINE_TO */:
                    g.lineTo(dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert());
                    break;

                case 0 /* MOVE_TO */:
                    g.moveTo(dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert());
                    break;

                case 2 /* POLYLINE */:
                    var n = dataView.readUnsighedShort();
                    if (n <= 0) {
                        throw new Error("polyline segement count must be greater than 0");
                    }

                    do {
                        g.lineTo(dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert());
                    } while(--n > 0);
                    break;

                case 3 /* LINE_STYLE_RGB */:
                    g.lineStyle(dataView.readTwipsAndConvert(), dataView.readRgb(), 1);
                    break;

                case 4 /* LINE_STYLE_RGBA */:
                    g.lineStyle(dataView.readTwipsAndConvert(), dataView.readRgb(), dataView.readUnsignedByte() / 255);
                    break;

                case 8 /* DRAW_CIRCLE */:
                    g.drawCircle(dataView.readUnsighedInt29(), dataView.readUnsighedInt29(), dataView.readUnsighedInt29());
                    break;

                case 5 /* BEGIN_FILL_RGB */:
                    g.beginFill(dataView.readRgb(), 1);
                    break;

                case 6 /* BEGIN_FILL_RGBA */:
                    g.beginFill(dataView.readRgb(), dataView.readUnsignedByte() / 255);
                    break;

                case 7 /* END_FILL */:
                    g.endFill();
                    break;

                default:
                    throw new Error("unknown command: " + command);
            }
        } while(dataView.cursor < dataView.length);
    }
    VectorReader.draw = draw;
})(VectorReader || (VectorReader = {}));
