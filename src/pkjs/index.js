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
// Watches that show weather (HAS_WEATHER in nomos.c; the weather section of config.js): all of them.
// Kept as a flag so a platform can easily be left out again.
var hasWeather = true;

// Keys the watch never reads. Clay needs them (config.js items / weather.js inputs),
// but sending them would only use up AppMessage space.
var PHONE_ONLY_KEYS = [
    'APIKEY_User', 'WeatherProv', 'Lat', 'Long', 'LocationQuery', 'WeatherUnit',
    'TZ_ID', 'TZ_ID_STATE', 'SlotTZ1', 'SlotTZ3', 'SlotTZ4', 'SlotTZState1', 'SlotTZState3', 'SlotTZState4',
    'PreviewPlatformOverride', 'PicColorMemory', 'CustomColourMemory'
];

// Keys aplite never uses (its complications offer only time, battery, weather, forecast, custom
// text and date). Dropped
// for aplite so its messages fit its small inbox.
var APLITE_SKIP_KEYS = [
    'Sunrise', 'Sunset', 'UVNow', 'UVMax', 'PrecipChance', 'PrecipAmount', 'PrecipInches',
    'SlotLabel1', 'SlotLabel3', 'SlotLabel4', 'SlotOffset1', 'SlotOffset3', 'SlotOffset4',
    // aplite keeps the original fixed top layout: no complication slots, text rows or timeline pins
    'TopSlot1', 'TopSlot2', 'TopDate1', 'TopDate2', 'TextRow1', 'TextRow2', 'TextRowDate1', 'TextRowDate2',
    'SlotText1', 'SlotText2', 'SlotText3', 'SlotText4', 'ShowAMPM', 'LeadingZero12', 'LeadingZero24',
    'StepSeparator', 'StepTarget', 'BWBottomColor', 'TimelinePins'
];

// Keys that only matter on colour watches. To minimise the number of keys sent to
// APLITE (and the other B&W watches) these are dropped for isbw platforms.
var COLOUR_ONLY_KEYS = [
    'ThemeSelect', 'BackgroundColor1', 'MinuteHandShadowColor', 'MajorTickColor',
    'MinorTickColor', 'HourDigitsColor', 'MinutesHandColor', 'SecondsHandColor',
    'MonthHandColor', 'SubDialColor', 'DateColor', 'BatteryLineColor', 'BTQTColor',
    'BackgroundStyle', 'BatteryWeatherColor', 'BottomColor', 'HourHandColor',
    'PicColor1', 'PicColor2', 'PicColor3', 'PicColor4', 'PicColor5', 'PicColor6', 'PicColor7'
];

// Each complication slot's own settings, which only matter while the slot shows that kind of
// item: custom text (11), a time zone (9; 10 in test builds) or the date (12). The others are left
// out of the message to keep it within the watch's inbox; the watch keeps what it had for them.
var SLOT_KEYS = [
    { kind: 'TopSlot1', text: 'SlotText1', label: 'SlotLabel1', offset: 'SlotOffset1', date: 'TopDate1' },
    { kind: 'TopSlot2', date: 'TopDate2' },
    { kind: 'TextRow1', text: 'SlotText3', label: 'SlotLabel3', offset: 'SlotOffset3', date: 'TextRowDate1' },
    { kind: 'TextRow2', text: 'SlotText4', label: 'SlotLabel4', offset: 'SlotOffset4', date: 'TextRowDate2' }
];
var stripUnusedSlotKeys = function(msg) {
    SLOT_KEYS.forEach(function(slot) {
        var kind = String(msg[messageKeys[slot.kind]]);
        if (kind !== '11' && slot.text) delete msg[messageKeys[slot.text]];
        if (kind !== '12') delete msg[messageKeys[slot.date]];
        if (slot.label && kind !== '9' && kind !== '10') {
            delete msg[messageKeys[slot.label]];
            delete msg[messageKeys[slot.offset]];
        }
    });
    return msg;
};

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

