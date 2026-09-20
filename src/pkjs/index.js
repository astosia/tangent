// Import the Clay package
//var Clay = require('pebble-clay');  //replaced with rebble clay
var Clay = require('@rebble/clay');
// Load Clay configuration file
var clayConfig = require('./config.js');
var tz = require('./timezones.js');
var weather = require('./weather.js');
var modifications = require('./modifications.js');

var clay = new Clay(clayConfig, modifications, { autoHandleEvents: false });

var messageKeys = require('message_keys');

var messageKeysLookup = {};
var keys = Object.keys(messageKeys);
for (var i = 0; i < keys.length; i++) {
    messageKeysLookup[messageKeys[keys[i]]] = keys[i];
}

var Pebble_platform = (Pebble.getActiveWatchInfo && Pebble.getActiveWatchInfo().platform) || 'aplite';
var isbw = (Pebble_platform === 'aplite' || Pebble_platform === 'diorite' || Pebble_platform === 'flint');

// clay.getSettings(e.response) returns an object keyed by numeric
// message-key ID (e.g. settings[10062]). Several helpers (weather.js, and
// the webviewclosed logic below) are easier to read/reuse if they can
// instead work with friendly string names (settings.UseWeather) - the same
// shape the settings take once persisted to localStorage. This converts
// one to the other; keys with no registered message key (like
// APIKEY_User) pass through unchanged.
var toFriendlySettings = function(numericSettings) {
    var friendly = {};
    var numKeys = Object.keys(numericSettings);
    for (var j = 0; j < numKeys.length; j++) {
        var k = numKeys[j];
        var name = messageKeysLookup[k] || k;
        friendly[name] = numericSettings[k];
    }
    return friendly;
};

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

// Resolves the timezone portion of `settings` (mutates and returns a promise
// of the same settings object). Never rejects - on failure it fills in
// error-marker values so the AppMessage still gets built and sent.
var applyTimezone = function(settings) {
    var tzmodekey = messageKeys.TZ_MODE;
    var tzidkey = messageKeys.TZ_ID;
    var tzidstatekey = messageKeys.TZ_ID_STATE;
    var tzoffsetkey = messageKeys.TZ_OFFSET;
    var tzcodekey = messageKeys.TZ_CODE;

    settings[tzmodekey] = settings[tzmodekey] ? 1 : 0;

    var cachedtz = settings[tzidstatekey] || settings[tzidkey];

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
        return tz.get(cachedtz).then(function(partial) {
            settings[tzoffsetkey] = partial[tzoffsetkey];
            settings[tzcodekey] = partial[tzcodekey];
            delete settings[tzidstatekey];
            return settings;
        }).catch(function(err) {
            console.error("Unable to get offset for " + cachedtz + ": " + err.message);
            delete settings[tzidstatekey];
            settings[tzoffsetkey] = -1;
            settings[tzcodekey] = "ERR";
            return settings;
        });
    }

    // Timezone disabled or not selected
    settings[tzidkey] = "";
    settings[tzoffsetkey] = 0;
    settings[tzcodekey] = "";
    delete settings[tzidstatekey];
    return Promise.resolve(settings);
};

// Resolves the weather portion of `settings` (mutates and returns a promise
// of the same numeric-keyed settings object). Never rejects - on failure it
// leaves placeholder values so the AppMessage still gets built and sent.
var applyWeather = function(settings) {
    var iconKey = messageKeys.IconNow;
    var tempKey = messageKeys.WeatherTemp;
    var foreKey = messageKeys.TempFore;
    var rainKey = messageKeys.RainSoon;
    var wbgtKey = messageKeys.WBGTLevel;
    var friendly = toFriendlySettings(settings);

    return weather.get(friendly).then(function(result) {
        settings[iconKey] = result.icon;
        settings[tempKey] = result.temp;
        settings[foreKey] = result.tempFore;
        settings[rainKey] = result.rainSoon;
        settings[wbgtKey] = result.wbgtLevel;
        return settings;
    }).catch(function(err) {
        console.error("Unable to fetch weather: " + err.message);
        settings[iconKey] = 0;
        settings[tempKey] = "--";
        settings[foreKey] = "--|--";
        settings[rainKey] = 0;
        settings[wbgtKey] = 0;
        return settings;
    });
};

