var gulp = require('gulp');
var bower = require('gulp-bower');
var changed = require('gulp-changed');
var gulpFilter = require('gulp-filter');

var ts = require('gulp-type');

var tsProject = ts.createProject({removeComments: true});

gulp.task('compile', function () {
  var outDir = 'out';
  var tsResult = gulp.src('src/*.ts')
    .pipe(changed(outDir, {extension: '.js'}))
    .pipe(ts(tsProject));

  return tsResult.js.pipe(gulp.dest(outDir));
});

gulp.task('default', ['compile']);

gulp.task('watch', ['compile'], function() {
    gulp.watch('src/*.ts', ['compile']);
});

gulp.task('bower', function () {
  var libDestination = 'lib/';
  var filter = gulpFilter(function (file) {
    var path = file.path.replace(/\\/g, '/');

    function isDist() {
      return path.indexOf('/dist/') == path.indexOf('/');
    }

    if (path.indexOf('leaflet-routing/') == 0) {
      return path.indexOf('leaflet-routing/src/') == 0;
    }
    else if (path.indexOf('leaflet-search/') == 0) {
      return path == 'leaflet-search/images/search-icon.png' || isDist();
    }
    else if (path.indexOf('Leaflet.Elevation/') == 0 || path.indexOf('leaflet.draw/') == 0) {
      return isDist();
    }
    else if (path.indexOf('leaflet-plugins/') == 0) {
      return path == 'leaflet-plugins/control/Permalink.js' || path == 'leaflet-plugins/control/Permalink.Layer.js';
    }
    else if (path.indexOf('leaflet-gpx/') == 0) {
      return path != 'leaflet-gpx/LICENSE' && path != 'leaflet-gpx/README.md' && path != 'leaflet-gpx/.bower.json';
    }
    else {
      return path == "normalize-css/normalize.css";
    }
  });
  return bower()
    .pipe(filter)
    .pipe(gulp.dest(libDestination))
});