// clay.getSettings() replaces everything saved on the phone with just the settings that were
// on the page - and the page only shows the items for the current watch. So saving on aplite
// would wipe the weather settings (OWM API key, location...), colours and background picture
// that only exist on colour / weather watches, and they'd come back blank on the next emery.
// This puts back any previously saved setting that wasn't on the page this time. Settings that
// were on the page are kept exactly as submitted (so clearing a field still clears it).
var restoreSettingsNotOnPage = function(before) {
    var after = readStoredSettings();
    if (!before || !after) return;
    var missing = {};
    Object.keys(before).forEach(function(name) {
        if (!after.hasOwnProperty(name)) {
            missing[name] = before[name];
        }
    });
    if (Object.keys(missing).length) {
        clay.setSettings(missing);
    }
};

// ---- Settings remembered per watch ----
// Each watch keeps its own settings on the watch itself, but Clay keeps just one saved copy on
// the phone ('clay-settings'), from whichever watch saved last, and the settings page always
// opens with that copy. So a blue-themed basalt would show (and on Save, receive) the emery's
// black & green. To avoid that, a copy of each watch's settings is also kept under
// WATCH_SETTINGS_PREFIX + its ID, and swapped into 'clay-settings' when the page opens.
// SHARED_KEYS are the exception: they belong to the user rather than the watch, so the latest
// value is used on every watch. A watch that has never saved settings starts from the last
// saved settings (from whichever watch that was).
var WATCH_SETTINGS_PREFIX = 'tangent-watch-settings:';
var SHARED_KEYS = [
    'APIKEY_User', 'WeatherProv', 'LocationQuery', 'Lat', 'Long',   // weather account & location
    'WeatherUnit',                                                   // temperature unit
    'TZ_ID', 'TZ_ID_STATE'                                           // the sub-dial's 2nd timezone
];

// This watch's ID: the phone's per-watch token if it provides one, otherwise its model.
var watchId = function() {
    try {
        var token = Pebble.getWatchToken && Pebble.getWatchToken();
        if (token) return 'watch:' + token;
    } catch (err) {
        console.error("No watch token available: " + err);
    }
    var info = (Pebble.getActiveWatchInfo && Pebble.getActiveWatchInfo()) || {};
    return 'model:' + (info.model || Pebble_platform);
};

var readWatchSettings = function() {
    try {
        var json = localStorage.getItem(WATCH_SETTINGS_PREFIX + watchId());
        return json ? JSON.parse(json) : null;
    } catch (err) {
        console.error("Error reading this watch's saved settings: " + err);
        return null;
    }
};

// Remembers the current saved settings (minus the shared ones) as this watch's settings.
var saveWatchSettings = function() {
    var all = readStoredSettings();
    if (!all) return;
    var own = {};
    Object.keys(all).forEach(function(name) {
        if (SHARED_KEYS.indexOf(name) < 0) own[name] = all[name];
    });
    try {
        localStorage.setItem(WATCH_SETTINGS_PREFIX + watchId(), JSON.stringify(own));
    } catch (err) {
        console.error("Error saving this watch's settings: " + err);
    }
};

// The settings for this watch: the last saved settings, with this watch's own values on top
// (shared settings always come from the last save, whichever watch that was).
var settingsForThisWatch = function() {
    var settings = readStoredSettings();
    if (!settings) return null;
    var own = readWatchSettings();
    if (own) {
        Object.keys(own).forEach(function(name) {
            if (SHARED_KEYS.indexOf(name) < 0) settings[name] = own[name];
        });
    } else {
        // A watch's first time: it starts from the last watch's settings, but "My previous custom
        // colours" are that watch's, not this one's (they start as whatever this watch saves)
        delete settings.CustomColourMemory;
    }
    return settings;
};

