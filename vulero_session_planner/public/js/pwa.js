(function () {
	"use strict";

	var APP_NAME = "Vulero Session Planner";
	var MANIFEST_URL = "/manifest.json";
	var SW_URL = "/sw.js";
	var THEME_COLOR = "#1f3b5b";
	var INSTALL_PROMPTED_KEY = "vulero_pwa_install_prompted";

	var deferredPrompt = null;
	var promptRequested = false;

	function isStandalone() {
		return (
			window.matchMedia("(display-mode: standalone)").matches ||
			window.navigator.standalone === true
		);
	}

	function safeStorage() {
		try {
			return window.sessionStorage;
		} catch (e) {
			return null;
		}
	}

	function ensureHeadTags() {
		var head = document.head || document.getElementsByTagName("head")[0];
		if (!head) {
			return;
		}

		var manifest = head.querySelector('link[rel="manifest"]');
		if (!manifest) {
			manifest = document.createElement("link");
			manifest.rel = "manifest";
			head.appendChild(manifest);
		}
		manifest.href = MANIFEST_URL;

		var theme = head.querySelector('meta[name="theme-color"]');
		if (!theme) {
			theme = document.createElement("meta");
			theme.name = "theme-color";
			head.appendChild(theme);
		}
		theme.content = THEME_COLOR;

		var apple = head.querySelector('link[rel="apple-touch-icon"]');
		if (!apple) {
			apple = document.createElement("link");
			apple.rel = "apple-touch-icon";
			head.appendChild(apple);
		}
		apple.href = "/assets/vulero_session_planner/pwa/apple-touch-icon.png";
	}

	function registerServiceWorker() {
		if (!("serviceWorker" in navigator)) {
			return;
		}
		navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(function () {
			// ignore registration errors
		});
	}

	function canPromptInstall() {
		if (promptRequested || isStandalone() || !deferredPrompt) {
			return false;
		}
		if (!window.location || !window.location.pathname || !window.location.pathname.startsWith("/app")) {
			return false;
		}
		var storage = safeStorage();
		if (storage && storage.getItem(INSTALL_PROMPTED_KEY) === "1") {
			return false;
		}
		return true;
	}

	function markPrompted() {
		promptRequested = true;
		var storage = safeStorage();
		if (storage) {
			storage.setItem(INSTALL_PROMPTED_KEY, "1");
		}
	}

	function triggerInstallPrompt() {
		if (!deferredPrompt) {
			return;
		}
		deferredPrompt.prompt();
		deferredPrompt.userChoice.then(function () {
			deferredPrompt = null;
		});
	}

	function showInstallPrompt() {
		if (!canPromptInstall()) {
			return;
		}
		markPrompted();

		var message = "Install " + APP_NAME + " on this device?";
		if (window.frappe && typeof frappe.confirm === "function") {
			frappe.confirm(message, triggerInstallPrompt, function () {
				deferredPrompt = null;
			});
			return;
		}

		if (window.confirm(message)) {
			triggerInstallPrompt();
		} else {
			deferredPrompt = null;
		}
	}

	window.addEventListener("beforeinstallprompt", function (event) {
		event.preventDefault();
		deferredPrompt = event;
		showInstallPrompt();
	});

	window.addEventListener("appinstalled", function () {
		deferredPrompt = null;
		var storage = safeStorage();
		if (storage) {
			storage.removeItem(INSTALL_PROMPTED_KEY);
		}
	});

	function init() {
		ensureHeadTags();
		registerServiceWorker();

		if (window.frappe && typeof frappe.ready === "function") {
			frappe.ready(function () {
				setTimeout(showInstallPrompt, 1000);
			});
		} else {
			document.addEventListener("DOMContentLoaded", function () {
				setTimeout(showInstallPrompt, 1000);
			});
		}
	}

	init();
})();
