var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Stage = PIXI.Stage;

var L;
(function (L) {
    var VectorTileLayer = (function (_super) {
        __extends(VectorTileLayer, _super);
        function VectorTileLayer(url, options) {
            _super.call(this, url, options);
        }
        VectorTileLayer.prototype._initContainer = function () {
            if (this.stage != null) {
                return;
            }

            this._zoomAnimated = false;

            this.stage = new PIXI.Stage(0xF8F8F8);
            var mapSize = this._map.getSize();
            this.renderer = PIXI.autoDetectRenderer(mapSize.x, mapSize.y, null, false, true);

            this.getPane().appendChild(this.renderer.view);
        };

        VectorTileLayer.prototype._reset = function () {
            if (this.stage.children.length > 0) {
                this.stage.removeChildren();
            }

            this._tiles = {};
            this._tilesToLoad = 0;
            this._tilesTotal = 0;

            this._tileNumBounds = this._getTileNumBounds();
            this._resetWrap();
        };

        VectorTileLayer.prototype._addValidatedTiles = function (tilesToLoad, queue) {
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
        };

        VectorTileLayer.prototype._removeOtherTiles = function (bounds) {
            _super.prototype._removeOtherTiles.call(this, bounds);

            this.renderer.render(this.stage);
        };

        VectorTileLayer.prototype._removeTile = function (key) {
            var tile = this._tiles[key];
            this.stage.removeChild(tile);
            delete this._tiles[key];
        };
        VectorTileLayer.options = {
            minZoom: 0,
            maxZoom: 18,
            subdomains: 'abc'
        };
        return VectorTileLayer;
    })(L.GridLayer);
    L.VectorTileLayer = VectorTileLayer;

    function vectorTileLayer(url, options) {
        return new VectorTileLayer(url, options);
    }
    L.vectorTileLayer = vectorTileLayer;
})(L || (L = {}));
