// Fetches current weather conditions (icon + temperature) from either Open-Meteo (no API key needed) or OpenWeatherMap (needs a free API key).
//
// ---- Weather code / icon mapping ------------------------------------
// Maps each provider's weather codes onto the icon-font indices used by
// the watchface. 0 = unknown/no icon. Extend these tables to taste -
// they only need to cover the codes you actually want distinct icons for.

var WEATHER_MAX = 118;

function clampIcon(idx) {
    var n = parseInt(idx, 10);
    if (isNaN(n) || n < 0 || n > WEATHER_MAX) {
        return 0;
    }
    return n;
}

// Open-Meteo "weathercode,is_day" -> icon index
// Columns are day (is_day=1) and night (is_day = 0)
var ds_iconToId = {
    '0,1': 101, '0,0': 102,   // clear sky
    '1,1': 103, '1,0': 104,   // mainly clear
    '2,1': 105, '2,0': 106,   // partly cloudy
    '3,1': 110, '3,0': 110,   // overcast
    '45,1': 90, '45,0': 90,   // fog
    '48,1': 90, '48,0': 90,   // freezing fog
    '51,1': 37, '51,0': 38,   // light drizzle
    '53,1': 24, '53,0': 24,   // moderate drizzle
    '55,1': 34, '55,0': 34,   // dense drizzle
    '56,1': 24, '56,0': 24,   // light freezing drizzle
    '57,1': 34, '57,0': 34,   // dense freezing drizzle
    '61,1': 34, '61,0': 40,   // slight rain
    '63,1': 46, '63,0': 46,   // moderate rain
    '65,1': 46, '65,0': 46,   // heavy rain
    '66,1': 67, '66,0': 68,   // light freezing rain (sleet)
    '67,1': 66, '67,0': 66,   // heavy freezing rain (sleet)
    '71,1': 77, '71,0': 78,   // slight snow
    '73,1': 114,'73,0': 114,  // moderate snow
    '75,1': 63, '75,0': 63,   // heavy snow
    '77,1': 117,'77,0': 117,  // snow grains
    '80,1': 34, '80,0': 40,   // slight rain showers
    '81,1': 46, '81,0': 46,   // moderate rain showers
    '82,1': 58, '82,0': 58,   // violent rain showers
    '85,1': 77, '85,0': 78,   // slight snow showers
    '86,1': 79, '86,0': 79,   // heavy snow showers
    '95,1': 17, '95,0': 2,    // thunderstorm
    '96,1': 20, '96,0': 20,   // thunderstorm, slight hail
    '99,1': 20, '99,0': 20    // thunderstorm, heavy hail
};

function iconFromOpenMeteo(weatherCode, isDay) {
    var key = String(weatherCode) + ',' + (isDay ? '1' : '0');
    var result = ds_iconToId[key];
    return clampIcon(result !== undefined ? result : 0);
}

