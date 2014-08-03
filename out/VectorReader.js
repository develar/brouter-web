"use strict";
var VectorReader;
(function (VectorReader) {
    var Sprite = PIXI.Sprite;

    var InputStream = io.InputStream;

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

    function drawText(input, rotated, textContainer, fontToChars) {
        var x = input.readTwipsAndConvert();
        var y = input.readTwipsAndConvert();
        if (rotated) {
            var rotation = input.readTwipsAndConvert();
            var textWidth = input.readTwipsAndConvert();
            var textHeight = input.readTwipsAndConvert();

            var wordContainer = new PIXI.DisplayObjectContainer();
            wordContainer.position.x = x;
            wordContainer.position.y = y;
            wordContainer.rotation = rotation;
            x = -textWidth / 2;
            y = -(textHeight - textHeight / 3);
            textContainer.addChild(wordContainer);
            textContainer = wordContainer;
        }

        var charsInfo = fontToChars[input.readUnsignedByte()];
        var prevCharIndex = -1;
        var n = input.readUnsignedVarInt();
        do {
            var charIndex = input.readUnsignedVarInt();
            if (charIndex == 0) {
                console.warn("missed char on server");
                continue;
            } else {
                charIndex--;
            }

            var charInfo = charsInfo[charIndex];
            if (charInfo == null) {
                console.warn("missed char: " + charIndex);
                continue;
            }

            if (prevCharIndex !== -1) {
                var kerning = charInfo.kernings[charIndex];
                if (kerning !== undefined) {
                    x += kerning;
                }
            }

            var charSprite = new Sprite(charInfo.texture);
            charSprite.position.x = x + charInfo.xOffset;
            charSprite.position.y = y + charInfo.yOffset;
            textContainer.addChild(charSprite);

            x += charInfo.xAdvance;
            prevCharIndex = charIndex;
        } while(--n > 0);
    }

    function drawPolyline(dataView, g) {
        var moveToCount = dataView.readUnsignedVarInt();
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

            var n = dataView.readUnsignedVarInt();
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

    function draw(tileData, g, textContainer, zoomLevel, textures, fontToChars) {
        var input = new InputStream(new DataView(tileData));
        var zoomLevelDiff = Math.max(zoomLevel - STROKE_MIN_ZOOM_LEVEL, 0);
        var strokeScaleFactor = Math.pow(STROKE_INCREASE, zoomLevelDiff);
        do {
            var command = input.readUnsignedByte();
            switch (command) {
                case 1 /* LINE_TO */:
                    g.lineTo(input.readTwipsAndConvert(), input.readTwipsAndConvert());
                    break;

                case 0 /* MOVE_TO */:
                    g.moveTo(input.readTwipsAndConvert(), input.readTwipsAndConvert());
                    break;

                case 2 /* POLYLINE */:
                    var n = input.readUnsighedShort();
                    if (n <= 0) {
                        throw new Error("polyline segement count must be greater than 0");
                    }

                    var prevX = 0;
                    var prevY = 0;
                    do {
                        var x = input.readTwipsAndConvert() + prevX;
                        var y = input.readTwipsAndConvert() + prevY;
                        g.lineTo(x, y);
                        prevX = x;
                        prevY = y;
                    } while(--n > 0);
                    break;

                case 3 /* POLYLINE2 */:
                    drawPolyline(input, g);
                    break;

                case 4 /* LINE_STYLE_RGB */:
                    g.lineStyle(input.readTwipsAndConvert() * strokeScaleFactor, input.readRgb(), 1);
                    break;

                case 5 /* LINE_STYLE_RGBA */:
                    g.lineStyle(input.readTwipsAndConvert() * strokeScaleFactor, input.readRgb(), input.readUnsignedByte() / 255);
                    break;

                case 9 /* DRAW_CIRCLE */:
                    g.drawCircle(input.readSignedVarInt(), input.readSignedVarInt(), input.readSignedVarInt());
                    break;

                case 10 /* DRAW_CIRCLE2 */:
                    g.drawCircle(input.readTwipsAndConvert(), input.readTwipsAndConvert(), input.readTwipsAndConvert());
                    break;

                case 6 /* BEGIN_FILL_RGB */:
                    g.beginFill(input.readRgb(), 1);
                    break;

                case 7 /* BEGIN_FILL_RGBA */:
                    g.beginFill(input.readRgb(), input.readUnsignedByte() / 255);
                    break;

                case 8 /* END_FILL */:
                    g.endFill();
                    break;

                case 11 /* ROTATED_TEXT */:
                    drawText(input, true, textContainer, fontToChars);
                    break;

                case 12 /* TEXT */:
                    drawText(input, false, textContainer, fontToChars);
                    break;

                case 13 /* SYMBOL */:
                    var textureId = input.readUnsignedVarInt();
                    var x = input.readTwipsAndConvert();
                    var y = input.readTwipsAndConvert();

                    var rotation = input.readTwipsAndConvert();

                    var symbol = new Sprite(textures[textureId]);

                    symbol.x = x;
                    symbol.y = y;

                    textContainer.addChild(symbol);
                    break;

                default:
                    throw new Error("unknown command: " + command);
            }
        } while(input.cursor < input.length);
    }
    VectorReader.draw = draw;
})(VectorReader || (VectorReader = {}));
