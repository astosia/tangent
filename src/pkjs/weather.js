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

// ---- Wet Bulb Globe Temperature (WBGT) -----------------------------------
//
// WBGT = 0.7*Tnwb + 0.2*Tg + 0.1*Ta, where Tnwb is natural wet-bulb temp,
// Tg is black-globe temp, and Ta is plain air temp (all Celsius).
//
// The full Liljegren et al. (2008) method gets Tnwb and Tg by iterating a
// heat/mass-balance equation for a wetted wick and a black globe until they
// converge - it's the reference-accuracy method WBGT sensors are checked
// against, but it's overkill for a watchface (no iterative solver, no need
// to track atmospheric pressure to 3 decimal places).
//
// Instead this uses the Dimiceli/Piltz reduced model (Dimiceli, Piltz &
// Amburn, 2011; adopted operationally by NOAA/NWS for gridded WBGT via
// NDFD), which starts from the same Hunter & Minyard (1999) black-globe
// heat-balance equation Liljegren himself builds on, but linearizes it so
// Tg drops out in closed form instead of needing iteration - matches
// full Liljegren globe temps to within about 0.7 degC in their field tests.
// Tnwb still comes from Stull's (2011) psychrometric approximation, which
// is standalone and doesn't depend on wind/solar the way Liljegren's own
// wick-balance equation does; treat that piece as the main remaining gap
// vs "true" Liljegren.
//
// The three thresholds below turn WBGT into a 0-3 level:
//   0 = White/Green (safe)  -> no icon
//   1 = Yellow                -> first warning icon
//   2 = Red                   -> second warning icon
//   3 = Black                 -> highest warning icon
//
// There isn't one single official breakpoint set for these flag colours -
// sports bodies and heat-stress guidelines differ - the values below are a
// commonly used starting point (roughly the thresholds used by several US
// high-school athletics associations). Tune them to whatever standard you
// want to follow.
var WBGT_YELLOW_C = 27; // below this: White/Green, no icon
var WBGT_RED_C = 29;
var WBGT_BLACK_C = 32;

function saturationVaporPressureHPa(tempC) {
    // Buck equation, hPa, tempC in Celsius.
    return 6.112 * Math.exp((17.502 * tempC) / (240.97 + tempC));
}

// Fallback used only if a full calc isn't possible (e.g. missing data) -
// the old Australian BOM approximation: no solar, no wind.
function calcSimplifiedWBGT(tempC, relHumidityPercent) {
    var e = (relHumidityPercent / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
    return 0.567 * tempC + 0.393 * e + 3.94;
}

function wbgtLevelFromCelsius(wbgtC) {
    if (wbgtC >= WBGT_BLACK_C) return 3;
    if (wbgtC >= WBGT_RED_C) return 2;
    if (wbgtC >= WBGT_YELLOW_C) return 1;
    return 0;
}

// ---- Solar geometry --------------------------------------------------
//
// cosSolarZenith(lat, lon, date) -> cosine of the solar zenith angle, using
// standard declination + hour-angle astronomy (Cooper's equation for
// declination, a low-order equation-of-time correction for solar noon).
// Good to a couple of minutes of solar time, which is plenty here - Tg is
// fairly insensitive to small zenith errors except right at sunrise/sunset,
// which is exactly where Liljegren-family models are all known to be
// noisiest anyway (see Kong & Huber 2022).
function dayOfYearUTC(date) {
    var start = Date.UTC(date.getUTCFullYear(), 0, 1);
    return Math.floor((date.getTime() - start) / 86400000) + 1;
}

function cosSolarZenith(lat, lon, date) {
    var doy = dayOfYearUTC(date);
    var gamma = (2 * Math.PI / 365) * (doy - 1 + (date.getUTCHours() - 12) / 24);

    // Declination (radians), Spencer's Fourier expansion.
    var decl = 0.006918
        - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
        - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
        - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

    // Equation of time (minutes).
    var eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
        - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

    var utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    var solarTimeMinutes = utcMinutes + eqTime + 4 * lon; // 4 min per degree longitude
    var hourAngleDeg = (solarTimeMinutes / 4) - 180;      // 0 at local solar noon
    var hourAngle = hourAngleDeg * Math.PI / 180;

    var latRad = lat * Math.PI / 180;
    var cosZ = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle);
    return Math.max(cosZ, 0); // 0 once the sun's below the horizon
}

