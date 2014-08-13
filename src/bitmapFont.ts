/// <reference path="../typings/pixi/pixi.d.ts" />
/// <reference path="io.ts" />

"use strict";

module bitmapFont {
  import InputStream = io.InputStream
  import Texture = PIXI.Texture
  import BaseTexture = PIXI.BaseTexture
  import Rectangle = PIXI.Rectangle

  var EMPTY_ARRAY = []

  export class CharInfo {
    constructor(public xOffset:number, public yOffset:number, public xAdvance:number, public kernings:Array<number>, public texture:Texture) {
    }
  }

  export function loadFonts(name:string, loaded:(chars:CharInfo[][])=>void):void {
    var baseTexture = Texture.fromImage(name).baseTexture
    io.loadData(name + ".info", function (result) {
      var dataView = new InputStream(new DataView(result))
      var n = dataView.readUnsignedVarInt()
      var fonts = new Array(n)
      for (var i = 0; i < n; i++) {
        fonts[i] = readChars(dataView, baseTexture)
      }
      io.callOrWaitTexture(baseTexture, fonts, loaded)
    });
  }

  function readChars(input:InputStream, baseTexture:BaseTexture):CharInfo[] {
    var n = input.readUnsignedVarInt()
    var chars:CharInfo[] = new Array(n)
    var prevX = 0
    var prevY = 0
    for (var i = 0; i < n; i++) {
      var xOffset = input.readByte()
      var yOffset = input.readByte()
      var xAdvance = input.readByte()

      var x = prevX + input.readSignedVarInt()
      var y = prevY + input.readSignedVarInt()
      var texture = new Texture(baseTexture, new Rectangle(x, y, input.readUnsignedByte(), input.readUnsignedByte()))
      prevX = x
      prevY = y

      chars[i] = new CharInfo(xOffset, yOffset, xAdvance, readKernings(input), texture)
    }
    return chars
  }

  function readKernings(input:InputStream):number[] {
    var n = input.readUnsignedVarInt()
    if (n == 0) {
      return EMPTY_ARRAY
    }

    var kernings:number[] = []
    var prevCharIndex = 0
    do {
      var charIndex = prevCharIndex + input.readUnsignedVarInt()
      kernings[charIndex] = input.readByte()
      prevCharIndex = charIndex
    }
    while (--n > 0)

    return kernings
  }
}