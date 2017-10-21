// magic auto attribution for xMapServer-2
(function () {
	'use strict';

	var L = require('leaflet'),
		superagent = require('superagent');

	// hijack TileLayer initialize
	var proto = L.TileLayer.prototype;
	var prev = proto.initialize;

	// match fro xMap-2 /rest/ and /rs/ urls
	var xmapRegex = new RegExp('(^http[s]:\/\/.*\/)services\/(rest|rs)\/XMap\/');

	// match for xserver-internet token (only new GUID-tokens!)
	var tokenRegex = new RegExp('[&\?]xtok=(\\w{8}-\\w{4}-\\w{4}-\\w{4}-\\w{12})');

	proto.initialize = function (url, options) {
		// base initialization first
		prev.call(this, url, options);

		// get the resolved uri string
		var resolvedUrl = this.getTileUrl({x: 0, y: 0, z: 0});
		
		// does it match an xMap-2 url?
		var urlMatch = xmapRegex.exec(resolvedUrl);
		if (!urlMatch || urlMatch.length < 2)
			return;

		// use the same host for XRuntime
		var host = urlMatch[1];		

		// parse token from resolvedUrl
		var tokenMatch = tokenRegex.exec(resolvedUrl);
		var token = (tokenMatch && tokenMatch.length > 1) ? tokenMatch[1] : null;

		// get copyright from XRuntime
		var req = superagent.post(host + 'services/rs/XRuntime/experimental/getDataInformation')
			.set('Content-Type', 'application/json')
			.send({
				dataInformationOptions: {
					returnOnlyLicensedMapFeatures: true
				},
				resultFields: {
					continents: false
				}
			});

		if (token)
			req.auth('xtok', token);

		var that = this;
		req.end(function (err, resp) {
			var copyright = err || !resp || !resp.body || !resp.body.mapDescription ||
				!resp.body.mapDescription.providerInformation ?
				'PTV, HERE (or maybe TOMTOM), AND' :
				'PTV, ' + resp.body.mapDescription.providerInformation;
			
			var oldCopyright = that.options.attribution;

			that.options.attribution = copyright;

			// set or replace copyright in attributionControl
			if (that._map.attributionControl) {
				if(oldCopyright) // remove old copyright
					that._map.attributionControl.removeAttribution(oldCopyright);

				that._map.attributionControl.addAttribution(copyright);
			}
		});
	}
})();