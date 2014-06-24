/// <reference path="../typings/pixi/webgl.d.ts" />
/// <reference path="../typings/pixi/pixi.d.ts" />

"use strict";

module VectorReader {
  enum PixiCommand {
    MOVE_TO, LINE_TO, POLYLINE,

    LINE_STYLE_RGB, LINE_STYLE_RGBA,
    BEGIN_FILL_RGB, BEGIN_FILL_RGBA,
    END_FILL,

    DRAW_CIRCLE,
  }

  class MyDataView {
    public cursor = 0;
    //noinspection ThisExpressionReferencesGlobalObjectJS
    public length = this.dataView.byteLength;

    constructor(private dataView:DataView) {
    }

    readUnsignedByte():number {
      return this.dataView.getUint8(this.cursor++);
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

  export function draw(tileData:ArrayBuffer, g:PIXI.Graphics) {
    var dataView = new MyDataView(new DataView(tileData));
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

        case PixiCommand.LINE_STYLE_RGB:
          g.lineStyle(dataView.readTwipsAndConvert(), dataView.readRgb(), 1);
          break;

        case PixiCommand.LINE_STYLE_RGBA:
          g.lineStyle(dataView.readTwipsAndConvert(), dataView.readRgb(), dataView.readUnsignedByte() / 255);
          break;

        case PixiCommand.DRAW_CIRCLE:
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

        default:
          throw new Error("unknown command: " + command);
      }
    }
    while (dataView.cursor < dataView.length);
  }
}