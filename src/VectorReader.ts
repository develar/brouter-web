/// <reference path="../typings/pixi/webgl.d.ts" />
/// <reference path="../typings/pixi/pixi.d.ts" />

"use strict";

import DiplayObjectContainer = PIXI.DisplayObjectContainer;
import Sprite = PIXI.Sprite;
import Texture = PIXI.Texture;

module VectorReader {
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

  class MyDataView {
    public cursor = 0;
    //noinspection ThisExpressionReferencesGlobalObjectJS
    public length = this.dataView.byteLength;

    constructor(private dataView:DataView) {
    }

    readUnsignedByte():number {
      return this.dataView.getUint8(this.cursor++);
    }

    // twips
    readTwipsAndConvert():number {
      return this.readSignedVarInt() / 20;
    }

    readSignedVarInt():number {
      var v = this.readUnsighedVarInt();
      return ((v >>> 1) ^ -(v & 1)) | 0;
    }

    readUnsighedVarInt():number {
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
    }

    readUnsighedShort():number {
      var r = this.dataView.getUint16(this.cursor);
      this.cursor += 2;
      return r;
    }

    readRgb():number {
      return (this.readUnsignedByte() << 16) + (this.readUnsignedByte() << 8) + (this.readUnsignedByte() << 0);
    }
  }

  export function loadData(url:string, loaded:(result:ArrayBuffer)=>void) {
    var request = new XMLHttpRequest();
    request.responseType = 'arraybuffer';
    request.onload = function (event) {
      loaded((<XMLHttpRequest>event.target).response);
    };
    request.open("get", url);
    request.send();
  }

  export function loadTextureAtlas(name:string, loaded:(textures:Texture[])=>void):void {
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
      }
      else {
        baseTexture.addEventListener('loaded', function () {
          loaded(textures);
        });
      }
    });
  }

  function readCharCode(dataView) {
    var char1 = dataView.readUnsignedByte();
    if (char1 <= 127) {
      return char1;
    }
    else {
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

  function drawText(dataView, rotated:boolean, charsInfo:Array<PIXI.CharInfo>, textContainer:DiplayObjectContainer):void {
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
      var charInfo = charsInfo[charCode];
      if (charInfo == null) {
        console.warn("missed char: " + charCode);
        continue;
      }

      if (prevCharCode !== -1) {
        x += charInfo.kerning[prevCharCode];
      }

      var charSprite = new Sprite(charInfo.texture);
      charSprite.position.x = x + charInfo.xOffset;
      charSprite.position.y = y + charInfo.yOffset;
      textContainer.addChild(charSprite);

      x += charInfo.xAdvance;
      prevCharCode = charCode;
    }
    while (--n > 0);
  }

  function drawPolyline(dataView, g):void {
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
      }
      while (--n > 0);
    }
    while (--moveToCount > 0);
  }

  export function draw(tileData:ArrayBuffer, g:PIXI.Graphics, textContainer:DiplayObjectContainer, zoomLevel:number, textures:Texture[]) {
    var dataView = new MyDataView(new DataView(tileData));
    var data = PIXI.BitmapText.fonts["Avenir Next"];
    var charsInfo = data.chars;

    var zoomLevelDiff = Math.max(zoomLevel - STROKE_MIN_ZOOM_LEVEL, 0);
    var strokeScaleFactor = Math.pow(STROKE_INCREASE, zoomLevelDiff);
    do {
      var command = dataView.readUnsignedByte();
      switch (command) {
        case PixiCommand.LINE_TO:
          g.lineTo(dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert());
          break;

        case PixiCommand.MOVE_TO:
          g.moveTo(dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert());
          break;

        case PixiCommand.POLYLINE:
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
          }
          while (--n > 0);
          break;

        case PixiCommand.POLYLINE2:
          drawPolyline(dataView, g);
          break;

        case PixiCommand.LINE_STYLE_RGB:
          g.lineStyle(dataView.readTwipsAndConvert() * strokeScaleFactor, dataView.readRgb(), 1);
          break;

        case PixiCommand.LINE_STYLE_RGBA:
          g.lineStyle(dataView.readTwipsAndConvert() * strokeScaleFactor, dataView.readRgb(), dataView.readUnsignedByte() / 255);
          break;

        case PixiCommand.DRAW_CIRCLE:
          // todo scale radius
          g.drawCircle(dataView.readSignedVarInt(), dataView.readSignedVarInt(), dataView.readSignedVarInt());
          break;

        case PixiCommand.DRAW_CIRCLE2:
          // todo scale radius
          g.drawCircle(dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert(), dataView.readTwipsAndConvert());
          break;

        case PixiCommand.BEGIN_FILL_RGB:
          g.beginFill(dataView.readRgb(), 1);
          break;

        case PixiCommand.BEGIN_FILL_RGBA:
          g.beginFill(dataView.readRgb(), dataView.readUnsignedByte() / 255);
          break;

        case PixiCommand.END_FILL:
          g.endFill();
          break;

        case PixiCommand.ROTATED_TEXT:
          drawText(dataView, true, charsInfo, textContainer);
          break;

        case PixiCommand.TEXT:
          drawText(dataView, false, charsInfo, textContainer);
          break;

        case PixiCommand.SYMBOL:
          var textureId = dataView.readUnsighedVarInt();
          var x = dataView.readTwipsAndConvert();
          var y = dataView.readTwipsAndConvert();
          var rotation = dataView.readTwipsAndConvert();

          var symbol = new Sprite(textures[textureId]);
//          console.log(symbol, x, y, rotation);
          symbol.x = x;
          symbol.y = y;

          textContainer.addChild(symbol);
          break;

        default:
          throw new Error("unknown command: " + command);
      }
    }
    while (dataView.cursor < dataView.length);
  }
}