var keys = require('message_keys');

// UTC offsets run from -12:00 to +14:00; anything outside that means a bad calculation.
var MIN_OFFSET_SECONDS = -12 * 3600;
var MAX_OFFSET_SECONDS = 14 * 3600;

// Current offset of `timezone` from UTC, in seconds, calculated on the phone.
// Formats "now" as wall-clock parts in the target zone, reads those parts back as
// if they were UTC, and takes the difference. Throws for an unknown zone.
var offsetSecondsFromIntl = function(timezone, date) {
    var v = {};
    new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(date).forEach(function(part) {
        v[part.type] = parseInt(part.value, 10);
    });

    // % 24 because some engines still report midnight as hour 24
    var wallClockAsUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour % 24, v.minute, v.second);
    var offset = Math.round((wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 1000);

    if (isNaN(offset) || offset < MIN_OFFSET_SECONDS || offset > MAX_OFFSET_SECONDS) {
        throw new Error("Calculated offset out of valid range: " + offset);
    }
    return offset;
};

// Fallback for phones whose JS engine can't do the calculation above.
var offsetSecondsFromTimeAPI = function(timezone) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        var timeoutId = setTimeout(function() {
            xhr.abort();
            reject(new Error("Timezone offset request timed out"));
        }, 8000);

        xhr.onload = function() {
            clearTimeout(timeoutId);
            if (xhr.status !== 200) {
                reject(new Error('Timezone GET failed with error ' + xhr.status + ' ' + xhr.statusText));
                return;
            }
            try {
                resolve(JSON.parse(xhr.responseText).currentUtcOffset.seconds);
            } catch (e) {
                reject(new Error("Failed to parse timezone response"));
            }
        };

        xhr.onerror = function() {
            clearTimeout(timeoutId);
            reject(new Error("Failed to make timezone GET request"));
        };

        xhr.open('GET', 'https://timeapi.io/api/TimeZone/zone?timeZone=' + encodeURIComponent(timezone));
        xhr.send();
    });
};

// Resolves to an AppMessage payload { TZ_OFFSET: <seconds> }; tries the local calculation first.
var getTimezoneOffset = function(timezone) {
    return new Promise(function(resolve) {
        resolve(offsetSecondsFromIntl(timezone, new Date()));
    }).catch(function(e) {
        console.log("[TZ] Local calculation failed for " + timezone + ", trying API: " + e.message);
        return offsetSecondsFromTimeAPI(timezone);
    }).then(function(seconds) {
        var msg = {};
        msg[keys.TZ_OFFSET] = seconds;
        return msg;
    });
};

module.exports = {
    get: getTimezoneOffset
};