// Import the Clay package
//var Clay = require('pebble-clay');  //replaced with rebble clay
var Clay = require('@rebble/clay');
// Load Clay configuration file
var clayConfig = require('./config.js');
var tz = require('./timezones.js');
var weather = require('./weather.js');
var modifications = require('./modifications.js');
var messageKeys = require('message_keys');

var clay = new Clay(clayConfig, modifications, { autoHandleEvents: false });

var messageKeysLookup = {};
Object.keys(messageKeys).forEach(function(name) {
    messageKeysLookup[messageKeys[name]] = name;
});

var Pebble_platform = (Pebble.getActiveWatchInfo && Pebble.getActiveWatchInfo().platform) || 'aplite';
var isbw = (Pebble_platform === 'aplite' || Pebble_platform === 'diorite' || Pebble_platform === 'flint');

// Keys the watch never reads. Clay needs them (config.js items / weather.js inputs),
// but sending them would only use up AppMessage space.
var PHONE_ONLY_KEYS = [
    'APIKEY_User', 'WeatherProv', 'Lat', 'Long', 'LocationQuery', 'WeatherUnit',
    'TZ_ID', 'TZ_ID_STATE', 'PreviewPlatformOverride'
];

// Keys that only matter on colour watches. To minimise the number of keys sent to
// APLITE (and the other B&W watches) these are dropped for isbw platforms.
var COLOUR_ONLY_KEYS = [
    'IconNow', 'WeatherTemp', 'TempFore', 'RainSoon', 'WBGTLevel',
    'ThemeSelect', 'BackgroundColor1', 'MinuteHandShadowColor', 'MajorTickColor',
    'MinorTickColor', 'HourDigitsColor', 'MinutesHandColor', 'SecondsHandColor',
    'MonthHandColor', 'SubDialColor', 'DateColor', 'BatteryLineColor', 'BTQTColor'
];

// Removes the named keys from a numeric-keyed settings/message object.
var stripKeys = function(obj, names) {
    names.forEach(function(name) {
        delete obj[messageKeys[name]];
    });
    return obj;
};

// clay.getSettings(e.response) returns an object keyed by numeric
// message-key ID (e.g. settings[10062]). Several helpers (weather.js, and
// the webviewclosed logic below) are easier to read/reuse if they can
// instead work with friendly string names (settings.UseWeather) - the same
// shape the settings take once persisted to localStorage. This converts
// one to the other; keys with no registered message key pass through unchanged.
var toFriendlySettings = function(numericSettings) {
    var friendly = {};
    Object.keys(numericSettings).forEach(function(k) {
        friendly[messageKeysLookup[k] || k] = numericSettings[k];
    });
    return friendly;
};

// Settings as Clay persisted them (friendly string keys), or null if unreadable.
var readStoredSettings = function() {
    try {
        var json = localStorage.getItem('clay-settings');
        return json ? JSON.parse(json) : {};
    } catch (err) {
        console.error("Error parsing settings from localStorage: " + err);
        return null;
    }
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
            Object.keys(msg).forEach(function(k) {
                readable[(messageKeysLookup[k] || k) + " (" + k + ")"] = msg[k];
            });
            console.debug("Successfully sent message to watch: " + JSON.stringify(readable, null, 2));
        }, function(err) {
            console.error("AppMessage send failed: " + JSON.stringify(err));
        });
    } catch(e) {
        console.error("Pebble.sendAppMessage failed.", e);
    }
};

// Resolves the timezone portion of `settings` (mutates and returns a promise
// of the same settings object): sets TZ_OFFSET from the chosen zone. Never
// rejects - if the offset can't be worked out TZ_OFFSET is set to -1, which the
// watch treats as "unknown", so the AppMessage still gets built and sent.
var applyTimezone = function(settings) {
    var tzoffsetkey = messageKeys.TZ_OFFSET;
    var zone = settings[messageKeys.TZ_ID_STATE] || settings[messageKeys.TZ_ID];

    if (!zone || zone === "undefined") {
        // Timezone disabled or not selected
        settings[tzoffsetkey] = 0;
        return Promise.resolve(settings);
    }

    return tz.get(zone).then(function(partial) {
        settings[tzoffsetkey] = partial[tzoffsetkey];
        return settings;
    }).catch(function(err) {
        console.error("Unable to get offset for " + zone + ": " + err.message);
        settings[tzoffsetkey] = -1;
        return settings;
    });
};

var NO_WEATHER = { icon: 0, temp: "--", tempFore: "--|--", rainSoon: 0, wbgtLevel: 0 };

// Copies a weather.get() result onto `msg` under the message keys the watch expects.
var weatherToMessage = function(result, msg) {
    msg[messageKeys.IconNow] = result.icon;
    msg[messageKeys.WeatherTemp] = result.temp;
    msg[messageKeys.TempFore] = result.tempFore;
    msg[messageKeys.RainSoon] = result.rainSoon;
    msg[messageKeys.WBGTLevel] = result.wbgtLevel;
    return msg;
};

// Resolves the weather portion of `settings` (mutates and returns a promise
// of the same numeric-keyed settings object). Never rejects - on failure it
// leaves placeholder values so the AppMessage still gets built and sent.
var applyWeather = function(settings) {
    return weather.get(toFriendlySettings(settings)).then(function(result) {
        return weatherToMessage(result, settings);
    }).catch(function(err) {
        console.error("Unable to fetch weather: " + err.message);
        return weatherToMessage(NO_WEATHER, settings);
    });
};

// Fetches weather using `settings` (friendly string-keyed, same shape clay
// persists in localStorage) and pushes it to the watch. Used on app launch
// (if enabled) and whenever the watch asks for a refresh.
var refreshWeather = function(settings) {
    if (!settings || !settings.UseWeather) {
        return;
    }

    weather.get(settings).then(function(result) {
        sendAppMessage(weatherToMessage(result, {}));
    }).catch(function(err) {
        console.error("Unable to refresh weather: " + err.message);
    });
};

Pebble.addEventListener('webviewclosed', function(e) {
    if (!e || !e.response) return;

    var pending = applyTimezone(clay.getSettings(e.response));
    if (!isbw) {
        pending = pending.then(applyWeather);
    }

    pending.then(function(finalSettings) {
        stripKeys(finalSettings, PHONE_ONLY_KEYS);
        if (isbw) {
            stripKeys(finalSettings, COLOUR_ONLY_KEYS);
        }
        sendAppMessage(finalSettings);
    });
});

Pebble.addEventListener('ready', function(e) {
    var settings = readStoredSettings();
    if (!settings) return;

    // Only refresh weather on launch if the user asked for that ("Refresh weather on launch").
    if (settings.RefreshWeatherOnLaunch) {
        refreshWeather(settings);
    }

    // If a timezone was previously saved, update the watch with fresh offset data
    if (settings.TZ_ID && settings.TZ_ID !== "undefined") {
        tz.get(settings.TZ_ID).then(sendAppMessage).catch(function(err) {
            console.error("Unable to get offset for " + settings.TZ_ID + " on startup: " + err.message);
        });
    }
});

// The watch periodically sends a dummy AppMessage (a single uint8 at key 0) to ask the phone for a fresh weather reading - see tick_handler()'s s_countdown logic in nomos.c.
Pebble.addEventListener('appmessage', function(e) {
    console.debug("Received app message: " + JSON.stringify(e.payload, null, 2));
    refreshWeather(readStoredSettings());
});