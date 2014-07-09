"use strict";
var DiplayObjectContainer = PIXI.DisplayObjectContainer;
var Sprite = PIXI.Sprite;
var Texture = PIXI.Texture;

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

        PixiCommand[PixiCommand["SYMBOL"] = 13] = "SYMBOL";
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

        MyDataView.prototype.readRgb = function () {
            return (this.readUnsignedByte() << 16) + (this.readUnsignedByte() << 8) + (this.readUnsignedByte() << 0);
        };
        return MyDataView;
    })();

    function loadData(url, loaded) {
        var request = new XMLHttpRequest();
        request.responseType = 'arraybuffer';
        request.onload = function (event) {
            loaded(event.target.response);
        };
        request.open("get", url);
        request.send();
    }
    VectorReader.loadData = loadData;

    function loadTextureAtlas(name, loaded) {
        var baseTexture = Texture.fromImage(name + ".png").baseTexture;
        loadData(name + ".atl", function (result) {
            var dataView = new MyDataView(new DataView(result));
            var n = dataView.readUnsighedVarInt();
            var textures = new Array(n);
            for (var i = 0; i < n; i++) {
                textures[i] = new Texture(baseTexture, new PIXI.Rectangle(dataView.readUnsighedVarInt(), dataView.readUnsighedVarInt(), dataView.readUnsighedVarInt(), dataView.readUnsighedVarInt()));
            }

            if (baseTexture.hasLoaded) {
                loaded(textures);
            } else {
                baseTexture.addEventListener('loaded', function () {
                    loaded(textures);
                });
            }
        });
    }
    VectorReader.loadTextureAtlas = loadTextureAtlas;

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

    function drawText(dataView, rotated, charsInfo, textContainer) {
        var x = dataView.readTwipsAndConvert();
        var y = dataView.readTwipsAndConvert();
        if (rotated) {
            var rotation = dataView.readTwipsAndConvert();
            var textWidth = dataView.readTwipsAndConvert();
            var textHeight = dataView.readTwipsAndConvert();

            var wordContainer = new PIXI.DisplayObjectContainer();
            wordContainer.position.x = x;
            wordContainer.position.y = y;
            wordContainer.rotation = rotation;
            x = -textWidth / 2;
            y = -(textHeight - textHeight / 3);
            textContainer.addChild(wordContainer);
            textContainer = wordContainer;
        }

        var n = dataView.readUnsighedVarInt();
        var prevCharCode = -1;
        do {
            var charCode = readCharCode(dataView);
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
        } while(--n > 0);
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

    function draw(tileData, g, textContainer, zoomLevel, textures) {
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

                case 13 /* SYMBOL */:
                    var textureId = dataView.readUnsighedVarInt();
                    var x = dataView.readTwipsAndConvert();
                    var y = dataView.readTwipsAndConvert();
                    var rotation = dataView.readTwipsAndConvert();

                    var symbol = new Sprite(textures[textureId]);

                    symbol.x = x;
                    symbol.y = y;

                    textContainer.addChild(symbol);
                    break;

                default:
                    throw new Error("unknown command: " + command);
            }
        } while(dataView.cursor < dataView.length);
    }
    VectorReader.draw = draw;
})(VectorReader || (VectorReader = {}));
