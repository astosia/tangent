// Import the Clay package
//var Clay = require('pebble-clay');
var Clay = require('@rebble/clay');
// Load Clay configuration file
var clayConfig = require('./config.js');
var tz = require('./timezones.js');
var modifications = require('./modifications.js');

var clay = new Clay(clayConfig, modifications, { autoHandleEvents: false });

var messageKeys = require('message_keys');

var messageKeysLookup = {};
var keys = Object.keys(messageKeys);
for (var i = 0; i < keys.length; i++) {
    messageKeysLookup[messageKeys[keys[i]]] = keys[i];
}

Pebble.addEventListener('showConfiguration', function(e) {
    Pebble.openURL(clay.generateUrl());
});

var sendAppMessage = function(msg) {
    if (msg === null) {
        console.error("Coding error: trying to send a null message.");
        return;
    }
    try {
        Pebble.sendAppMessage(msg, function(e) {
            var readable = {};
            var msgKeys = Object.keys(msg);
            for (var j = 0; j < msgKeys.length; j++) {
                var k = msgKeys[j];
                var label = (messageKeysLookup[k] || k) + " (" + k + ")";
                readable[label] = msg[k];
            }
            console.debug("Successfully sent message to watch: " + JSON.stringify(readable, null, 2));
        }, function(err) {
            console.error("AppMessage send failed: " + JSON.stringify(err));
        });
    } catch(e) {
        console.error("Pebble.sendAppMessage failed.", e);
    }
};

Pebble.addEventListener('webviewclosed', function(e) {
    if (e && !e.response) return;

    var settings = clay.getSettings(e.response);

    var tzmodekey = messageKeys.TZ_MODE;
    var tzidkey = messageKeys.TZ_ID;
    var tzidstatekey = messageKeys.TZ_ID_STATE;
    var tzoffsetkey = messageKeys.TZ_OFFSET;
    var tzcodekey = messageKeys.TZ_CODE;

    settings[tzmodekey] = settings[tzmodekey] ? 1 : 0;

    var cachedtz = settings[tzidstatekey] || settings[tzidkey];
    
    var sendAnyway = function(error, msg) {
        console.error("Unable to get offset for " + cachedtz + ": " + error.message);
        msg[tzoffsetkey] = -1;
        msg[tzcodekey] = "ERR";
        sendAppMessage(msg);
    };

    // Ensure timezone keys exist even if not set
    if (typeof settings[tzidkey] === 'undefined') {
        settings[tzidkey] = "";
    }
    if (typeof settings[tzoffsetkey] === 'undefined') {
        settings[tzoffsetkey] = 0;
    }
    if (typeof settings[tzcodekey] === 'undefined') {
        settings[tzcodekey] = "";
    }

    if (cachedtz && cachedtz !== "" && cachedtz !== "undefined") {
        settings[tzidkey] = cachedtz;
        tz.get(cachedtz).then(function(partial) {
            settings[tzoffsetkey] = partial[tzoffsetkey];
            settings[tzcodekey] = partial[tzcodekey];
            
            delete settings[tzidstatekey];
            
            sendAppMessage(settings);
        }).catch(function(err) {
            delete settings[tzidstatekey];
            
            sendAnyway(err, settings);
        });
    } else {
        // Handle case where timezone is disabled or not selected
        settings[tzidkey] = "";
        settings[tzoffsetkey] = 0;
        settings[tzcodekey] = "";
        
        delete settings[tzidstatekey];
        
        sendAppMessage(settings);
    }
});

Pebble.addEventListener('ready', function(e) {
    var settings;
    try {
        // Access to localStorage with a fallback to prevent crashes on first run
        var json = localStorage.getItem('clay-settings');
        settings = json ? JSON.parse(json) : {};
    } catch (err) {
        console.error("Error parsing settings from localStorage: " + err);
        return;
    }

    // If a timezone was previously saved, update the watch with fresh offset data
    if (settings && settings.TZ_ID && settings.TZ_ID !== "" && settings.TZ_ID !== "undefined") {
        tz.get(settings.TZ_ID).then(function(msg) {
            sendAppMessage(msg);
        }).catch(function(err) {
            console.error("Unable to get offset for " + settings.TZ_ID + " on startup: " + err.message);
        });
    }
});

Pebble.addEventListener('appmessage', function(e) {
    console.debug("Received app message: " + JSON.stringify(e.payload, null, 2));
});