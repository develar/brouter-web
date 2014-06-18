(function () {
  var hostname = window.location.hostname;
  BR.conf = {};

  if (true || hostname === 'routeplanner.develar.org' || hostname === 'brouter.de' || hostname === 'h2096617.stratoserver.net') {
    // online service (brouter.de) configuration
    BR.conf.profiles = [
      'trekking',
      'fastbike',
      'safety',
      'shortest',
      'shortest-eudem',
      'trekking-ignore-cr',
      'trekking-steep',
      'trekking-noferries',
      'trekking-nosteps',
      'moped',
      'car-test',
      'vm-forum-liegerad-schnell',
      'vm-forum-velomobil-schnell'
    ];

    BR.conf.host = 'http://h2096617.stratoserver.net:443';

  }
  else {
    // desktop configuration
    BR.conf.profiles = [
      'trekking',
      'fastbike',
      'safety',
      'shortest',
      'shortest-eudem',
      'trekking-ignore-cr',
      'trekking-steep',
      'trekking-noferries',
      'trekking-nosteps',
      'moped',
      'car-test'
    ];

    BR.conf.host = 'http://localhost:17777';
  }
})();
