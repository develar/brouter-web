"use strict";
var bitmapFont;
(function (bitmapFont) {
    var InputStream = io.InputStream;
    var Texture = PIXI.Texture;

    var Rectangle = PIXI.Rectangle;

    var EMPTY_ARRAY = [];

    var CharInfo = (function () {
        function CharInfo(xOffset, yOffset, xAdvance, kernings, texture) {
            this.xOffset = xOffset;
            this.yOffset = yOffset;
            this.xAdvance = xAdvance;
            this.kernings = kernings;
            this.texture = texture;
        }
        return CharInfo;
    })();
    bitmapFont.CharInfo = CharInfo;

    function loadFonts(name, loaded) {
        var baseTexture = Texture.fromImage(name).baseTexture;
        io.loadData(name + ".info", function (result) {
            var dataView = new InputStream(new DataView(result));
            var n = dataView.readUnsignedVarInt();
            var fonts = new Array(n);
            for (var i = 0; i < n; i++) {
                fonts[i] = readChars(dataView, baseTexture);
            }
            io.callOrWaitTexture(baseTexture, fonts, loaded);
        });
    }
    bitmapFont.loadFonts = loadFonts;

    function readChars(input, baseTexture) {
        var n = input.readUnsignedVarInt();
        var chars = new Array(n);
        var prevX = 0;
        var prevY = 0;
        for (var i = 0; i < n; i++) {
            var xOffset = input.readByte();
            var yOffset = input.readByte();
            var xAdvance = input.readByte();

            var x = prevX + input.readSignedVarInt();
            var y = prevY + input.readSignedVarInt();
            var texture = new Texture(baseTexture, new Rectangle(x, y, input.readUnsignedByte(), input.readUnsignedByte()));
            prevX = x;
            prevY = y;

            chars[i] = new CharInfo(xOffset, yOffset, xAdvance, readKernings(input), texture);
        }
        return chars;
    }

    function readKernings(input) {
        var n = input.readUnsignedVarInt();
        if (n == 0) {
            return EMPTY_ARRAY;
        }

        var kernings = [];
        var prevCharIndex = 0;
        do {
            var charIndex = prevCharIndex + input.readUnsignedVarInt();
            kernings[charIndex] = input.readByte();
            prevCharIndex = charIndex;
        } while(--n > 0);

        return kernings;
    }
})(bitmapFont || (bitmapFont = {}));
