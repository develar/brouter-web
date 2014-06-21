/// <reference path="../typings/pixi/webgl.d.ts" />
/// <reference path="../typings/pixi/pixi.d.ts" />
/// <reference path="../typings/leaflet/leaflet.d.ts" />

import Stage = PIXI.Stage;

module L {
  export interface VectorTileLayerOptions extends GridLayerOptions {
    minZoom:number;
    maxZoom:number;
    zoomOffset?:number;

    subdomains?:string;

    detectRetina?:boolean;
  }

  export class VectorTileLayer extends GridLayer {
    private stage:Stage;
    private renderer:PIXI.Renderer;

    // default options, leaflet conventinon
    static options:VectorTileLayerOptions = {
      minZoom: 0,
      maxZoom: 18,
      subdomains: 'abc'
    };

    constructor(url:String, options:VectorTileLayerOptions) {
      super(url, options);
    }

    _initContainer():void {
      if (this.stage != null) {
        return;
      }

      // don't support
      this._zoomAnimated = false;

      // background color taken from Elevate theme
      this.stage = new PIXI.Stage(0xF8F8F8);
      var mapSize = this._map.getSize();
      this.renderer = PIXI.autoDetectRenderer(mapSize.x, mapSize.y, null, false, true);

      this.getPane().appendChild(this.renderer.view);
    }

    _reset():void {
      if (this.stage.children.length > 0) {
        this.stage.removeChildren();
      }

      this._tiles = {};
      this._tilesToLoad = 0;
      this._tilesTotal = 0;

      this._tileNumBounds = this._getTileNumBounds();
      this._resetWrap();
    }

    _addValidatedTiles(tilesToLoad:Number, queue:Array<L.Point>):void {
      for (var i = 0; i < tilesToLoad; i++) {
        var coords = queue[i];
        var tilePos = this._getTilePos(coords);
        this._wrapCoords(coords);

        var graphics = new PIXI.Graphics();
        graphics.beginFill(0xFF3300);
        graphics.lineStyle(10, 0xffd900, 1);
        graphics.drawRect(0, 0, 100, 100);
        graphics.endFill();

        graphics.x = tilePos.x;
        graphics.y = tilePos.y;

        this._tiles[this._tileCoordsToKey(coords)] = graphics;

        this.stage.addChild(graphics);

        this._tilesToLoad--;
      }

      this.renderer.render(this.stage);
    }

    _removeOtherTiles(bounds:Bounds):void {
      super._removeOtherTiles(bounds);

      this.renderer.render(this.stage);
    }

    _removeTile(key:string) {
      var tile = this._tiles[key];
      this.stage.removeChild(tile);
      delete this._tiles[key];
    }
  }

  export function vectorTileLayer(url:String, options:VectorTileLayerOptions):VectorTileLayer {
    return new VectorTileLayer(url, options);
  }
}