// Fetches weather using whatever settings are currently in localStorage
// (friendly string-keyed, same shape clay persists there) and pushes
// IconNow/WeatherTemp/TempFore/RainSoon to the watch. Used both on app
// launch and whenever the watch asks for a refresh
var refreshWeatherFromStorage = function() {
    var settings;
    try {
        var json = localStorage.getItem('clay-settings');
        settings = json ? JSON.parse(json) : {};
    } catch (err) {
        console.error("Error parsing settings from localStorage: " + err);
        return;
    }

    if (!settings || !settings.UseWeather) {
        return;
    }

    weather.get(settings).then(function(result) {
        var msg = {};
        msg[messageKeys.IconNow] = result.icon;
        msg[messageKeys.WeatherTemp] = result.temp;
        msg[messageKeys.TempFore] = result.tempFore;
        msg[messageKeys.RainSoon] = result.rainSoon;
        msg[messageKeys.WBGTLevel] = result.wbgtLevel;
        sendAppMessage(msg);
    }).catch(function(err) {
        console.error("Unable to refresh weather: " + err.message);
    });
};

Pebble.addEventListener('webviewclosed', function(e) {
    if (e && !e.response) return;

    if (isbw) {
    var settings = clay.getSettings(e.response);

    applyTimezone(settings)
        ///// to minimise number of keys used by APLITE, delete unused keys from messages.  Might as well do this for other BW watches too
        .then(function(finalSettings) {
            delete finalSettings[messageKeys.APIKEY_User];
            delete finalSettings[messageKeys.IconNow];
            delete finalSettings[messageKeys.WeatherTemp];
            delete finalSettings[messageKeys.TempFore];
            delete finalSettings[messageKeys.RainSoon];
            delete finalSettings[messageKeys.WBGTLevel];
            delete finalSettings[messageKeys.ThemeSelect];
            delete finalSettings[messageKeys.BackgroundColor1];
            delete finalSettings[messageKeys.MinuteHandShadowColor];
            delete finalSettings[messageKeys.MajorTickColor];
            delete finalSettings[messageKeys.MinorTickColor];
            delete finalSettings[messageKeys.HourDigitsColor];
            delete finalSettings[messageKeys.MinutesHandColor];
            delete finalSettings[messageKeys.SecondsHandColor];
            delete finalSettings[messageKeys.MonthHandColor];
            delete finalSettings[messageKeys.SubDialColor];
            delete finalSettings[messageKeys.DateColor];
            delete finalSettings[messageKeys.BatteryLineColor];
            delete finalSettings[messageKeys.BTQTColor];

            delete finalSettings[messageKeys.WeatherProv];
            delete finalSettings[messageKeys.Lat];
            delete finalSettings[messageKeys.Long];
            delete finalSettings[messageKeys.LocationQuery];
            delete finalSettings[messageKeys.TZ_CODE];
            delete finalSettings[messageKeys.TZ_MODE];
            delete finalSettings[messageKeys.TZ_ID];


            sendAppMessage(finalSettings);
        });
        
    }
        
    else {
        var settings = clay.getSettings(e.response);

       applyTimezone(settings)
        .then(applyWeather)
        
        .then(function(finalSettings) {
            delete finalSettings[messageKeys.APIKEY_User];

            delete finalSettings[messageKeys.WeatherProv];
            delete finalSettings[messageKeys.Lat];
            delete finalSettings[messageKeys.Long];
            delete finalSettings[messageKeys.LocationQuery];
            delete finalSettings[messageKeys.TZ_CODE];
            delete finalSettings[messageKeys.TZ_MODE];
            delete finalSettings[messageKeys.TZ_ID];

            sendAppMessage(finalSettings);
        });
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

    // Refresh weather on launch if it's enabled, so the watch has fresh data before the next config save.
    refreshWeatherFromStorage();

    // If a timezone was previously saved, update the watch with fresh offset data
    if (settings && settings.TZ_ID && settings.TZ_ID !== "" && settings.TZ_ID !== "undefined") {
        tz.get(settings.TZ_ID).then(function(msg) {
            sendAppMessage(msg);
        }).catch(function(err) {
            console.error("Unable to get offset for " + settings.TZ_ID + " on startup: " + err.message);
        });
    }
});

// The watch periodically sends a dummy AppMessage (a single uint8 at key 0) to ask the phone for a fresh weather reading - see tick_handler()'s s_countdown logic in nomos.c. 
Pebble.addEventListener('appmessage', function(e) {
    console.debug("Received app message: " + JSON.stringify(e.payload, null, 2));
    refreshWeatherFromStorage();
});