Pebble.addEventListener('showConfiguration', function(e) {
    // Open the page with this watch's settings rather than the last watch's.
    var settings = settingsForThisWatch();
    if (settings) {
        // The hour hand got its own colour in 4.3. Until it has been saved once, start its
        // picker at the minute hand's colour, so saving doesn't suddenly change the hour hand.
        if (settings.HourHandColor === undefined && settings.MinutesHandColor !== undefined) {
            settings.HourHandColor = settings.MinutesHandColor;
        }
        if (settings.BWHourHandColor === undefined && settings.BWMinHandBatLineColor !== undefined) {
            settings.BWHourHandColor = settings.BWMinHandBatLineColor;
        }
        // The two top complication slots replaced "Battery Value visible", "Show Current" and
        // "Show Forecast" in 4.10: until they've been saved, start them showing what those did
        if (settings.TopSlot1 === undefined) {
            settings.TopSlot1 = (settings.UseWeather && settings.ShowCurrent !== false) ? "13" :
                                settings.EnableBattery === false ? "0" : "3";
        }
        if (settings.TopSlot2 === undefined) {
            settings.TopSlot2 = settings.ShowForecast === false ? "0" : "14";
        }
        localStorage.setItem('clay-settings', JSON.stringify(settings));
    }
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
// The sub-dial's 2nd timezone, and each complication slot's own (the top slot and the two text
// rows; aplite has none of those): which settings hold each zone, and which message key carries
// its offset to the watch.
var TIMEZONES = [
    { idKey: 'TZ_ID', stateKey: 'TZ_ID_STATE', offsetKey: 'TZ_OFFSET' },
    { idKey: 'SlotTZ1', stateKey: 'SlotTZState1', offsetKey: 'SlotOffset1', slot: true },
    { idKey: 'SlotTZ3', stateKey: 'SlotTZState3', offsetKey: 'SlotOffset3', slot: true },
    { idKey: 'SlotTZ4', stateKey: 'SlotTZState4', offsetKey: 'SlotOffset4', slot: true }
];

// A zone's current offset as a message for the watch, under `offsetKey`. Never rejects:
// -1 (the watch's "unknown") if it can't be worked out.
var timezoneOffsetMessage = function(zone, offsetKey) {
    var msg = {};
    return tz.get(zone).then(function(partial) {
        msg[messageKeys[offsetKey]] = partial[messageKeys.TZ_OFFSET];
        return msg;
    }).catch(function(err) {
        console.error("Unable to get offset for " + zone + ": " + err.message);
        msg[messageKeys[offsetKey]] = -1;
        return msg;
    });
};

var applyTimezone = function(settings) {
    return Promise.all(TIMEZONES.map(function(t) {
        var zone = settings[messageKeys[t.stateKey]] || settings[messageKeys[t.idKey]];
        if (!zone || zone === "undefined") {
            settings[messageKeys[t.offsetKey]] = 0;   // timezone not chosen
            return null;
        }
        return timezoneOffsetMessage(zone, t.offsetKey).then(function(msg) {
            Object.keys(msg).forEach(function(k) { settings[k] = msg[k]; });
        });
    })).then(function() { return settings; });
};

var NO_WEATHER = { icon: 0, temp: "--", tempFore: "--|--", rainSoon: 0, rainAmount: 0, wbgtLevel: 0,
                   sunrise: -1, sunset: -1, uvNow: -1, uvMax: -1, precipChance: -1, precipTenthMm: -1 };

// Copies a weather.get() result onto `msg` under the message keys the watch expects.
var weatherToMessage = function(result, msg) {
    msg[messageKeys.IconNow] = result.icon;
    msg[messageKeys.WeatherTemp] = result.temp;
    msg[messageKeys.TempFore] = result.tempFore;
    msg[messageKeys.RainSoon] = result.rainSoon;
    msg[messageKeys.RainAmount] = result.rainAmount;
    msg[messageKeys.WBGTLevel] = result.wbgtLevel;
    // For the text rows (-1 = unknown); aplite doesn't take these (APLITE_SKIP_KEYS)
    if (Pebble_platform !== 'aplite') {
        msg[messageKeys.Sunrise] = result.sunrise;
        msg[messageKeys.Sunset] = result.sunset;
        msg[messageKeys.UVNow] = result.uvNow;
        msg[messageKeys.UVMax] = result.uvMax;
        msg[messageKeys.PrecipChance] = result.precipChance;
        msg[messageKeys.PrecipAmount] = result.precipTenthMm;
    }
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
        // Often the first fetch after saving fails because the phone is still asking the user to
        // allow internet or location access (see usesPermissions in package.json), so try again soon
        retryWeatherSoon();
        return weatherToMessage(NO_WEATHER, settings);
    });
};

