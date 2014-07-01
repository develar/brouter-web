"use strict";
var DiplayObjectContainer = PIXI.DisplayObjectContainer;
var Sprite = PIXI.Sprite;

var VectorReader;
(function (VectorReader) {
    var PixiCommand;
    (function (PixiCommand) {
        PixiCommand[PixiCommand["MOVE_TO"] = 0] = "MOVE_TO";
        PixiCommand[PixiCommand["LINE_TO"] = 1] = "LINE_TO";
        PixiCommand[PixiCommand["POLYLINE"] = 2] = "POLYLINE";
        PixiCommand[PixiCommand["POLYLINE2"] = 3] = "POLYLINE2";

        PixiCommand[PixiCommand["LINE_STYLE_RGB"] = 4] = "LINE_STYLE_RGB";
        PixiCommand[PixiCommand["LINE_STYLE_RGBA"] = 5] = "LINE_STYLE_RGBA";
        PixiCommand[PixiCommand["BEGIN_FILL_RGB"] = 6] = "BEGIN_FILL_RGB";
        PixiCommand[PixiCommand["BEGIN_FILL_RGBA"] = 7] = "BEGIN_FILL_RGBA";
        PixiCommand[PixiCommand["END_FILL"] = 8] = "END_FILL";

        PixiCommand[PixiCommand["DRAW_CIRCLE"] = 9] = "DRAW_CIRCLE";
        PixiCommand[PixiCommand["DRAW_CIRCLE2"] = 10] = "DRAW_CIRCLE2";
        PixiCommand[PixiCommand["ROTATED_TEXT"] = 11] = "ROTATED_TEXT";
        PixiCommand[PixiCommand["TEXT"] = 12] = "TEXT";
    })(PixiCommand || (PixiCommand = {}));

    var STROKE_MIN_ZOOM_LEVEL = 12;
    var STROKE_INCREASE = 1.5;

    var MyDataView = (function () {
        function MyDataView(dataView) {
            this.dataView = dataView;
            this.cursor = 0;
            this.length = this.dataView.byteLength;
        }
        MyDataView.prototype.readUnsignedByte = function () {
            return this.dataView.getUint8(this.cursor++);
        };

        MyDataView.prototype.getUnsignedByte = function (offset) {
            return this.dataView.getUint8(offset);
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
            var v = this.readUnsighedVarInt();
            return ((v >>> 1) ^ -(v & 1)) | 0;
        };

        MyDataView.prototype.readUnsighedVarInt = function () {
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

    function drawText(dataView, rotated, charsInfo, textContainer) {
        var x = dataView.readTwipsAndConvert();
        var y = dataView.readTwipsAndConvert();
        if (rotated) {
            var theta = dataView.readTwipsAndConvert();
            var x1 = dataView.readTwipsAndConvert();
            var y1 = dataView.readTwipsAndConvert();

            var wordContainer = new PIXI.DisplayObjectContainer();
            wordContainer.x = x;
            wordContainer.y = y;
            wordContainer.rotation = theta;

            x = 0;
            y = 0;
            textContainer.addChild(wordContainer);
            textContainer = wordContainer;
        }

        var n = dataView.readUnsighedVarInt();
        var prevCharCode = -1;
        var count = 0;
        while (count < n) {
            var charCode = dataView.readUnsignedByte();
            if (charCode <= 127) {
                count++;
            } else {
                switch (charCode >> 4) {
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                        count++;
                        break;

                    case 12:
                    case 13:
                        count += 2;
                        if (count > n) {
                            throw new Error("malformed input: partial character at end");
                        }

                        var char2 = dataView.readUnsignedByte();
                        if ((char2 & 0xC0) != 0x80) {
                            throw new Error("malformed input around byte " + count);
                        }
                        charCode = ((charCode & 0x1F) << 6) | (char2 & 0x3F);
                        break;

                    case 14:
                        count += 3;
                        if (count > n) {
                            throw new Error("malformed input: partial character at end");
                        }

                        var char2 = dataView.readUnsignedByte();
                        var char3 = dataView.readUnsignedByte();
                        if (((char2 & 0xC0) != 0x80) || ((char3 & 0xC0) != 0x80)) {
                            throw new Error("malformed input around byte " + (count - 1));
                        }
                        charCode = ((charCode & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0);
                        break;

                    default:
                        throw new Error("malformed input around byte " + count);
                }
            }

            var charData = charsInfo[charCode];
            if (charData == null) {
                console.warn("missed char: " + charCode);
                continue;
            }

            if (prevCharCode !== -1 && charData[prevCharCode] != null) {
                x += charData.kerning[prevCharCode];
            }

            var charSprite = new Sprite(charData.texture);
            charSprite.position.x = x + charData.xOffset;
            charSprite.position.y = y + charData.yOffset;
            textContainer.addChild(charSprite);

            x += charData.xAdvance;
            prevCharCode = charCode;
        }
    }

    function drawPolyline(dataView, g) {
        var moveToCount = dataView.readUnsighedVarInt();
        if (moveToCount < 1) {
            throw new Error("polyline segment count must be greater than 0");
        }

        var prevX = 0;
        var prevY = 0;
        do {
            var x = dataView.readTwipsAndConvert() + prevX;
            var y = dataView.readTwipsAndConvert() + prevY;
            g.moveTo(x, y);
            prevX = x;
            prevY = y;

            var n = dataView.readUnsighedVarInt();
            if (n <= 0) {
                throw new Error("polyline segment count must be greater than 0");
            }

            do {
                var x = dataView.readTwipsAndConvert() + prevX;
                var y = dataView.readTwipsAndConvert() + prevY;
                g.lineTo(x, y);
                prevX = x;
                prevY = y;
            } while(--n > 0);
        } while(--moveToCount > 0);
    }

    function draw(tileData, g, textContainer, zoomLevel) {
        var dataView = new MyDataView(new DataView(tileData));
        var data = PIXI.BitmapText.fonts["Avenir Next"];
        var charsInfo = data.chars;

        var zoomLevelDiff = Math.max(zoomLevel - STROKE_MIN_ZOOM_LEVEL, 0);
        var strokeScaleFactor = Math.pow(STROKE_INCREASE, zoomLevelDiff);
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

                    var prevX = 0;
                    var prevY = 0;
                    do {
                        var x = dataView.readTwipsAndConvert() + prevX;
                        var y = dataView.readTwipsAndConvert() + prevY;
                        g.lineTo(x, y);
                        prevX = x;
                        prevY = y;
                    } while(--n > 0);
                    break;

                case 3 /* POLYLINE2 */:
                    drawPolyline(dataView, g);
                    break;

                case 4 /* LINE_STYLE_RGB */:
                    g.lineStyle(dataView.readTwipsAndConvert() * strokeScaleFactor, dataView.readRgb(), 1);
                    break;

                case 5 /* LINE_STYLE_RGBA */:
                    g.lineStyle(dataView.readTwipsAndConvert() * strokeScaleFactor, dataView.readRgb(), dataView.readUnsignedByte() / 255);
                    break;

                case 9 /* DRAW_CIRCLE */:
                    g.drawCircle(dataView.readSignedVarInt(), dataView.readSignedVarInt(), dataView.readSignedVarInt());
                    break;

                case 10 /* DRAW_CIRCLE2 */:
                    g.drawCircle(dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert());
                    break;

                case 6 /* BEGIN_FILL_RGB */:
                    g.beginFill(dataView.readRgb(), 1);
                    break;

                case 7 /* BEGIN_FILL_RGBA */:
                    g.beginFill(dataView.readRgb(), dataView.readUnsignedByte() / 255);
                    break;

                case 8 /* END_FILL */:
                    g.endFill();
                    break;

                case 11 /* ROTATED_TEXT */:
                    drawText(dataView, true, charsInfo, textContainer);
                    break;

                case 12 /* TEXT */:
                    drawText(dataView, false, charsInfo, textContainer);
                    break;

                default:
                    throw new Error("unknown command: " + command);
            }
        } while(dataView.cursor < dataView.length);
    }
    VectorReader.draw = draw;
})(VectorReader || (VectorReader = {}));
