/*
 BRouter web - web client for BRouter bike routing engine

 Licensed under the MIT license.
 */

(function () {

  var map;
  var layersControl;

  function initMap() {
    var osmAttribution = '&copy; <a target="_blank" href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    var osm = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'tiles ' + osmAttribution
    });

    var mapsforge = L.tileLayer(window.location.hostname == 'localhost' ? 'http://localhost:6090/{z}/{x}/{y}' : 'http://{s}.tile.develar.org/{z}/{x}/{y}', {
      maxZoom: 21,
      attribution: 'tiles ' + '&copy; <a target="_blank" href="http://www.openandromaps.org/en/disclaimer">OpenAndroMaps</a>'
    });

    var osmde = L.tileLayer('http://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'tiles by <a target="_blank" href="http://openstreetmap.de/karte.html">openstreetmap.de</a> ' + osmAttribution
    });

    var topo = L.tileLayer('http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      minZoom: 5,
      maxZoom: 15,
      attribution: 'tiles &copy; <a target="_blank" href="https://opentopomap.org">OpenTopoMap</a>, <a target="_blank" href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>'
                   + ', <a target="_blank" href="http://viewfinderpanoramas.org">SRTM</a>'
    });

    var thunderforestAttribution = 'tiles &copy; <a target="_blank" href="http://www.thunderforest.com">Thunderforest</a> '
                                   + '(<a target="_blank" href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a>)';
    var cycle = L.tileLayer('http://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: thunderforestAttribution
    });
    var outdoors = L.tileLayer('http://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: thunderforestAttribution
    });

    var cycling = L.tileLayer('http://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.7,
      attribution: 'Cycling &copy; <a target="_blank" href="http://cycling.waymarkedtrails.org">Waymarked Trails</a> '
                   + '(<a target="_blank" href="http://creativecommons.org/licenses/by-sa/3.0/de/deed.en">CC-BY-SA 3.0 DE</a>)'
    });
    var hiking = L.tileLayer('http://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.7,
      attribution: 'Hiking &copy; <a target="_blank" href="http://hiking.waymarkedtrails.org">Waymarked Trails</a> '
                   + '(<a target="_blank" href="http://creativecommons.org/licenses/by-sa/3.0/de/deed.en">CC-BY-SA 3.0 DE</a>)'
    });

    map = new L.Map('map', {
      layers: [mapsforge],
      center: new L.LatLng(50.99, 9.86),
      zoom: 6
    });
    map.attributionControl.addAttribution(
      '<a href="http://brouter.de/brouter" target="_blank">BRouter</a> &copy; Arndt Brenschede, '
      + 'routing + map data &copy; <a target="_blank" href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors '
      + '(<a target="_blank" href="http://opendatacommons.org/licenses/odbl/">ODbL</a>)');

    layersControl = L.control.layers({
                                       'OpenAndroMaps': mapsforge,
                                       'OpenStreetMap': osm,
                                       'OpenStreetMap.de': osmde,
                                       'OpenTopoMap': topo,
                                       'OpenCycleMap (Thunderf.)': cycle,
                                       'Outdoors (Thunderforest)': outdoors
                                     }, {
                                       'Cycling (Waymarked Trails)': cycling,
                                       'Hiking (Waymarked Trails)': hiking
                                     }).addTo(map);

    map.addControl(new BR.Search());
  }

  function initApp() {
    var router;
    var routing;
    var routingOptions;
    var nogos;
    var stats;
    var elevation;
    var download;
    var profile;
    var leftPaneId = 'leftpane';
    var saveWarningShown = false;

    // left sidebar as additional control position
    map._controlCorners[leftPaneId] = L.DomUtil.create('div', 'leaflet-' + leftPaneId, map._controlContainer);

    router = L.bRouter(); //brouterCgi dummyRouter

    function updateRoute(evt) {
      router.setOptions(evt.options);
      routing.rerouteAllSegments(onUpdate);
    }

    routingOptions = new BR.RoutingOptions();
    routingOptions.on('update', updateRoute);

    nogos = new BR.NogoAreas();
    nogos.on('update', updateRoute);

    stats = new BR.TrackStats();
    download = new BR.Download();
    elevation = new BR.Elevation();
    profile = new BR.Profile();
    profile.on('update', function (evt) {
      BR.message.hideError();
      var profileId = routingOptions.getCustomProfile();
      router.uploadProfile(profileId, evt.profileText, function (err, profile) {
        if (!err) {
          routingOptions.setCustomProfile(profile);
          if (!saveWarningShown) {
            BR.message.showWarning('Note: Uploaded custom profiles are only cached temporarily on the server.'
                                   + '<br/>Please save your edits to your local PC.');
            saveWarningShown = true;
          }
        }
        else {
          BR.message.showError(err);
          if (profile) {
            routingOptions.setCustomProfile(profile, true);
            router.setOptions(routingOptions.getOptions());
          }
        }
      });
    });
    profile.on('clear', function (evt) {
      BR.message.hideError();
      routingOptions.setCustomProfile(null);
    });

    routing = new BR.Routing({
                               routing: {
                                 router: L.bind(router.getRouteSegment, router)
                               }
                             });
    routing.on('routing:routeWaypointEnd', onUpdate);

    function onUpdate() {
      var track = routing.toPolyline(),
        latLngs = routing.getWaypoints(),
        urls = {};

      elevation.update(track);
      stats.update(track);

      if (latLngs.length > 1) {
        urls.gpx = router.getUrl(latLngs, 'gpx');
        urls.kml = router.getUrl(latLngs, 'kml');
        urls.csv = router.getUrl(latLngs, 'csv');
      }

      download.update(urls);
    };

    map.addControl(new BR.Control({
                                    heading: '',
                                    divId: 'header'
                                  }));
    routingOptions.addTo(map);
    stats.addTo(map);
    download.addTo(map);
    elevation.addTo(map);
    profile.addTo(map);

    nogos.addTo(map);
    routing.addTo(map);

    // initial option settings (after controls are added and initialized with onAdd, before permalink)
    router.setOptions(nogos.getOptions());
    router.setOptions(routingOptions.getOptions());

    map.addControl(new L.Control.Permalink({
                                             text: 'Permalink',
                                             position: 'bottomright',
                                             layers: layersControl,
                                             routingOptions: routingOptions,
                                             nogos: nogos,
                                             router: router,
                                             routing: routing
                                           }));
  }

  initMap();
  initApp();
})();
