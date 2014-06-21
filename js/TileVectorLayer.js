L.VectorTileLayer = L.GridLayer.extend({
	options: {
		minZoom: 0,
		maxZoom: 18,

		subdomains: 'abc',
		zoomOffset: 0,

    detectRetina: false

		/*
		maxNativeZoom: <Number>,
		tms: <Boolean>,
		zoomReverse: <Number>,
		detectRetina: <Boolean>,
		*/
	},

	initialize: function (url, options) {
		this._url = url;

		options = L.setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {
			options.tileSize = Math.floor(options.tileSize / 2);
			options.zoomOffset++;

			options.minZoom = Math.max(0, options.minZoom);
			options.maxZoom--;
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	createTile: function (coords, done) {
    var stage = new PIXI.Stage(0x66FF99);
    var size = this._getTileSize();
    var renderer = PIXI.autoDetectRenderer(size, size, null, false, true);

    var tile = renderer.view;
		//tile.onload = L.bind(this._tileOnLoad, this, done, tile);
		//tile.onerror = L.bind(this._tileOnError, this, done, tile);
    this._tileOnLoad(done, tile);
		//tile.src = this.getTileUrl(coords);

    var graphics = new PIXI.Graphics();
    graphics.beginFill(0xFF3300);
    graphics.lineStyle(10, 0xffd900, 1);
    graphics.drawRect(0, 0, 100, 100);
    graphics.endFill();

    stage.addChild(graphics);

    renderer.render(stage);
		return tile;
	},

	getTileUrl: function (coords) {
		return L.Util.template(this._url, L.extend({
			r: this.options.detectRetina && L.Browser.retina && this.options.maxZoom > 0 ? '@2x' : '',
			s: this._getSubdomain(coords),
			x: coords.x,
			y: this.options.tms ? this._tileNumBounds.max.y - coords.y : coords.y,
			z: this._getZoomForUrl()
		}, this.options));
	},

	_tileOnLoad: function (done, tile) {
		done(null, tile);
	},

	_tileOnError: function (done, tile, e) {
		done(e, tile);
	},

	_getTileSize: function () {
		var map = this._map,
		    options = this.options,
		    zoom = map.getZoom() + options.zoomOffset,
		    zoomN = options.maxNativeZoom;

		// increase tile size when overscaling
		return zoomN && zoom > zoomN ? Math.round(map.getZoomScale(zoom) / map.getZoomScale(zoomN) * options.tileSize) : options.tileSize;
	},

	_removeTile: function (key) {
		//noinspection JSUnusedLocalSymbols
    var tile = this._tiles[key];

		L.GridLayer.prototype._removeTile.call(this, key);
	},

	_getZoomForUrl: function () {
		var options = this.options;
    var zoom = this._map.getZoom();

		if (options.zoomReverse) {
			zoom = options.maxZoom - zoom;
		}

		zoom += options.zoomOffset;

		return options.maxNativeZoom ? Math.min(zoom, options.maxNativeZoom) : zoom;
	},

	_getSubdomain: function (tilePoint) {
		var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	},

	// stops loading all tiles in the background layer
	_abortLoading: function () {
		var i, tile;
		for (i in this._tiles) {
			tile = this._tiles[i];

			if (!tile.complete) {
				tile.onload = L.Util.falseFn;
				tile.onerror = L.Util.falseFn;
				tile.src = L.Util.emptyImageUrl;

				L.DomUtil.remove(tile);
			}
		}
	}
});

L.vectorTileLayer = function (url, options) {
	return new L.VectorTileLayer(url, options);
};