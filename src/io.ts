/// <reference path="../typings/pixi/pixi.d.ts" />

"use strict";

module io {
  import Texture = PIXI.Texture;
  import Rectangle = PIXI.Rectangle;

  export class InputStream {
    public cursor = 0;
    //noinspection ThisExpressionReferencesGlobalObjectJS
    public length = this.dataView.byteLength;

    constructor(private dataView:DataView) {
    }

    readUnsignedByte():number {
      return this.dataView.getUint8(this.cursor++);
    }

    readByte():number {
      return this.dataView.getInt8(this.cursor++);
    }

    // twips
    readTwipsAndConvert():number {
      return this.readSignedVarInt() / 20;
    }

    readSignedVarInt():number {
      var v = this.readUnsignedVarInt();
      return ((v >>> 1) ^ -(v & 1)) | 0;
    }

    readUnsignedVarInt():number {
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
    var request = new XMLHttpRequest()
    request.responseType = 'arraybuffer'
    request.onload = function (event) {
      var request = (<XMLHttpRequest>event.target)
      if (request.status === 200 || request.status === 0) {
        loaded(request.response)
      }
      else {
        throw new Error(request.responseText)
      }
    };
    request.open("get", url)
    request.send()
  }

  export function callOrWaitTexture<T>(baseTexture:PIXI.BaseTexture, result:T, callback:(result:T)=>void):void {
    if (baseTexture.hasLoaded) {
      callback(result)
    }
    else {
      baseTexture.addEventListener('loaded', function () {
        callback(result)
      });
    }
  }

  export function loadTextureAtlas(name:string, loaded:(textures:Texture[])=>void):void {
    var baseTexture = Texture.fromImage(name).baseTexture;
    loadData(name + ".atl", function (result) {
      var dataView = new InputStream(new DataView(result));
      var n = dataView.readUnsignedVarInt();
      var textures = new Array(n);
      for (var i = 0; i < n; i++) {
        textures[i] = new Texture(baseTexture, new Rectangle(dataView.readUnsignedVarInt(), dataView.readUnsignedVarInt(), dataView.readUnsignedVarInt(), dataView.readUnsignedVarInt()));
      }
      callOrWaitTexture(baseTexture, textures, loaded)
    });
  }

  export function readCharCode(dataView) {
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
}