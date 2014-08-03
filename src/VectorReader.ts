/// <reference path="../typings/pixi/webgl.d.ts" />
/// <reference path="../typings/pixi/pixi.d.ts" />
/// <reference path="io.ts" />
/// <reference path="bitmapFont.ts" />

"use strict";

module VectorReader {
  import DiplayObjectContainer = PIXI.DisplayObjectContainer;
  import Sprite = PIXI.Sprite;
  import Texture = PIXI.Texture;
  import Graphics = PIXI.Graphics;

  import InputStream = io.InputStream;

  import CharInfo = bitmapFont.CharInfo;

  enum PixiCommand {
    MOVE_TO,
    LINE_TO,
    POLYLINE,
    POLYLINE2,

    LINE_STYLE_RGB,
    LINE_STYLE_RGBA,
    BEGIN_FILL_RGB,
    BEGIN_FILL_RGBA,
    END_FILL,

    DRAW_CIRCLE,
    DRAW_CIRCLE2,
    ROTATED_TEXT,
    TEXT,

    SYMBOL,
  }

  var STROKE_MIN_ZOOM_LEVEL = 12;
  var STROKE_INCREASE = 1.5;

  function drawText(input:InputStream, rotated:boolean, textContainer:DiplayObjectContainer, fontToChars:CharInfo[][]):void {
    var x = input.readTwipsAndConvert()
    var y = input.readTwipsAndConvert()
    if (rotated) {
      var rotation = input.readTwipsAndConvert()
      var textWidth = input.readTwipsAndConvert()
      var textHeight = input.readTwipsAndConvert()

      var wordContainer = new PIXI.DisplayObjectContainer()
      wordContainer.position.x = x
      wordContainer.position.y = y
      wordContainer.rotation = rotation
      x = -textWidth / 2
      y = -(textHeight - textHeight / 3)
      textContainer.addChild(wordContainer)
      textContainer = wordContainer
    }

    var charsInfo = fontToChars[input.readUnsignedByte()]
    var prevCharIndex = -1
    var n = input.readUnsignedVarInt()
    do {
      var charIndex = input.readUnsignedVarInt()
      if (charIndex == 0) {
        console.warn("missed char on server")
        continue
      }
      else {
        charIndex--
      }

      var charInfo = charsInfo[charIndex]
      if (charInfo == null) {
        console.warn("missed char: " + charIndex)
        continue
      }

      if (prevCharIndex !== -1) {
        var kerning = charInfo.kernings[charIndex]
        if (kerning !== undefined) {
          x += kerning;
        }
      }

      var charSprite = new Sprite(charInfo.texture)
      charSprite.position.x = x + charInfo.xOffset
      charSprite.position.y = y + charInfo.yOffset
      textContainer.addChild(charSprite)

      x += charInfo.xAdvance
      prevCharIndex = charIndex
    }
    while (--n > 0)
  }

  function drawPolyline(dataView, g):void {
    var moveToCount = dataView.readUnsignedVarInt()
    if (moveToCount < 1) {
      throw new Error("polyline segment count must be greater than 0")
    }

    var prevX = 0
    var prevY = 0
    do {
      var x = dataView.readTwipsAndConvert() + prevX
      var y = dataView.readTwipsAndConvert() + prevY
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
      }
      while (--n > 0);
    }
    while (--moveToCount > 0);
  }

  export function draw(tileData:ArrayBuffer, g:Graphics, textContainer:DiplayObjectContainer, zoomLevel:number, textures:Texture[], fontToChars:CharInfo[][]) {
    var input = new InputStream(new DataView(tileData));
    var zoomLevelDiff = Math.max(zoomLevel - STROKE_MIN_ZOOM_LEVEL, 0);
    var strokeScaleFactor = Math.pow(STROKE_INCREASE, zoomLevelDiff);
    do {
      var command = input.readUnsignedByte();
      switch (command) {
        case PixiCommand.LINE_TO:
          g.lineTo(input.readTwipsAndConvert(), input.readTwipsAndConvert());
          break;

        case PixiCommand.MOVE_TO:
          g.moveTo(input.readTwipsAndConvert(), input.readTwipsAndConvert());
          break;

        case PixiCommand.POLYLINE:
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
          }
          while (--n > 0);
          break;

        case PixiCommand.POLYLINE2:
          drawPolyline(input, g);
          break;

        case PixiCommand.LINE_STYLE_RGB:
          g.lineStyle(input.readTwipsAndConvert() * strokeScaleFactor, input.readRgb(), 1);
          break;

        case PixiCommand.LINE_STYLE_RGBA:
          g.lineStyle(input.readTwipsAndConvert() * strokeScaleFactor, input.readRgb(), input.readUnsignedByte() / 255);
          break;

        case PixiCommand.DRAW_CIRCLE:
          // todo scale radius
          g.drawCircle(input.readSignedVarInt(), input.readSignedVarInt(), input.readSignedVarInt());
          break;

        case PixiCommand.DRAW_CIRCLE2:
          // todo scale radius
          g.drawCircle(input.readTwipsAndConvert(), input.readTwipsAndConvert(), input.readTwipsAndConvert());
          break;

        case PixiCommand.BEGIN_FILL_RGB:
          g.beginFill(input.readRgb(), 1);
          break;

        case PixiCommand.BEGIN_FILL_RGBA:
          g.beginFill(input.readRgb(), input.readUnsignedByte() / 255);
          break;

        case PixiCommand.END_FILL:
          g.endFill();
          break;

        case PixiCommand.ROTATED_TEXT:
          drawText(input, true, textContainer, fontToChars);
          break;

        case PixiCommand.TEXT:
          drawText(input, false, textContainer, fontToChars);
          break;

        case PixiCommand.SYMBOL:
          var textureId = input.readUnsignedVarInt();
          var x = input.readTwipsAndConvert();
          var y = input.readTwipsAndConvert();
          //noinspection JSUnusedLocalSymbols
          var rotation = input.readTwipsAndConvert();

          var symbol = new Sprite(textures[textureId]);
          //console.log(symbol, x, y, rotation);
          symbol.x = x;
          symbol.y = y;

          textContainer.addChild(symbol);
          break;

        default:
          throw new Error("unknown command: " + command);
      }
    }
    while (input.cursor < input.length);
  }
}