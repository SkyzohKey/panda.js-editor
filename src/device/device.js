// Fake Cordova object
var cordova = {
	require: function() {
		return this;
	},

	nativeEvalAndFetch: function() {}
};

var app = {
	connected: false,
	connectCounter: 0,
	modulesToReload: [],
	moduleScripts: {},

	init: function() {
		// Parse device info from url
		var params = window.location.href.split('?') || [];
		if (params[1]) params = params[1].split('&');
		for (var i = 0; i < params.length; i++) {
			var info = params[i].split('=');
			if (info.length < 2) continue;
			this[info[0]] = decodeURIComponent(info[1]);
		}

		this.socket = io();
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('command', this.onCommand.bind(this));
		window.onbeforeunload = this.closeSocket.bind(this);
		window.onerror = this.onError.bind(this);
	},

	onConnect: function() {
		this.connected = true;
		this.socket.emit('register', {
			platform: this.platform,
			model: this.model
		});
		if (this.hadConnection) this.reloadGame();
		else this.startPing();
	},

	startPing: function() {
		this.pingTimer = setInterval(this.sendPing.bind(this), 2000);
	},

	sendPing: function() {
		this.socket.emit('ping');
	},

	onDisconnect: function() {
		this.connected = false;
		this.hadConnection = true;
	},

	onCommand: function(command, param) {
		if (this[command]) this[command](param);
	},

	onError: function(msg, file, line) {
		var idx = file.lastIndexOf('/');
		if (idx > -1) file = file.substr(idx + 1);

		this.socket.emit('errorMsg', file, line, msg);

		// this.showErrorDiv();
		// game.system.pause();
		return false;
	},

	showErrorDiv: function() {
		if (this.errorDiv) return;
		if (this.platform === 'Win32NT') return;

		var errorDiv = document.createElement('div');
		errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.25)';
		errorDiv.style.position = 'absolute';
		errorDiv.style.left = '0px';
		errorDiv.style.top = '0px';
		errorDiv.style.zIndex = '999999';
		errorDiv.style.width = '100%';
		errorDiv.style.height = '100%';
		errorDiv.ontouchstart = this.errorDivTouch.bind(this);
		errorDiv.onmousedown = this.errorDivTouch.bind(this);
		document.body.appendChild(errorDiv);
		this.errorDiv = errorDiv;
	},

	hideErrorDiv: function() {
		if (!this.errorDiv) return;
		document.body.removeChild(this.errorDiv);
		this.errorDiv = null;
	},

	errorDivTouch: function(event) {
		event.preventDefault();
		this.hideErrorDiv();
		// this.reloadGame();
	},

	closeSocket: function() {
		this.socket.close();
	},

	exitGame: function() {
		this.closeSocket();
		history.back();
	},

	reloadGame: function() {
		this.closeSocket();
		window.location.reload();
	},

	changeScene: function(scene) {
		console.log('changeScene');
		scene = scene || game.scene.name;

		this.hideErrorDiv();

		console.clear();
		
		if (game.assetQueue.length + game.audioQueue.length > 0) {
			var loader = new game.Loader(scene);
			loader.start();
		}
		else {
			game.system.setScene(scene);
		}
	},

	reloadModules: function(modules) {
		game.config.autoStart = false;
		game.onReady = this.reloadModule.bind(this);

		for (var i = 0; i < modules.length; i++) {
			this.modulesToReload.push(modules[i]);
		}

		if (this.modulesToReload.length > 0) this.reloadModule();
	},

	modulesLoaded: function() {
		this.changeScene();
	},

	toggleDebugBar: function() {
		var debugDiv = document.getElementById('pandaDebug');
		if (debugDiv) {
			if (debugDiv.style.visibility === 'hidden') {
				debugDiv.style.visibility = '';
			}
			else {
				debugDiv.style.visibility = 'hidden';
			}
		}
	},

	toggleFakeTouch: function() {
		if (!game.Debug) return;
		game.Debug.fakeTouch = !game.Debug.fakeTouch;
	},

	toggleBounds: function() {
		if (!game.Debug) return;
		game.Debug.showBounds = !game.Debug.showBounds;
	},

	toggleHitAreas: function() {
		if (!game.Debug) return;
		game.Debug.showHitAreas = !game.Debug.showHitAreas;
	},

	toggleBodies: function() {
		if (!game.Debug) return;
		game.Debug.showBodies = !game.Debug.showBodies;
	},

	reloadModule: function() {
		var module = this.modulesToReload.pop();
		if (!module) return this.modulesLoaded();

		if (!game.modules[module].classes) {
			console.error('Panda Engine ' + game.version + ' is not supported');
			return;
		}

		// Delete module classes
		for (var i = 0; i < game.modules[module].classes.length; i++) {
			var className = game.modules[module].classes[i];
			delete game[className];
		}

		// Delete module
		delete game.modules[module];

		// Load new module script
		var path = 'src/' + module.replace(/\./g, '/') + '.js';
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = path;
		document.getElementsByTagName('head')[0].appendChild(script);

		// Remove previous script from head
		if (this.moduleScripts[module]) {
			document.getElementsByTagName('head')[0].removeChild(this.moduleScripts[module]);
		}
		this.moduleScripts[module] = script;
	}
};

game.module('engine.editor')
.require('engine.debug')
.body(function() {
	game.Debug.inject({
		_updateText: function() {
			if (app.connected) this.panel.style.color = '#00ff00';
			else this.panel.style.color = '#ff0000';
			if (game.Debug.fakeTouch) this.panel.style.color = '#ffff00';

			this.text += ' SYSTEM: ' + game.width + 'x' + game.height;
			// this.text += ' CANVAS: ' + game.system.canvasWidth + 'x' + game.system.canvasHeight;
			this.text += ' WINDOW: ' + window.innerWidth + 'x' + window.innerHeight;
			this.super();
		}
	});

	game.config.debug = game.config.debug || {};
	game.config.debug.enabled = true;
	game.config.debug.showInfo = false;
});

(function() {
	var _console = window.console || {};
	window.console = {
		log: function(msg) {
			_console.log && _console.log(msg);
			if (typeof msg === 'object') return;
			app.socket.emit('console', 'log', msg);
		},

		warn: function(msg) {
			_console.warn && _console.warn(msg);
			if (typeof msg === 'object') return;
			app.socket.emit('console', 'warn', msg);
		},

		error: function(msg) {
			_console.error && _console.error(msg);
			if (typeof msg === 'object') return;
			app.socket.emit('console', 'error', msg);
		},

		clear: function() {
			_console.clear();
		}
	};

	var currentTouches = {},
	    eventName = { touchstart: 'touchstart', touchend: 'touchend' };

	if (window.navigator.msPointerEnabled) {
	    eventName = { touchstart: 'MSPointerDown', touchend: 'MSPointerUp' };
	}

	document.addEventListener(eventName.touchstart, function(evt) {
	    var touches = evt.touches || [evt],
	        touch;
	    for(var i = 0, l = touches.length; i < l; i++) {
	        touch = touches[i];
	        currentTouches[touch.identifier || touch.pointerId] = touch;
	    }
	}, false);

	document.addEventListener(eventName.touchend, function(evt) {
	    var touchCount = Object.keys(currentTouches).length;
	    currentTouches = {};
	    if (touchCount === 3) {
	        event.preventDefault();
	        window.history.back(window.history.length);
	    }
	    if (touchCount === 4) {
	    	event.preventDefault();
	    	app.reloadGame();
	    }
	}, false);
}());

app.init();
