var geocoder = new google.maps.Geocoder();

BR.Search = L.Control.Search.extend({
    options: {
        //url: 'http://nominatim.openstreetmap.org/search?format=json&q={s}',
        //url: 'http://open.mapquestapi.com/nominatim/v1/search.php?format=json&q={s}',
        callData: function (text, callResponse) {
            geocoder.geocode({address: text}, callResponse);
        },
        filterJSON: function (response) {
            var json = {};
            for (var i = 0, n = response.length; i < n; i++) {
                var result = response[i];
                json[result.formatted_address] = L.latLng(result.geometry.location.lat(), result.geometry.location.lng());
            }
            return json;
        },
        jsonpParam: 'json_callback',
        propertyName: 'display_name',
        propertyLoc: ['lat', 'lon'],
        markerLocation: false,
        circleLocation: false,
        autoType: false,
        autoCollapse: true,
        minLength: 2,
        zoom: 12
    },
 
    // patch: interferes with draw plugin (adds all layers twice to map?) 
    _onLayerAddRemove: function() {}
});