// After a failed fetch on saving: try again after 20 seconds, then 1 and 3 minutes, stopping at
// the first success (the watch's own schedule takes over after that)
var WEATHER_RETRY_DELAYS_MS = [20000, 60000, 180000];
var weatherRetryTimer = null;
var retryWeatherSoon = function() {
    if (weatherRetryTimer) clearTimeout(weatherRetryTimer);
    var attempt = 0;
    var tryAgain = function() {
        weatherRetryTimer = null;
        var settings = settingsForThisWatch();
        if (!hasWeather || !settings || !settings.UseWeather) return;
        weather.get(settings).then(function(result) {
            console.log("Weather retry " + (attempt + 1) + " worked");
            sendAppMessage(weatherToMessage(result, {}));
        }).catch(function(err) {
            console.error("Weather retry " + (attempt + 1) + " failed: " + err.message);
            attempt++;
            if (attempt < WEATHER_RETRY_DELAYS_MS.length) {
                weatherRetryTimer = setTimeout(tryAgain, WEATHER_RETRY_DELAYS_MS[attempt]);
            }
        });
    };
    weatherRetryTimer = setTimeout(tryAgain, WEATHER_RETRY_DELAYS_MS[0]);
};

// Fetches weather using `settings` (friendly string-keyed, same shape clay
// persists in localStorage) and pushes it to the watch. Used on app launch
// (if enabled) and whenever the watch asks for a refresh.
var refreshWeather = function(settings) {
    // hasWeather: settings saved on an emery are kept when this phone talks to an aplite
    // (see restoreSettingsNotOnPage), so UseWeather alone doesn't mean this watch has weather.
    if (!hasWeather || !settings || !settings.UseWeather) {
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

    var before = readStoredSettings();
    var submitted = clay.getSettings(e.response);   // also replaces the saved settings
    restoreSettingsNotOnPage(before);
    saveWatchSettings();

    var pending = applyTimezone(submitted);
    if (hasWeather) {
        pending = pending.then(applyWeather);
    }

    pending.then(function(finalSettings) {
        stripKeys(finalSettings, PHONE_ONLY_KEYS);
        if (isbw) {
            stripKeys(finalSettings, COLOUR_ONLY_KEYS);
        }
        if (Pebble_platform === 'aplite') {
            stripKeys(finalSettings, APLITE_SKIP_KEYS);
        }
        stripUnusedSlotKeys(finalSettings);
        sendAppMessage(finalSettings);
        updatePhoneBattery(settingsForThisWatch());
        updateAppComplications(settingsForThisWatch());
    });
});

// ---- Phone battery (complication kind 15) ----
// Read from the Pebble app's built-in phone plugin (phone/phone_state, battery_level: Pebble app
// 2.0 or later; on iOS it only moves in 5% steps). Subscribed only while a complication shows it;
// the subscription lasts while this PKJS runs, and the watch shows "--" while the phone is away.
var PHONE_BATTERY_KIND = '15';
var phoneBatterySubscription = null;
var phoneBatterySent = null;

function phoneBatteryWanted(settings) {
    if (!settings) return false;
    var rowsOn = String(settings.SubDialChoice) === '0';
    return [settings.TopSlot1, settings.TopSlot2].some(function(k) { return String(k) === PHONE_BATTERY_KIND; }) ||
           (rowsOn && [settings.TextRow1, settings.TextRow2].some(function(k) { return String(k) === PHONE_BATTERY_KIND; }));
}

