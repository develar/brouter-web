/// <reference path="../typings/pixi/webgl.d.ts" />
/// <reference path="../typings/pixi/pixi.d.ts" />

"use strict";

import DiplayObjectContainer = PIXI.DisplayObjectContainer;
import Sprite = PIXI.Sprite;

module VectorReader {
  enum PixiCommand {
    MOVE_TO, LINE_TO, POLYLINE, POLYLINE2,

    LINE_STYLE_RGB, LINE_STYLE_RGBA,
    BEGIN_FILL_RGB, BEGIN_FILL_RGBA,
    END_FILL,

    DRAW_CIRCLE,
    ROTATED_TEXT,
    TEXT,
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

    getUnsignedByte(offset:number):number {
      return this.dataView.getUint8(offset);
    }

    readShort():number {
      var r = this.dataView.getInt16(this.cursor);
      this.cursor += 2;
      return r;
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

    readUint():number {
      var r = this.dataView.getUint32(this.cursor);
      this.cursor += 4;
      return r;
    }

    readFloat():number {
      var r = this.dataView.getFloat32(this.cursor);
      this.cursor += 4;
      return r;
    }

    readRgb():number {
      return (this.readUnsignedByte() << 16) + (this.readUnsignedByte() << 8) + (this.readUnsignedByte() << 0);
    }
  }

  function drawText(dataView, rotated:boolean, charsInfo:Array<PIXI.CharInfo>, textContainer:DiplayObjectContainer):void {
    var x = dataView.readTwipsAndConvert();
    var y = dataView.readTwipsAndConvert();
    if (rotated) {
      dataView.readTwipsAndConvert();
      dataView.readTwipsAndConvert();
    }

    var n = dataView.readUnsighedVarInt();
    var prevCharCode = -1;
    var count = 0;
    while (count < n) {
      var charCode = dataView.readUnsignedByte();
      if (charCode <= 127) {
        count++;
      }
      else {
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

  export function draw(tileData:ArrayBuffer, g:PIXI.Graphics, textContainer:DiplayObjectContainer, zoomLevel:number) {
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
          var prevX = dataView.readTwipsAndConvert();
          var prevY = dataView.readTwipsAndConvert();
          g.moveTo(prevX, prevY);

          var n = dataView.readUnsighedVarInt();
          if (n <= 0) {
            throw new Error("polyline segement count must be greater than 0");
          }

          do {
            var x = dataView.readTwipsAndConvert() + prevX;
            var y = dataView.readTwipsAndConvert() + prevY;
            g.lineTo(x, y);
            prevX = x;
            prevY = y;
          }
          while (--n > 0);
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

        default:
          throw new Error("unknown command: " + command);
      }
    }
    while (dataView.cursor < dataView.length);
  }
}