// ---- Clear-sky solar estimate (used only for the OWM fallback, which has
// no radiation field of its own) -----------------------------------------
//
// Kasten & Czeplak (1980): clear-sky GHI from solar elevation, then their
// companion cloud-cover attenuation curve (N in oktas, 0-8) to knock it
// down for cloud cover. This is the same clear-sky model OSHA's own WBGT
// calculator uses for exactly this "no measured solar" situation.
function kastenCzeplakClearSkyWpm2(cosZenith) {
    var elevationDeg = Math.asin(cosZenith) * 180 / Math.PI;
    if (elevationDeg <= 1.15) return 0; // formula breaks down near the horizon
    var ghi = 910 * Math.sin(elevationDeg * Math.PI / 180) - 30;
    return Math.max(ghi, 0);
}

function kastenCzeplakCloudAttenuation(clearSkyWpm2, cloudFractionPercent) {
    var oktas = Math.max(0, Math.min(8, (cloudFractionPercent / 100) * 8));
    return clearSkyWpm2 * (1 - 0.75 * Math.pow(oktas / 8, 3.4));
}

// Rough direct/diffuse split when we only know total cloud cover (Open-Meteo
// gives direct_radiation/diffuse_radiation directly, so this is only used
// for the OWM fallback path). Clear sky -> mostly direct; overcast -> mostly
// diffuse. This is a heuristic, not a measured split - flag it as such if
// you're chasing more accuracy than the rest of the fallback already costs you.
function estimateDirectDiffuseFraction(cloudFractionPercent) {
    var cloudFrac = Math.max(0, Math.min(1, cloudFractionPercent / 100));
    var clearSkyDirectFraction = 0.85;
    var fdb = clearSkyDirectFraction * (1 - cloudFrac);
    return { fdb: fdb, fdif: 1 - fdb };
}

// ---- Natural wet-bulb temperature (Stull 2011 psychrometric approximation)
//
// Good to about +/-0.3 degC for RH 5-99% and T -20 to +50 degC without
// needing pressure. This part doesn't vary with wind/solar the way
// Liljegren's own wick heat-balance equation does - see note above.
function calcStullWetBulb(tempC, relHumidityPercent) {
    var T = tempC;
    var Rh = relHumidityPercent;
    return T * Math.atan(0.151977 * Math.pow(Rh + 8.313659, 0.5)) +
        Math.atan(T + Rh) -
        Math.atan(Rh - 1.676331) +
        0.00391838 * Math.pow(Rh, 1.5) * Math.atan(0.023101 * Rh) -
        4.686035;
}