// Sends the level (0-100, or -1 for unknown) if it changed; retries a couple of times if the
// watch is busy with another message
function sendPhoneBattery(level, retries) {
    if (level === phoneBatterySent && retries === undefined) return;
    phoneBatterySent = level;
    var msg = {};
    msg[messageKeys.PhoneBattery] = level;
    Pebble.sendAppMessage(msg, function() {}, function() {
        var left = retries === undefined ? 2 : retries;
        if (left > 0 && phoneBatterySent === level) {
            setTimeout(function() { sendPhoneBattery(level, left - 1); }, 2000);
        }
    });
}

function updatePhoneBattery(settings) {
    var wanted = Pebble_platform !== 'aplite' && phoneBatteryWanted(settings);   // aplite has no complications
    if (!wanted) {
        if (phoneBatterySubscription) {
            phoneBatterySubscription.unsubscribe();
            phoneBatterySubscription = null;
        }
        return;
    }
    if (phoneBatterySubscription) return;
    if (typeof Pebble.subscribeToSource !== 'function') {   // a Pebble app without plugins
        sendPhoneBattery(-1);
        return;
    }
    try {
        phoneBatterySubscription = Pebble.subscribeToSource({
            category: 'phone',
            item: 'phone_state',
            properties: ['battery_level'],
            onData: function(envelope) {
                var instance = envelope && envelope.instances && envelope.instances[0];
                var property = instance && instance.properties && instance.properties.battery_level;
                var number = property && property.numericValue;
                var level = number && typeof number.value === 'number' ? Math.round(number.value) : -1;
                sendPhoneBattery(level < 0 || level > 100 ? -1 : level);
            },
            onError: function(err) {
                // an error doesn't end the subscription: a later update can still come. A passing
                // one (TIMEOUT, RATE_LIMITED) keeps the last level; one that won't clear shows "--".
                var code = err && err.code;
                console.log('phone battery: ' + code);
                if (code === 'PERMISSION_DENIED' || code === 'PLUGIN_UNAVAILABLE' || code === 'INVALID_REQUEST') {
                    sendPhoneBattery(-1);
                }
            }
        });
    } catch (err) {
        console.error('phone battery subscription failed', err);
        phoneBatterySubscription = null;
        sendPhoneBattery(-1);
    }
}

// ---- The Pebble app's complications (complication kinds 16-20) ----
// The readings the user lists on the Pebble app's Plugins > Complications tab
// (preferences/complications), shown by position: kind 16 is the first, 20 the fifth. Whatever
// plugin answers (e.g. Muninn's battery estimate), its value goes to the watch as short text in
// AppText1-5, only while a complication shows it and only when it changes.
var APP_COMPLICATION_FIRST = 16;
var APP_COMPLICATION_COUNT = 5;
var APP_TEXT_MAX = 15;
var appPreferredSubscription = null;
var appPreferred = null;          // the user's list, once it's arrived
var appReadingSubscriptions = [];
var appWanted = [];               // which positions (0-4) a complication shows
var appTextSent = {};

function appComplicationsWanted(settings) {
    var wanted = [];
    if (!settings) return wanted;
    var kinds = [settings.TopSlot1, settings.TopSlot2];
    if (String(settings.SubDialChoice) === '0') kinds.push(settings.TextRow1, settings.TextRow2);
    kinds.forEach(function(k) {
        var n = parseInt(k, 10) - APP_COMPLICATION_FIRST;
        if (n >= 0 && n < APP_COMPLICATION_COUNT && wanted.indexOf(n) === -1) wanted.push(n);
    });
    return wanted;
}

function sendAppText(n, text, retries) {
    text = String(text || '').slice(0, APP_TEXT_MAX);
    if (appTextSent[n] === text && retries === undefined) return;
    appTextSent[n] = text;
    var msg = {};
    msg[messageKeys['AppText' + (n + 1)]] = text;
    Pebble.sendAppMessage(msg, function() {}, function() {
        var left = retries === undefined ? 2 : retries;
        if (left > 0 && appTextSent[n] === text) {
            setTimeout(function() { sendAppText(n, text, left - 1); }, 2000);
        }
    });
}

