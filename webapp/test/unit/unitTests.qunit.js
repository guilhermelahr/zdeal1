/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/wb/zdeal1/zdeal1/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});