// OpenWeatherMap "id" + "icon suffix" (e.g. "800" + "d") -> icon index.
// Columns are day (d) and night (n)
var owm_iconToId = {
    '800d': 101, '800n': 102,               // clear sky
    '801d': 103, '801n': 104,               // few clouds
    '802d': 105, '802n': 106,               // scattered clouds
    '803d': 107, '803n': 108,               // broken clouds
    '804d': 109, '804n': 110,               // overcast clouds
    '200d': 9,   '200n': 10,                // thunderstorm w/ light rain
    '201d': 9,   '201n': 10,
    '202d': 11,  '202n': 12,
    '210d': 7,   '210n': 8,
    '211d': 9,   '211n': 10,
    '212d': 11,  '212n': 12,
    '221d': 13,  '221n': 14,
    '230d': 15,  '230n': 16,
    '231d': 17,  '231n': 18,
    '232d': 19,  '232n': 20,
    '300d': 21,  '300n': 22,                // drizzle
    '301d': 23,  '301n': 24,
    '302d': 25,  '302n': 26,
    '310d': 27,  '310n': 28,
    '311d': 29,  '311n': 30,
    '312d': 31,  '312n': 32,
    '313d': 33,  '313n': 34,
    '314d': 35,  '314n': 36,
    '321d': 37,  '321n': 38,
    '500d': 39,  '500n': 40,                // light rain
    '501d': 41,  '501n': 42,                // moderate rain
    '502d': 43,  '502n': 44,                // heavy rain
    '503d': 45,  '503n': 46,                // very heavy rain
    '504d': 47,  '504n': 48,                // extreme rain
    '511d': 49,  '511n': 50,                // freezing rain
    '520d': 51,  '520n': 52,
    '521d': 53,  '521n': 54,
    '522d': 55,  '522n': 56,
    '531d': 57,  '531n': 58,
    '600d': 59,  '600n': 60,                // light snow
    '601d': 61,  '601n': 62,                // snow
    '602d': 63,  '602n': 64,                // heavy snow
    '611d': 65,  '611n': 66,                // sleet
    '612d': 67,  '612n': 68,
    '613d': 69,  '613n': 70,
    '615d': 71,  '615n': 72,
    '616d': 73,  '616n': 74,
    '620d': 75,  '620n': 76,
    '621d': 77,  '621n': 78,
    '622d': 79,  '622n': 80,
    '701d': 81,  '701n': 82,                // mist
    '711d': 83,  '711n': 84,                // smoke
    '721d': 85,  '721n': 86,                // haze
    '731d': 87,  '731n': 88,                // dust/sand whirls
    '741d': 89,  '741n': 90,                // fog
    '751d': 91,  '751n': 92,                // sand
    '761d': 93,  '761n': 94,                // dust
    '762d': 95,  '762n': 96,                // volcanic ash
    '771d': 97,  '771n': 98,                // squalls
    '781d': 99,  '781n': 100                // tornado
};

function iconFromOWM(id, iconSuffix) {
    var key = String(id) + String(iconSuffix);
    var result = owm_iconToId[key];
    return clampIcon(result !== undefined ? result : 0);
}

// ---- Networking helper -------------------------------------------------

function xhrGetJSON(url, timeoutMs) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        var timeoutId = setTimeout(function() {
            xhr.abort();
            reject(new Error('Weather request timed out'));
        }, timeoutMs || 10000);

        xhr.onload = function() {
            clearTimeout(timeoutId);
            if (xhr.status === 200) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(new Error('Failed to parse weather response: ' + e.message));
                }
            } else {
                reject(new Error('Weather GET failed with status ' + xhr.status));
            }
        };
        xhr.onerror = function() {
            clearTimeout(timeoutId);
            reject(new Error('Weather GET network error'));
        };

        xhr.open('GET', url);
        xhr.send();
    });
}

// ---- Location helper -----------------------------------------------------
// Uses manual lat/lon if provided, otherwise falls back to device geolocation

function resolveLocation(lat, lon) {
    return new Promise(function(resolve, reject) {
        if (lat !== undefined && lat !== null && lat !== '' &&
            lon !== undefined && lon !== null && lon !== '') {
            resolve({ lat: parseFloat(lat), lon: parseFloat(lon) });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function(pos) {
                resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            },
            function(err) {
                reject(new Error('Geolocation failed: ' + err.message));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    });
}

// ---- Provider fetchers ---------------------------------------------------

// Rain is considered "likely in the next hour" once the provider's
// precipitation probability for that hour reaches this percentage.
// 30 = 30% chance of rain
var RAIN_THRESHOLD_PERCENT = 30;

function fetchOpenMeteo(lat, lon, useFahrenheit) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,weather_code,is_day' +
        '&daily=temperature_2m_max,temperature_2m_min' +
        '&hourly=precipitation_probability' +
        '&forecast_days=2' +
        '&timezone=auto' +
        '&timeformat=unixtime';

    return xhrGetJSON(encodeURI(url)).then(function(json) {
        var tempC = json.current.temperature_2m;
        var temp = useFahrenheit ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);
        var icon = iconFromOpenMeteo(json.current.weather_code, json.current.is_day);

        var highC = json.daily.temperature_2m_max[0];
        var lowC = json.daily.temperature_2m_min[0];
        var high = useFahrenheit ? Math.round((highC * 9 / 5) + 32) : Math.round(highC);
        var low = useFahrenheit ? Math.round((lowC * 9 / 5) + 32) : Math.round(lowC);

        // `hourly` is indexed by hour-of-day starting at local midnight
        // today (timezone=auto), for 48 hours (forecast_days=2, giving
        // headroom for the +1 lookup even at 23:xx). Next hour's index is
        // simply "current local hour + 1".
        var nextHourIdx = new Date().getHours() + 1;
        var probs = (json.hourly && json.hourly.precipitation_probability) || [];
        var rainChance = (typeof probs[nextHourIdx] === 'number') ? probs[nextHourIdx] : 0;

        return { icon: icon, temp: temp, high: high, low: low, rainChance: rainChance };
    });
}