// ---- Black-globe temperature (Dimiceli/Piltz/Amburn 2011 reduced model) --
//
// Closed-form linearization of the Hunter & Minyard (1999) globe
// heat-balance equation; see the block comment above. tempC/humidity/
// windMps/solarWpm2 are the usual met variables; fdb+fdif (0-1, should sum
// to ~1) are the direct-beam and diffuse fractions of that solar
// irradiance; cosZenith from cosSolarZenith(); pressureHPa is optional
// (defaults to sea-level standard - it only nudges the vapour-pressure term
// by a fraction of a percent, so it's fine to omit).
function calcDimiceliGlobeTempC(tempC, relHumidityPercent, windMps, solarWpm2, fdb, fdif, cosZenith, pressureHPa) {
    var sigma = 5.67e-8;
    var P = pressureHPa || 1013.25;
    var S = Math.max(solarWpm2, 0);

    // Actual vapour pressure (hPa) from RH and air temp, then thermal
    // (atmospheric) emissivity per Hunter & Minyard.
    var ea = (relHumidityPercent / 100) * saturationVaporPressureHPa(tempC) * (1.0007 + 0.00000346 * P);
    var epsA = 0.575 * Math.pow(ea, 1 / 7);

    // Convective heat-transfer coefficient prefactor. The regression
    // Dimiceli fit for this (h = a*S^b*cos(z)^c) needs field-calibrated
    // coefficients that aren't published in reusable form; NWS's own
    // operational NDFD implementation instead uses this same constant
    // (Boyer, NDFD WBGT Algorithm and Software Design), so that's what's
    // used here too. Wind still enters explicitly below via u^0.58.
    var h = 0.315;

    // Wind speed in meters/hour, adjusted from 10m (typical API height) down
    // to the ~2m reference height these coefficients were fit at, using a
    // simple 1/7-power-law wind profile.
    var windMps2m = Math.max(windMps, 0.1) * Math.pow(2 / 10, 1 / 7);
    var windMph = windMps2m * 3600;

    var cosZ = Math.max(cosZenith, 0.01); // avoid divide-by-zero right at the horizon
    var C = (h * Math.pow(windMph, 0.58)) / 5.3865e-8;
    var B = S * (fdb / (4 * sigma * cosZ) + (1.2 / sigma) * fdif) + epsA * Math.pow(tempC, 4);

    // Linearized quartic solve for Tg (Celsius) - see derivation notes above.
    var tg = (B + C * tempC + 7680000) / (C + 256000);
    return tg;
}