function shortTextOf(payloads) {
    return payloads && payloads.shortText ? payloads.shortText.text : '';
}

// One reading as short text: its own short text, else its number (and unit), time or yes/no
function appReadingText(payloads) {
    if (!payloads) return '';
    if (payloads.shortText && payloads.shortText.text) return payloads.shortText.text;
    var number = payloads.numericValue;
    if (number && typeof number.value === 'number') {
        var v = number.value;
        var shown = Math.abs(v) < 100 && Math.round(v) !== v ? (Math.round(v * 10) / 10) : Math.round(v);
        var unit = number.unit && number.unit !== 'ms' ? String(number.unit).trim() : '';
        // a space before a unit that's a word ("2 DAYS", "5 KM"); symbols stay joined ("4.6%", "21°")
        return shown + (/^[A-Za-z]/.test(unit) ? ' ' : '') + unit;
    }
    if (payloads.timestamp && typeof payloads.timestamp.value === 'number') {
        var when = new Date(payloads.timestamp.value * 1000);
        var pad = function(x) { return (x < 10 ? '0' : '') + x; };
        return pad(when.getHours()) + ':' + pad(when.getMinutes());
    }
    if (payloads.boolean) return payloads.boolean.value ? 'YES' : 'NO';
    if (payloads.longText && payloads.longText.text) return payloads.longText.text;
    return '';
}

function subscribeAppReadings() {
    appReadingSubscriptions.forEach(function(sub) { try { sub.unsubscribe(); } catch (e) {} });
    appReadingSubscriptions = [];
    if (!appPreferred) return;
    appWanted.forEach(function(n) {
        var reading = appPreferred[n];
        if (!reading || !reading.category || !reading.item || !reading.property) {
            sendAppText(n, '');   // nothing in that position of the list: the watch shows "--"
            return;
        }
        try {
            appReadingSubscriptions.push(Pebble.subscribeToSource({
                category: reading.category,
                item: reading.item,
                properties: [reading.property],
                onData: function(envelope) {
                    var list = (envelope && envelope.instances) || [];
                    var instance = list[reading.index] || list[0];
                    var payloads = instance && instance.properties && instance.properties[reading.property];
                    sendAppText(n, appReadingText(payloads));
                },
                onError: function(err) {
                    var code = err && err.code;
                    console.log('complication ' + (n + 1) + ': ' + code);
                    if (code === 'PERMISSION_DENIED' || code === 'PLUGIN_UNAVAILABLE' || code === 'INVALID_REQUEST') {
                        sendAppText(n, '');
                    }
                }
            }));
        } catch (err) {
            console.error('complication ' + (n + 1) + ' subscription failed', err);
        }
    });
}

function updateAppComplications(settings) {
    appWanted = Pebble_platform === 'aplite' ? [] : appComplicationsWanted(settings);   // aplite has no complications
    if (!appWanted.length) {
        if (appPreferredSubscription) { try { appPreferredSubscription.unsubscribe(); } catch (e) {} }
        appPreferredSubscription = null;
        appPreferred = null;
        subscribeAppReadings();
        return;
    }
    if (typeof Pebble.subscribeToSource !== 'function') {   // a Pebble app without plugins
        appWanted.forEach(function(n) { sendAppText(n, ''); });
        return;
    }
    if (appPreferredSubscription) {
        subscribeAppReadings();
        return;
    }
    try {
        appPreferredSubscription = Pebble.subscribeToSource({
            category: 'preferences',
            item: 'complications',
            onData: function(envelope) {
                appPreferred = ((envelope && envelope.instances) || []).map(function(instance) {
                    var p = instance.properties || {};
                    return {
                        category: shortTextOf(p.category),
                        item: shortTextOf(p.item),
                        index: p.index && p.index.numericValue ? p.index.numericValue.value : 0,
                        property: shortTextOf(p.property)
                    };
                });
                subscribeAppReadings();
            },
            onError: function(err) { console.log('preferences/complications: ' + (err && err.code)); }
        });
    } catch (err) {
        console.error('preferences/complications subscription failed', err);
        appPreferredSubscription = null;
    }
}