function fetchOpenWeatherMap(lat, lon, apiKey, useFahrenheit) {
    var units = useFahrenheit ? 'imperial' : 'metric';

    // One Call 3.0 returns current conditions, hourly, and the daily
    // forecast in a single response, so IconNow/WeatherTemp, TempFore, and
    // RainSoon all come from one request. Note: One Call 3.0 requires the
    // caller's OWM account to be subscribed to the "One Call by Call" plan
    // (it has its own free tier of 1,000 calls/day, but it's opt-in
    // separately from a plain API key) - otherwise this will fail with a
    // 401.
    var url = 'https://api.openweathermap.org/data/3.0/onecall' +
        '?lat=' + lat + '&lon=' + lon +
        '&units=' + units +
        '&exclude=minutely,alerts' +
        '&appid=' + apiKey;

    return xhrGetJSON(encodeURI(url)).then(function(json) {
        var temp = Math.round(json.current.temp);
        var iconSuffix = json.current.weather[0].icon.slice(-1); // 'd' or 'n'
        var icon = iconFromOWM(json.current.weather[0].id, iconSuffix);

        // daily[0] is today.
        var high = Math.round(json.daily[0].temp.max);
        var low = Math.round(json.daily[0].temp.min);

        // hourly[0] is the current hour, hourly[1] is the next hour
        // `pop` is probability of precipitation as a 0-1 fraction, so *100 to get same value as Open-Meteo
        var hourly = json.hourly || [];
        var rainChance = hourly[1] ? Math.round((hourly[1].pop || 0) * 100) : 0;

        return {
            icon: icon,
            temp: temp,
            high: high,
            low: low,
            rainChance: rainChance
        };
    });
}

// ---- Public API ------------------------------------------------------

// get(settings) -> Promise resolving to
// { icon: <number>, temp: "<string>", tempFore: "<string>", rainSoon: <0|1> }.
//
//   UseWeather   (bool)   - master on/off switch
//   WeatherProv  ('ds' | 'owm') - 'ds' = Open-Meteo, 'owm' = OpenWeatherMap
//   Lat, Long    (string/number, optional) - manual location, else GPS
//   WeatherUnit  (bool)   - falsy = Celsius, truthy = Fahrenheit
//   APIKEY_User  (string) - required only when WeatherProv === 'owm'

var getWeather = function(settings) {
    var useWeather = settings && settings.UseWeather;

    if (!useWeather) {
        console.log("Weather disabled - icon=0 temp=-- tempFore=--|-- rainSoon=0");
        return Promise.resolve({ icon: 0, temp: '--', tempFore: '--|--', rainSoon: 0 });
    }

    var useFahrenheit = !!settings.WeatherUnit;
    var provider = settings.WeatherProv || 'ds';
    var lat = settings.Lat;
    var lon = settings.Long;
    var apiKey = settings.APIKEY_User;

    return resolveLocation(lat, lon).then(function(loc) {
        if (provider === 'owm') {
            if (!apiKey) {
                return Promise.reject(new Error('OpenWeatherMap selected but no API key set'));
            }
            return fetchOpenWeatherMap(loc.lat, loc.lon, apiKey, useFahrenheit);
        }
        return fetchOpenMeteo(loc.lat, loc.lon, useFahrenheit);
    }).then(function(result) {
        var rainSoon = result.rainChance >= RAIN_THRESHOLD_PERCENT ? 1 : 0;

        console.log("Weather fetched (" + provider + ") - icon=" + result.icon +
            " temp=" + result.temp + " high=" + result.high + " low=" + result.low +
            " rainChance=" + result.rainChance + "% rainSoon=" + rainSoon);
        return {
            icon: result.icon,
            temp: String(result.temp),
            tempFore: String(result.high) + ' | ' + String(result.low),
            rainSoon: rainSoon
        };
    });
};

module.exports = {
    get: getWeather
};