// ---- Full WBGT combine ----------------------------------------------------
//
// tempC/relHumidityPercent/windMps are standard met values; solarWpm2 is
// total (global horizontal) shortwave radiation; fdb/fdif are direct/diffuse
// fractions of it; cosZenith from cosSolarZenith(); pressureHPa optional.
function calcWBGTLiljegren(tempC, relHumidityPercent, windMps, solarWpm2, fdb, fdif, cosZenith, pressureHPa) {
    var tnwb = calcStullWetBulb(tempC, relHumidityPercent);
    var tg = calcDimiceliGlobeTempC(tempC, relHumidityPercent, windMps, solarWpm2, fdb, fdif, cosZenith, pressureHPa);
    return 0.7 * tnwb + 0.2 * tg + 0.1 * tempC;
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
    // wind_speed_10m in km/h, shortwave/direct/diffuse_radiation in W/m^2,
    // surface_pressure in hPa - all needed for the WBGT calc below.
    var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,relative_humidity_2m,weather_code,is_day,' +
            'wind_speed_10m,shortwave_radiation,direct_radiation,diffuse_radiation,surface_pressure' +
        '&daily=temperature_2m_max,temperature_2m_min' +
        '&hourly=precipitation_probability,wet_bulb_temperature_2m' +
        '&forecast_days=2' +
        '&timezone=auto' +
        '&timeformat=unixtime';

    return xhrGetJSON(encodeURI(url)).then(function(json) {
        var tempC = json.current.temperature_2m;
        var temp = useFahrenheit ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);
        var icon = iconFromOpenMeteo(json.current.weather_code, json.current.is_day);

        var humidity = json.current.relative_humidity_2m;
        var windMps = (json.current.wind_speed_10m || 0) / 3.6; // km/h -> m/s
        var solarWpm2 = json.current.shortwave_radiation || 0;
        var directWpm2 = json.current.direct_radiation || 0;
        var diffuseWpm2 = json.current.diffuse_radiation || 0;
        var pressureHPa = json.current.surface_pressure;

        var fdb = solarWpm2 > 0 ? Math.min(directWpm2 / solarWpm2, 0.9) : 0;
        var fdif = 1 - fdb;
        var cosZenith = cosSolarZenith(lat, lon, new Date());

        var wbgtC = calcWBGTLiljegren(tempC, humidity, windMps, solarWpm2, fdb, fdif, cosZenith, pressureHPa);
        var wbgtLevel = wbgtLevelFromCelsius(wbgtC);
       

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
        
        var wbgts = (json.hourly && json.hourly.wet_bulb_temperature_2m) || [];
        var wbgtDirect = (typeof wbgts[nextHourIdx] === 'number') ? Math.round(wbgts[nextHourIdx]) : 0;

        //var wbgtDirect = Math.round(json.hourly.wet_bulb_temperature_2m[0]);

        return {
            icon: icon, temp: temp, high: high, low: low, rainChance: rainChance,
            wbgtLevel: wbgtLevel, wbgtRawValue: Math.round(wbgtC), wbgtDirect: wbgtDirect
        };
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

        // WBGT needs Celsius/m-s regardless of the display unit, and 'units'
        // only affects temp/wind fields, not humidity - json.current.humidity
        // is always a plain 0-100 relative humidity percentage from OWM.
        var tempC = useFahrenheit ? (json.current.temp - 32) * 5 / 9 : json.current.temp;
        var humidity = json.current.humidity;
        var windMps = useFahrenheit ? (json.current.wind_speed || 0) * 0.44704 : (json.current.wind_speed || 0);
        var pressureHPa = json.current.pressure;

        // OWM's One Call doesn't give shortwave radiation at all, so
        // estimate it: Kasten-Czeplak clear-sky GHI from the sun's position,
        // knocked down for cloud cover (clouds 0-100%), then split into
        // direct/diffuse by the same cloud fraction. See the comments above
        // kastenCzeplakClearSkyWpm2/estimateDirectDiffuseFraction for the
        // accuracy trade-off this involves vs Open-Meteo's measured fields.
        var cosZenith = cosSolarZenith(lat, lon, new Date());
        var cloudPercent = (json.current.clouds !== undefined) ? json.current.clouds : 50;
        var clearSkyWpm2 = kastenCzeplakClearSkyWpm2(cosZenith);
        var solarWpm2 = kastenCzeplakCloudAttenuation(clearSkyWpm2, cloudPercent);
        var split = estimateDirectDiffuseFraction(cloudPercent);

        var wbgtC = calcWBGTLiljegren(tempC, humidity, windMps, solarWpm2, split.fdb, split.fdif, cosZenith, pressureHPa);
        var wbgtLevel = wbgtLevelFromCelsius(wbgtC);
        var wbgtDirect = wbgtLevel;

        return {
            icon: icon,
            temp: temp,
            high: high,
            low: low,
            rainChance: rainChance,
            wbgtLevel: wbgtLevel,
            wbgtRawValue: Math.round(wbgtC),
            wbgtDirect: wbgtDirect
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
        console.log("Weather disabled - icon=0 temp=-- tempFore=--|-- rainSoon=0 wbgtLevel=0");
        return Promise.resolve({ icon: 0, temp: '--', tempFore: '--|--', rainSoon: 0, wbgtLevel: 0, wbgtValue: '--' });
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

        // wbgtRawValue is always computed in Celsius internally (the hazard
        // thresholds are Celsius too); convert only for display here.
        var wbgtDisplay = result.wbgtRawValue;
        if (useFahrenheit && typeof wbgtDisplay === 'number') {
            wbgtDisplay = Math.round((wbgtDisplay * 9 / 5) + 32);
        }

        console.log("Weather fetched (" + provider + ") - icon=" + result.icon +
            " temp=" + result.temp + " high=" + result.high + " low=" + result.low +
            " rainChance=" + result.rainChance + "% rainSoon=" + rainSoon +
            " wbgtLevel=" + result.wbgtLevel + " wbgtValue=" + wbgtDisplay + " wbgtDirect=" + result.wbgtDirect);
        return {
            icon: result.icon,
            temp: String(result.temp),
            tempFore: String(result.high) + ' | ' + String(result.low),
            rainSoon: rainSoon,
            wbgtLevel: result.wbgtLevel,
            wbgtValue: String(wbgtDisplay),
            wbgtDirect: result.wbgtDirect
        };
    });
};

module.exports = {
    get: getWeather
};