Pebble.addEventListener('ready', function(e) {
    var settings = settingsForThisWatch();
    if (!settings) return;

    updatePhoneBattery(settings);
    updateAppComplications(settings);

    // Only refresh weather on launch if the user asked for that ("Refresh weather on launch").
    if (settings.RefreshWeatherOnLaunch) {
        refreshWeather(settings);
    }

    // Timezones previously saved: send the watch fresh offsets (daylight saving may have changed)
    TIMEZONES.forEach(function(t) {
        if (t.slot && Pebble_platform === 'aplite') return;
        var zone = settings[t.stateKey] || settings[t.idKey];
        if (zone && zone !== "undefined") {
            timezoneOffsetMessage(zone, t.offsetKey).then(function(msg) {
                // keep the offset the watch already has if this one couldn't be worked out
                if (msg[messageKeys[t.offsetKey]] !== -1) sendAppMessage(msg);
            });
        }
    });
});

// Phone-connection timeline log: the watch sends one of these per event
// (see the "Phone-connection timeline log" section in nomos.c).
var TETHER_EVENT_LOST = 0;

function payloadField(payload, name) {
    if (name in payload) {
        return payload[name];
    }
    var numeric = String(messageKeys[name]);
    return numeric in payload ? payload[numeric] : undefined;
}

var TETHER_EVENT_TEST = 2;

function insertConnectionPin(seq, type, timeSeconds) {
    console.log("tether: phone got event seq=" + seq + " type=" + type + " time=" + timeSeconds);
    var lost = type === TETHER_EVENT_LOST;
    var test = type === TETHER_EVENT_TEST;
    var pin = {
        // Unique per event; includes the time so a storage reset can't clash.
        id: 'tangent-bt-' + seq + '-' + timeSeconds,
        time: new Date(timeSeconds * 1000).toISOString(),
        layout: {
            type: 'genericPin',
            title: test ? 'Timeline test' : (lost ? 'Phone disconnected' : 'Phone reconnected'),
            subtitle: 'tangent',
            // Pins using WATCH_DISCONNECTED or GENERIC_CONFIRMATION were silently
            // dropped on this setup, so every pin uses NOTIFICATION_FLAG, which works.
            tinyIcon: 'system://images/NOTIFICATION_FLAG'
        }
    };
    if (typeof Pebble.insertTimelinePin !== 'function') {
        console.error("tether: this Pebble app doesn't support local timeline pins (no Pebble.insertTimelinePin)");
        return;
    }
    try {
        Pebble.insertTimelinePin(pin);
        console.log("tether: inserted pin " + pin.id + " \"" + pin.layout.title + "\" at " + pin.time);
    } catch (err) {
        console.error("tether: insertTimelinePin threw: " + err);
    }
}

// The watch periodically sends a dummy AppMessage (a single uint8 at key 0) to ask the phone for a fresh weather reading - see tick_handler()'s s_countdown logic in nomos.c.
// It also sends connection-log events (TetherSeq/TetherType/TetherTime), which become timeline pins and must not trigger a weather refresh.
Pebble.addEventListener('appmessage', function(e) {
    var payload = e.payload || {};
    console.debug("Received app message: " + JSON.stringify(payload, null, 2));
    var seq = payloadField(payload, 'TetherSeq');
    if (seq !== undefined) {
        // Only if the user has "Timeline pins for phone disconnections" on (the watch doesn't
        // send these when it's off, but an event queued before switching it off might still arrive).
        var settings = settingsForThisWatch() || {};
        if (settings.TimelinePins) {
            insertConnectionPin(seq, payloadField(payload, 'TetherType'), payloadField(payload, 'TetherTime'));
        } else {
            console.log("tether: timeline pins are off, ignoring event seq=" + seq);
        }
        return;
    }
    refreshWeather(settingsForThisWatch());
});