///////modifies the behaviour of the clay settings page

module.exports = function(minified) {
    var config = this;
    var $ = minified.$;
    var HTML = minified.HTML;

    var MAX_SUGGESTIONS = 500;

    var timezonesJSON = 0; // 0 is unset
    var timezonesList = [];
    var built = false;
    var eventsWired = false;
    var tzDebug = "Ready.";
    var suggestionBox = null;

    var getInputElement = function(item) {
        return item.$manipulatorTarget[0] || item.$manipulatorTarget;
    };

    // ---- Suggestion dropdowns (shared by the timezone and location pickers) ----

    var SUGGESTION_BOX_CSS = 'position:absolute;top:100%;left:0;right:0;z-index:1000;list-style:none;' +
        'margin:0;padding:0;background:#fff;color:#222;border:1px solid #ccc;' +
        'max-height:200px;overflow-y:auto;display:none';
    var SUGGESTION_ROW_CSS = 'padding:6px 8px;cursor:pointer;color:#222;background:#fff';

    // Creates a hidden suggestion <ul> positioned directly under the input.
    var createSuggestionBox = function(inputElement, className) {
        var parent = inputElement.parentNode;
        parent.style.position = 'relative';

        var box = document.createElement('ul');
        box.className = className;
        box.style.cssText = SUGGESTION_BOX_CSS;
        parent.insertBefore(box, inputElement.nextSibling);
        return box;
    };

    // Fills box with one row per item and shows it (or hides it if there are none).
    // getLabel(item) gives the row text; onPick(item) runs when a row is chosen.
    var renderSuggestions = function(box, items, getLabel, onPick) {
        box.innerHTML = '';

        if (!items.length) {
            box.style.display = 'none';
            return;
        }

        items.forEach(function(item) {
            var li = document.createElement('li');
            li.textContent = getLabel(item);
            li.style.cssText = SUGGESTION_ROW_CSS;

            li.addEventListener('mouseenter', function() {
                li.style.background = '#eee';
            });
            li.addEventListener('mouseleave', function() {
                li.style.background = '#fff';
            });

            // mousedown (not click) fires before the input's blur handler,
            // so the value is set before the blur-time validation runs.
            li.addEventListener('mousedown', function(e) {
                e.preventDefault();
                onPick(item);
            });

            box.appendChild(li);
        });

        box.style.display = 'block';
    };

    var hideSuggestions = function() {
        if (suggestionBox) suggestionBox.style.display = 'none';
    };

    var showSuggestions = function(matches, inputElement, item, idstate) {
        if (!suggestionBox) suggestionBox = createSuggestionBox(inputElement, 'tz-suggestions');

        renderSuggestions(suggestionBox, matches, function(zone) { return zone; }, function(zone) {
            inputElement.value = zone;
            item.set(zone);
            idstate.set(zone);
            hideSuggestions();
        });
    };

    var filterTimezones = function(query) {
        if (!query) {
            // return timezonesList.slice(0, MAX_SUGGESTIONS);
            return timezonesList;
        }
        var lower = query.toLowerCase();
        var matches = [];
        for (var i = 0; i < timezonesList.length && matches.length < MAX_SUGGESTIONS; i++) {
            if (timezonesList[i].toLowerCase().indexOf(lower) !== -1) {
                matches.push(timezonesList[i]);
            }
        }
        return matches;
    };

    // On blur, anything that isn't an exact match to a fetched timezone gets cleared - this is what enforces "must pick from the list".
    var validateAndMaybeClear = function(inputElement, item, idstate) {
        var value = inputElement.value;
        if (value === '') return; // empty = "disabled", always valid

        var isValid = false;
        for (var i = 0; i < timezonesList.length; i++) {
            if (timezonesList[i] === value) {
                isValid = true;
                break;
            }
        }

        if (!isValid) {
            inputElement.value = '';
            item.set('');
            idstate.set('');
        }
    };

    var wireInputEvents = function(item, idstate) {
        if (eventsWired) return;
        eventsWired = true;

        var inputElement = getInputElement(item);
        inputElement.setAttribute('autocomplete', 'off');

        inputElement.addEventListener('input', function() {
            var matches = filterTimezones(inputElement.value);
            showSuggestions(matches, inputElement, item, idstate);
        });

        inputElement.addEventListener('focus', function() {
            var matches = filterTimezones(inputElement.value);
            showSuggestions(matches, inputElement, item, idstate);
        });

        inputElement.addEventListener('blur', function() {
            // Delay so a suggestion's mousedown handler can run first.
            setTimeout(function() {
                validateAndMaybeClear(inputElement, item, idstate);
                hideSuggestions();
            }, 150);
        });
    };

    var postBuild = function(wasError) {
        var item = config.getItemByMessageKey("TZ_ID");
        var idstate = config.getItemByMessageKey("TZ_ID_STATE");
        var debug = config.getItemById("TZ_DEBUG");

        if (!item || !idstate) return;

        if (debug) {
            if (wasError) {
                debug.show();
            } else {
                debug.hide();
            }
            debug.set(tzDebug + "<br>Click 'Fetch Timezones' to retry.");
        }

        if (idstate.get()) {
            item.set(idstate.get());
        }

        item.on('change', function() {
            idstate.set(item.get());
        });

        wireInputEvents(item, idstate);
    };

    var loadTimezones = function(json) {
        var item = config.getItemByMessageKey("TZ_ID");
        var idstate = config.getItemByMessageKey("TZ_ID_STATE");

        try {
            timezonesList = JSON.parse(json);

            var inputElement = getInputElement(item);
            inputElement.setAttribute('placeholder', 'Start typing a city or region...');

            tzDebug = "Loaded " + timezonesList.length + " zones.";

            if (idstate && idstate.get()) {
                item.set(idstate.get());
            }

            postBuild(false);
        } catch (e) {
            tzDebug = "JSON Parse Error: " + e.message;
            postBuild(true);
        }
    };

    var updateDebug = function(message) {
        console.log("[TZ Debug] " + message);
        tzDebug = message;
        var debug = config.getItemById("TZ_DEBUG");
        if (debug) {
            debug.show();
            debug.set(message);
        }
    };

    // Fallback only: if timeapi.io can't be reached, use the browser's own IANA zone list.
    // Returns null when this browser can't provide one.
    var getBuiltInTimezones = function() {
        try {
            var list = (typeof Intl !== 'undefined' && Intl.supportedValuesOf) ? Intl.supportedValuesOf('timeZone') : null;
            if (!list || !list.length) return null;
            return list.indexOf('UTC') === -1 ? list.concat('UTC') : list;
        } catch (e) {
            return null;
        }
    };

    var getTimezones = function() {
        updateDebug("Starting fetch...");

        // Updated to timeapi.io AvailableTimeZones endpoint
        var url = 'https://timeapi.io/api/TimeZone/AvailableTimeZones';
        var xhr = new XMLHttpRequest();
        var timeoutId;
        var requestStarted = false;

        var cleanup = function() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        var handleError = function(errorMsg) {
            cleanup();
            console.error("Timezone fetch error:", errorMsg);

            var builtIn = getBuiltInTimezones();
            if (builtIn) {
                timezonesJSON = JSON.stringify(builtIn);
                if (built) {
                    loadTimezones(timezonesJSON);
                }
                return;
            }

            tzDebug = "Error: " + errorMsg;
            timezonesJSON = null;
            if (built) {
                postBuild(true);
            }
        };

        var handleSuccess = function(responseText) {
            cleanup();
            try {
                updateDebug("Processing response...");

                if (!responseText || responseText.length < 10) {
                    throw new Error("Empty or invalid response");
                }

                var parsed = JSON.parse(responseText);
                if (!parsed || parsed.length === 0) {
                    throw new Error("Invalid timezone data");
                }

                timezonesJSON = responseText;
                if (built) {
                    loadTimezones(responseText);
                }
            } catch (e) {
                handleError(e.message);
            }
        };

        timeoutId = setTimeout(function() {
            if (!requestStarted) {
                handleError("Request never started - possible browser blocking");
            } else {
                xhr.abort();
                handleError("Request timed out after 10 seconds");
            }
        }, 10000);

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 1) {
                requestStarted = true;
                updateDebug("Connection opened, sending request...");
            }
        };

        xhr.onload = function() {
            updateDebug("Response received (HTTP " + xhr.status + ")");
            if (xhr.status === 200) {
                handleSuccess(xhr.responseText);
            } else {
                handleError("HTTP " + xhr.status + ": " + xhr.statusText);
            }
        };

        xhr.onerror = function() {
            handleError("Network error - connection blocked");
        };

        try {
            updateDebug("Opening connection to TimeAPI.io...");
            xhr.open('GET', url, true);
            updateDebug("Sending request...");
            xhr.send();
        } catch (e) {
            handleError("Failed to send request: " + e.message);
        }
    };

    ///////////////////// Location search (geocoding) /////////////////////

    var LOCATION_MIN_QUERY_LENGTH = 2;
    var LOCATION_DEBOUNCE_MS = 300; // Photon is built for search-as-you-type, so this can be snappier than Nominatim needed
    var LOCATION_MAX_SUGGESTIONS = 8;

    var locationSuggestionBox = null;
    var locationDebounceTimer = null;
    var locationRequestSeq = 0; // guards against an older, slower request clobbering a newer one
    var selectedLocationDisplay = ""; // the last text that was actually picked from the list (or restored from a previous save)
    var locationEventsWired = false;

    var hideLocationSuggestions = function() {
        if (locationSuggestionBox) locationSuggestionBox.style.display = 'none';
    };

    // matches: array of { display, lat, lon }
    var showLocationSuggestions = function(matches, inputElement, item, latItem, longItem) {
        if (!locationSuggestionBox) {
            locationSuggestionBox = createSuggestionBox(inputElement, 'location-suggestions');
        }

        renderSuggestions(locationSuggestionBox, matches, function(match) { return match.display; }, function(match) {
            inputElement.value = match.display;
            item.set(match.display);
            latItem.set(String(match.lat));
            longItem.set(String(match.lon));
            selectedLocationDisplay = match.display;
            hideLocationSuggestions();
        });
    };

    var updateLocationDebug = function(message) {
        console.log("[Location Debug] " + message);
        var debug = config.getItemById("LOCATION_DEBUG");
        if (debug) {
            debug.show();
            debug.set(message);
        }
    };

    var hideLocationDebug = function() {
        var debug = config.getItemById("LOCATION_DEBUG");
        if (debug) debug.hide();
    };

    // Builds the short "name, region, country" label used before any
    // duplicate-disambiguation is applied.
    var buildLocationDisplay = function(namePart, regionPart, countryPart) {
        var parts = [namePart];
        if (regionPart && regionPart !== namePart) parts.push(regionPart);
        if (countryPart) parts.push(countryPart);
        return parts.join(', ');
    };

    var disambiguateLocationMatches = function(rawMatches) {
        var countByDisplay = {};
        var i;
        for (i = 0; i < rawMatches.length; i++) {
            var d = rawMatches[i].display;
            countByDisplay[d] = (countByDisplay[d] || 0) + 1;
        }

        for (i = 0; i < rawMatches.length; i++) {
            var m = rawMatches[i];
            if (countByDisplay[m.display] <= 1) continue; // unique already, leave as-is

            if (m.county && m.county !== m.name) {
                m.display = buildLocationDisplay(m.name + ' (' + m.county + ')', m.region, m.country);
            } else {
                // No county to fall back on (or it didn't help) - coordinates
                // are always unique and better than an ambiguous duplicate.
                m.display = m.display + ' [' + m.lat.toFixed(3) + ', ' + m.lon.toFixed(3) + ']';
            }
        }

        // A second pass in case adding the county still left a tie (rare -
        // e.g. same village name in the same county twice in OSM data).
        var countAfter = {};
        for (i = 0; i < rawMatches.length; i++) {
            countAfter[rawMatches[i].display] = (countAfter[rawMatches[i].display] || 0) + 1;
        }
        for (i = 0; i < rawMatches.length; i++) {
            var m2 = rawMatches[i];
            if (countAfter[m2.display] > 1 && m2.display.indexOf('[') === -1) {
                m2.display = m2.display + ' [' + m2.lat.toFixed(3) + ', ' + m2.lon.toFixed(3) + ']';
            }
        }

        return rawMatches;
    };

    var geocodeLocation = function(query) {
        var thisRequestSeq = ++locationRequestSeq;

        return new Promise(function(resolve) {
            var url = 'https://photon.komoot.io/api/' +
                '?q=' + encodeURIComponent(query) +
                '&limit=' + LOCATION_MAX_SUGGESTIONS +
                '&lang=en';

            var xhr = new XMLHttpRequest();
            var timeoutId = setTimeout(function() {
                xhr.abort();
                if (thisRequestSeq === locationRequestSeq) {
                    updateLocationDebug("Location search timed out.");
                }
                resolve([]);
            }, 8000);

            xhr.onload = function() {
                clearTimeout(timeoutId);
                if (thisRequestSeq !== locationRequestSeq) {
                    // A newer keystroke already fired another request - drop this stale one.
                    resolve([]);
                    return;
                }
                if (xhr.status !== 200) {
                    updateLocationDebug("Location search failed (HTTP " + xhr.status + ").");
                    resolve([]);
                    return;
                }
                try {
                    var json = JSON.parse(xhr.responseText);
                    var features = json.features || [];
                    var rawMatches = [];
                    for (var i = 0; i < features.length; i++) {
                        var f = features[i];
                        var props = f.properties || {};
                        var coords = (f.geometry && f.geometry.coordinates) || [];
                        // GeoJSON order is [lon, lat], not [lat, lon].
                        var lon = parseFloat(coords[0]);
                        var lat = parseFloat(coords[1]);

                        if (isNaN(lat) || isNaN(lon)) continue;

                        var name = props.name || props.city || props.street || 'Unknown';
                        var region = props.state || '';
                        var country = props.country || '';
                        var county = props.county || props.district || '';

                        rawMatches.push({
                            display: buildLocationDisplay(name, region, country),
                            name: name,
                            region: region,
                            country: country,
                            county: county,
                            lat: lat,
                            lon: lon
                        });
                    }
                    hideLocationDebug();
                    resolve(disambiguateLocationMatches(rawMatches));
                } catch (e) {
                    updateLocationDebug("Location search error: " + e.message);
                    resolve([]);
                }
            };

            xhr.onerror = function() {
                clearTimeout(timeoutId);
                if (thisRequestSeq === locationRequestSeq) {
                    updateLocationDebug("Location search network error.");
                }
                resolve([]);
            };

            xhr.open('GET', url);
            xhr.send();
        });
    };

    // On blur, anything that isn't the exact text of a picked suggestion
    // gets cleared - along with the lat/lon that went with it - which is
    // what enforces "must pick from the list". Empty is always valid and
    // just means "use GPS".
    var validateAndMaybeClearLocation = function(inputElement, item, latItem, longItem) {
        var value = inputElement.value;
        if (value === '') {
            item.set('');
            latItem.set('');
            longItem.set('');
            selectedLocationDisplay = '';
            return;
        }

        if (value !== selectedLocationDisplay) {
            inputElement.value = '';
            item.set('');
            latItem.set('');
            longItem.set('');
            selectedLocationDisplay = '';
        }
    };

    var wireLocationInputEvents = function(item, latItem, longItem) {
        if (locationEventsWired) return;
        locationEventsWired = true;

        var inputElement = getInputElement(item);
        inputElement.setAttribute('autocomplete', 'off');
        inputElement.setAttribute('placeholder', 'e.g.: London, UK (leave blank to use GPS)');

        inputElement.addEventListener('input', function() {
            var query = inputElement.value;

            if (locationDebounceTimer) {
                clearTimeout(locationDebounceTimer);
                locationDebounceTimer = null;
            }

            if (query.length < LOCATION_MIN_QUERY_LENGTH) {
                hideLocationSuggestions();
                return;
            }

            locationDebounceTimer = setTimeout(function() {
                geocodeLocation(query).then(function(matches) {
                    showLocationSuggestions(matches, inputElement, item, latItem, longItem);
                });
            }, LOCATION_DEBOUNCE_MS);
        });

        inputElement.addEventListener('blur', function() {
            // Delay so a suggestion's mousedown handler can run first.
            setTimeout(function() {
                validateAndMaybeClearLocation(inputElement, item, latItem, longItem);
                hideLocationSuggestions();
            }, 150);
        });
    };

    var initLocationSearch = function() {
        var item = config.getItemByMessageKey("LocationQuery");
        var latItem = config.getItemByMessageKey("Lat");
        var longItem = config.getItemByMessageKey("Long");

        if (!item || !latItem || !longItem) return;

        // Lat/Long are only ever written by picking a suggestion (or GPS
        // fallback when blank) - never shown or hand-edited directly.
        latItem.hide();
        longItem.hide();
        hideLocationDebug();

        // Whatever was saved from a previous session is trusted as-is,
        // since Lat/Long were already populated to match it back then.
        selectedLocationDisplay = item.get() || "";

        wireLocationInputEvents(item, latItem, longItem);
    };

    var setVisible = function(item, visible) {
        if (!item) return;
        if (visible) { item.show(); } else { item.hide(); }
    };

    // The whole weather group (heading, preview, options and Save button) only shows while
    // "Show Weather" is on. Lat/Long are left out on purpose: the location search shows and
    // hides those itself.
    var WEATHER_IDS = ["WEATHER_HEADING", "WATCH_PREVIEW_4", "WEATHER_SAVE"];
    var WEATHER_KEYS = ["WeatherProv", "LocationQuery", "APIKEY_User", "UpSlider", "RefreshWeatherOnLaunch", "WeatherUnit",
                          "ShowCurrent", "ShowForecast", "ShowAlert", "ShakeToRefreshWeather", "ShakeToParkHands"];

    var updateWeatherSectionVisibility = function() {
        var useWeather = config.getItemByMessageKey("UseWeather");
        if (!useWeather) return;

        var isWeatherOn = !!useWeather.get();
        WEATHER_IDS.forEach(function(id) {
            setVisible(config.getItemById(id), isWeatherOn);
        });
        WEATHER_KEYS.forEach(function(key) {
            setVisible(config.getItemByMessageKey(key), isWeatherOn);
        });

        // Any location-search message is hidden along with the rest; it reappears by itself on the next error
        if (!isWeatherOn) setVisible(config.getItemById("LOCATION_DEBUG"), false);
    };

    // "Hands aside for (seconds)" only matters while weather and "Shake to Move Hands Aside" are both on
    var updateParkHandsVisibility = function() {
        var useWeather = config.getItemByMessageKey("UseWeather");
        var park = config.getItemByMessageKey("ShakeToParkHands");
        setVisible(config.getItemByMessageKey("ParkHandsSeconds"),
                   !!(useWeather && useWeather.get() && park && park.get()));
    };

    // The date format and language options only matter while the date is shown
    var DATE_OPTION_KEYS = ["DateFormat", "DateLanguage"];

    var updateDateOptionsVisibility = function() {
        var enableDate = config.getItemByMessageKey("EnableDate");
        if (!enableDate) return;

        var isDateOn = !!enableDate.get();
        DATE_OPTION_KEYS.forEach(function(key) {
            setVisible(config.getItemByMessageKey(key), isDateOn);
        });
    };

    // "Numbers or Roman Numerals" is moot once "Tick Marks Only" replaces both with plain ticks
    var updateRomanVisibility = function() {
        var ticksOnly = config.getItemByMessageKey("HourTicksOnly");
        if (!ticksOnly) return;

        setVisible(config.getItemByMessageKey("Roman"), !ticksOnly.get());
    };

    // The "Custom Colours" group (heading, preview and every colour picker) only shows when the
    // custom theme is picked. Colour watches use ThemeSelect and B&W watches BWThemeSelect; a
    // watch only ever has one of the two.
    var CUSTOM_COLOUR_IDS = ["CUSTOM_COLOURS_HEADING", "WATCH_PREVIEW_6"];
    var CUSTOM_COLOUR_KEYS = [
        "BackgroundColor1", "MinuteHandShadowColor", "MajorTickColor", "MinorTickColor",
        "HourDigitsColor", "MinutesHandColor", "HourHandColor", "SecondsHandColor", "MonthHandColor",
        "SubDialColor", "DateColor", "BatteryWeatherColor", "BatteryLineColor", "BTQTColor",
        "BWBackgroundColor1", "BWMinuteHandShadowColor", "BWMajorTickColor", "BWMinHandBatLineColor", "BWHourHandColor",
        "BWSecondsHandColor", "BWMonthHandColor", "BWSubDialColor", "BWHourDigitsColor",
        "BWDateColor", "BWBatteryWeatherColor", "BWBTQTColor"
    ];
    var THEME_SELECT_KEYS = ["ThemeSelect", "BWThemeSelect"];

    var updateCustomColourVisibility = function() {
        var isCustom = false;
        THEME_SELECT_KEYS.forEach(function(key) {
            var themeItem = config.getItemByMessageKey(key);
            if (themeItem && themeItem.get() === "cu") isCustom = true;
        });

        CUSTOM_COLOUR_IDS.forEach(function(id) {
            setVisible(config.getItemById(id), isCustom);
        });
        CUSTOM_COLOUR_KEYS.forEach(function(key) {
            setVisible(config.getItemByMessageKey(key), isCustom);
        });
    };

    var TZ_SUBDIAL_VALUE = 5; // matches "Second Timezone" option in SubDialChoice

    // Which settings each SubDialChoice value reveals. An item is shown when the
    // current choice is in the rule's `when` list, hidden otherwise. `ids` are
    // item ids, `keys` are message keys.
    var SUBDIAL_RULES = [
        // Second timezone
        { when: [TZ_SUBDIAL_VALUE], ids: ["TZ_HEADING", "TZ_BUTTON", "TZ_DEBUG"], keys: ["showremoteAMPM", "TZ_ID"] },
        // Seconds, with timeout
        { when: [2],       keys: ["AlwaysShowSubDial"] },
        // Seconds with timeout, and month hand + seconds on shake
        { when: [2, 6],    keys: ["SecondsVisibleTime"] },
        // Seconds always on, or with timeout (or on shake): the sweep option is relevant
        { when: [1, 2, 6], ids: ["SECONDS_HEADING"], keys: ["SmoothSweep"] }
    ];

    var updateSubdialSectionVisibility = function() {
        var subdial = config.getItemByMessageKey("SubDialChoice");
        if (!subdial) return;

        var choice = parseInt(subdial.get(), 10);
        SUBDIAL_RULES.forEach(function(rule) {
            var visible = rule.when.indexOf(choice) !== -1;
            (rule.ids || []).forEach(function(id) {
                setVisible(config.getItemById(id), visible);
            });
            (rule.keys || []).forEach(function(key) {
                setVisible(config.getItemByMessageKey(key), visible);
            });
        });
    };

    var maybeAutoFetchTimezones = function() {
    var subdial = config.getItemByMessageKey("SubDialChoice");
    if (!subdial) return;

    var currentValue = parseInt(subdial.get(), 10);
    if (currentValue !== TZ_SUBDIAL_VALUE) return;

    if (timezonesJSON !== 0 && timezonesJSON !== null) return; // already have a good list

    getTimezones();
    };

    // =================================================================
    // Live preview of the watchface
    //
    // Draws a canvas that approximates the watchface and redraws it whenever
    // a setting that affects the look of the face changes. Geometry mirrors
    // the per-platform UIConfig blocks and the drawing procs in nomos.c, the
    // integer edge/point maths in MathUtils.c, and the date text comes from
    // the weekday.c / month.c tables. Text uses subsets of the real Tangent
    // and Weather Icons fonts.
    //
    // It is still an approximation, not a pixel-exact match:
    //   - The watch draws text with fctx vector fonts; the preview draws the
    //     same glyphs with the browser's text renderer, so spacing and
    //     anti-aliasing differ slightly.
    //   - The time (10:08), date (Wed 30 Sep), battery (80%), weather
    //     (21 degrees, 25 | 12, clear sky) and second timezone (3:25 PM) are
    //     fixed sample values, so the preview stays stable and is easy to
    //     compare between changes.
    //   - Colours on colour watches are "sunlight corrected" to look closer
    //     to how the reflective display renders them.
    //
    // Everything lives inside this function because Clay serialises it
    // into the config page - it can't require() anything.
    // =================================================================

    // Every "text" item in config.js whose id starts with WATCH_PREVIEW becomes a preview canvas
    // (WATCH_PREVIEW, WATCH_PREVIEW_2, ...), so adding one is just a config.js edit. Ids listed
    // here are a fallback for Clay versions that can't enumerate items.
    var PREVIEW_ANCHOR_IDS = ["WATCH_PREVIEW", "WATCH_PREVIEW_2", "WATCH_PREVIEW_3", "WATCH_PREVIEW_4", "WATCH_PREVIEW_5", "WATCH_PREVIEW_6", "WATCH_PREVIEW_7", "WATCH_PREVIEW_8"];

    var getPreviewAnchorIds = function() {
        if (typeof config.getAllItems !== 'function') return PREVIEW_ANCHOR_IDS;

        var ids = [];
        config.getAllItems().forEach(function(item) {
            if (item.id && /^WATCH_PREVIEW/.test(item.id) && ids.indexOf(item.id) === -1) {
                ids.push(item.id);
            }
        });
        return ids;
    };

    // ---- Fonts: subsets of Tangent-Regular.ttf and WeatherIcons-RegularMod.ttf, plus the
    // two dripicons glyphs used for the Bluetooth / Quiet Time icons ----
    var TANGENT_WOFF2_B64 = "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";
    var WEATHER_ICONS_WOFF2_B64 = "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";
    var DRIPICONS_ICONS_WOFF2_B64 = "d09GMgABAAAAAAH4AAwAAAAAA3AAAAGsAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYGVgA8EQgKgjyCJQE2AiQDCAsIAAQgBQYHIBt8AgCOwziGvERM5UNTYjMien6szb5/oohVSyRChkTFs5Zk0jx3SPUy/v+vtft30VlMtImnFWUWMa/mcSRiUkmeoHFIdNVI22e246FNeGAz+4nudjfwLNYAoyBNu1umuQ1Rf4uwdUwwAUSUiBTyg65BNKwd7OdbM4HeoHSHAMgCAA7ay1uxi5v7JnZP90grhiCAQsOKJmA6ttFzUb9BBExaWN+IiuSfUKCBHnq4BvcAVgBN22pKv1HIlVX24yUfAc6kGCGwwiL4iiv+Vjz5iirOylN+1UYDclgj+Vi4ZQGeRJWqYj+QmXKqkpc4jh23TaKPwC378RYHaQZeRfZ8K6yyr+hjiaDLZhuNjB9e/bkf6bS/br/37a1tbUQVXm063ZH7baYdx4+O814V/b5/v28Tv7h7uzzu7st1vna+AHLbVZ5TGp89dj2SHzXadi7hJ8F5Xq2NvSMSe87thcVi844OIlFRif+R2930Ftnor7gE58At5J3ZeFrLJ3sHQ3i/2ftvcM+bOakUgF+ftVVvVDYUTMHAQIFQIcJO4YLQ88MUcItFQYuXKQionkYK";

    var PREVIEW_FONT_TEXT = "TangentPreview";
    var PREVIEW_FONT_WEATHER = "TangentWeatherPreview";
    var PREVIEW_FONT_ICONS = "TangentDripiconsPreview";
    var PREVIEW_TEXT_FAMILY = "'" + PREVIEW_FONT_TEXT + "', 'Arial Narrow', 'Helvetica Neue Condensed', sans-serif";

    // Line metrics as a fraction of the em, from each font's hhea table (Tangent: 1076/153 over
    // 1024 units, weather icons: 2245/718 over 2048).
    var PREVIEW_FONT_ASCENT = 1076 / 1024;
    var PREVIEW_FONT_DESCENT = 153 / 1024;
    var PREVIEW_WEATHER_ASCENT = 2245 / 2048;

    // fctx sizes text by its em height, and its "top" anchor is the top of that em box: the
    // baseline sits (1 - descent) ems below y - about 0.85 em for Tangent - not a whole hhea
    // ascent (1.05 em). That's what the date, battery and weather text use.
    var PREVIEW_FONT_TOP_ASCENT = 1 - PREVIEW_FONT_DESCENT;

    var previewFontsReady = null; // Promise, set once loading starts

    var loadPreviewFonts = function() {
        if (previewFontsReady) return previewFontsReady;

        if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
            previewFontsReady = Promise.resolve();
            return previewFontsReady;
        }

        var faceFor = function(family, b64) {
            return new FontFace(family, "url(data:font/woff2;base64," + b64 + ")");
        };

        previewFontsReady = Promise.all([
            faceFor(PREVIEW_FONT_TEXT, TANGENT_WOFF2_B64).load(),
            faceFor(PREVIEW_FONT_WEATHER, WEATHER_ICONS_WOFF2_B64).load(),
            faceFor(PREVIEW_FONT_ICONS, DRIPICONS_ICONS_WOFF2_B64).load()
        ])
            .then(function(faces) {
                for (var i = 0; i < faces.length; i++) {
                    document.fonts.add(faces[i]);
                }
            })
            .catch(function(err) {
                console.error("Preview font load failed, falling back to system fonts:", err);
            });

        return previewFontsReady;
    };

    // ---- Platforms ----
    // geom picks which UIConfig block from nomos.c applies:
    //   emery -> emery, gabbro -> gabbro, aplite/diorite/flint -> bw,
    //   chalk -> round, basalt -> default
    var PREVIEW_SCREENS = {
        aplite:  { w: 144, h: 168, round: false, bw: true,  geom: "bw",      aplite: true, weather: true },
        basalt:  { w: 144, h: 168, round: false, bw: false, geom: "default", weather: true },
        chalk:   { w: 180, h: 180, round: true,  bw: false, geom: "round", weather: true },
        diorite: { w: 144, h: 168, round: false, bw: true,  geom: "bw", weather: true },
        emery:   { w: 200, h: 228, round: false, bw: false, geom: "emery",   weather: true },
        flint:   { w: 144, h: 168, round: false, bw: true,  geom: "bw", weather: true },
        gabbro:  { w: 260, h: 260, round: true,  bw: false, geom: "gabbro",  weather: true }
    };

    // Generated from the UIConfig blocks in nomos.c. Rects are [x, y, w, h].
    var PREVIEW_GEOMETRY = {
        emery: { DateBottomYPosition: 60, yOffset: -8, yOffsetFctx: 3, yWeekdayDateOffset: 27, BatteryYOffset: 53, BatteryLineYOffset: 78, font_size_digits: 40, digit_inset: 14, font_size_battery: 20, font_size_date: 28, battery_pos_z: 0, battery_pos_y: 6, battery_line: 63, analogue_hand_a: 1, analogue_hand_c: 1, hands_shadow: 2, corner_radius_minutehand: 20, corner_radius_hourhand: 10, corner_radius_majortickrect: 20, corner_radius_minortickrect: 20, majortickrect_w: 94, majortickrect_h: 108, minortickrect_w: 96, minortickrect_h: 110, outertickinset: 6, innertickinset: 12, majorticklength: 6, majorticklengthinner: 30, tick_inset_outer: -10, tick_inset_inner: 30, HourCentreOuterRadius: 7, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 5, SecondHandCentreInnerRadius: 2, hour_hand_p2x: 50, hour_hand_p2y: 50, min_hand_p2x: 12, min_hand_p2y: 12, second_hand_a: 26, second_hand_b: 0, seconds_circle_radius: 28, seconds_circle_centre_x: 100, seconds_circle_centre_y: 154, romanadjust: 2, BTIconRect: [53, 21, 44, 20], QTIconRect: [106, 20, 44, 20], IconNowRect: [0, 48, 98, 22], IconNowRect2: [0, 52, 98, 22], RainIconRect: [48, 81, 40, 22], WarningIconRect: [132, 83, 40, 22], weather_icon_size: 20, forecast_offset: 28, weather_temp_grow: 6 },
        gabbro: { DateBottomYPosition: 67, yOffset: -8, yOffsetFctx: 3, yWeekdayDateOffset: 29, BatteryYOffset: 64, BatteryLineYOffset: 87, font_size_digits: 48, digit_inset: 31, font_size_battery: 20, font_size_date: 32, battery_pos_z: -2, battery_pos_y: 4, battery_line: 63, analogue_hand_a: 11, analogue_hand_c: 1, hands_shadow: 2, corner_radius_minutehand: 0, corner_radius_hourhand: 0, corner_radius_majortickrect: 0, corner_radius_minortickrect: 0, majortickrect_w: 0, majortickrect_h: 0, minortickrect_w: 0, minortickrect_h: 0, outertickinset: 6, innertickinset: 12, majorticklength: 6, majorticklengthinner: 36, tick_inset_outer: 0, tick_inset_inner: 0, HourCentreOuterRadius: 9, HourCentreInnerRadius: 3, SecondHandCentreOuterRadius: 5, SecondHandCentreInnerRadius: 2, hour_hand_p2x: 0, hour_hand_p2y: 0, min_hand_p2x: 0, min_hand_p2y: 0, second_hand_a: 29, second_hand_b: 0, seconds_circle_radius: 31, seconds_circle_centre_x: 130, seconds_circle_centre_y: 175, romanadjust: 0, BTIconRect: [78, 23, 44, 20], QTIconRect: [140, 22, 44, 20], IconNowRect: [0, 60, 128, 22], IconNowRect2: [0, 64, 128, 22], RainIconRect: [75, 90, 40, 22], WarningIconRect: [165, 91, 40, 22], weather_icon_size: 20, forecast_offset: 28, weather_temp_grow: 6 },
        bw: { DateBottomYPosition: 40, yOffset: -7, yOffsetFctx: 2, yWeekdayDateOffset: 16, BatteryYOffset: 37, BatteryLineYOffset: 56, font_size_digits: 28, digit_inset: 10, font_size_battery: 16, font_size_date: 20, battery_pos_z: 0, battery_pos_y: 4, battery_line: 51, analogue_hand_a: 1, analogue_hand_c: 1, hands_shadow: 1, corner_radius_minutehand: 15, corner_radius_hourhand: 6, corner_radius_majortickrect: 15, corner_radius_minortickrect: 15, majortickrect_w: 70, majortickrect_h: 80, minortickrect_w: 70, minortickrect_h: 80, outertickinset: 6, innertickinset: 10, majorticklength: 6, majorticklengthinner: 14, tick_inset_outer: -10, tick_inset_inner: 20, HourCentreOuterRadius: 6, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 4, SecondHandCentreInnerRadius: 1, hour_hand_p2x: 36, hour_hand_p2y: 36, min_hand_p2x: 8, min_hand_p2y: 8, second_hand_a: 17, second_hand_b: 0, seconds_circle_radius: 18, seconds_circle_centre_x: 72, seconds_circle_centre_y: 114, romanadjust: 1, BTIconRect: [36, 16, 36, 20], QTIconRect: [75, 16, 36, 20], IconNowRect: [0, 32, 70, 18], IconNowRect2: [0, 36, 70, 18], RainIconRect: [30, 56, 30, 18], WarningIconRect: [97, 57, 30, 18], weather_icon_size: 16, forecast_offset: 21, weather_temp_grow: 4, aplite_temp_dy: [-2, 2], aplite_fore_dy: 20 },
        round: { DateBottomYPosition: 48, yOffset: -7, yOffsetFctx: 2, yWeekdayDateOffset: 21, BatteryYOffset: 42, BatteryLineYOffset: 61, font_size_digits: 32, digit_inset: 23, font_size_battery: 16, font_size_date: 22, battery_pos_z: 0, battery_pos_y: 4, battery_line: 51, analogue_hand_a: 10, analogue_hand_c: 0, hands_shadow: 2, corner_radius_minutehand: 0, corner_radius_hourhand: 0, corner_radius_majortickrect: 0, corner_radius_minortickrect: 0, majortickrect_w: 0, majortickrect_h: 0, minortickrect_w: 0, minortickrect_h: 0, outertickinset: 6, innertickinset: 11, majorticklength: 6, majorticklengthinner: 22, tick_inset_outer: 0, tick_inset_inner: 0, HourCentreOuterRadius: 6, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 4, SecondHandCentreInnerRadius: 1, hour_hand_p2x: 0, hour_hand_p2y: 0, min_hand_p2x: 0, min_hand_p2y: 0, second_hand_a: 20, second_hand_b: 0, seconds_circle_radius: 21, seconds_circle_centre_x: 90, seconds_circle_centre_y: 121, romanadjust: 0, BTIconRect: [54, 17, 32, 20], QTIconRect: [97, 16, 32, 20], IconNowRect: [0, 37, 88, 18], IconNowRect2: [0, 41, 88, 18], RainIconRect: [48, 61, 30, 18], WarningIconRect: [115, 62, 30, 18], weather_icon_size: 16, forecast_offset: 21, weather_temp_grow: 4 },
        default: { DateBottomYPosition: 40, yOffset: -7, yOffsetFctx: 2, yWeekdayDateOffset: 16, BatteryYOffset: 37, BatteryLineYOffset: 56, font_size_digits: 28, digit_inset: 10, font_size_battery: 16, font_size_date: 20, battery_pos_z: 0, battery_pos_y: 4, battery_line: 51, analogue_hand_a: 1, analogue_hand_c: 1, hands_shadow: 2, corner_radius_minutehand: 15, corner_radius_hourhand: 6, corner_radius_majortickrect: 15, corner_radius_minortickrect: 15, majortickrect_w: 70, majortickrect_h: 80, minortickrect_w: 70, minortickrect_h: 80, outertickinset: 6, innertickinset: 10, majorticklength: 6, majorticklengthinner: 14, tick_inset_outer: -10, tick_inset_inner: 20, HourCentreOuterRadius: 6, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 4, SecondHandCentreInnerRadius: 1, hour_hand_p2x: 36, hour_hand_p2y: 36, min_hand_p2x: 8, min_hand_p2y: 8, second_hand_a: 16, second_hand_b: 0, seconds_circle_radius: 18, seconds_circle_centre_x: 72, seconds_circle_centre_y: 114, romanadjust: 1, BTIconRect: [36, 16, 36, 20], QTIconRect: [75, 16, 36, 20], IconNowRect: [0, 32, 70, 18], IconNowRect2: [0, 36, 70, 18], RainIconRect: [30, 56, 30, 18], WarningIconRect: [97, 57, 30, 18], weather_icon_size: 16, forecast_offset: 21, weather_temp_grow: 4 },
    };

    // ---- Colours ----

    // Pebble's reflective LCD renders the raw 64-colour palette more muted than the
    // nominal RGB values suggest. This is the sunlight-corrected table (as used on
    // developer.rebble.io's colour picker): raw palette hex -> hex as it looks on the watch.
    var SUNLIGHT_CORRECTED = {
        "000000": "000000", "000055": "001E41", "0000AA": "004387", "0000FF": "0068CA", "005500": "2B4A2C",
        "005555": "27514F", "0055AA": "16638D", "0055FF": "007DCE", "00AA00": "5E9860", "00AA55": "5C9B72",
        "00AAAA": "57A5A2", "00AAFF": "4CB4DB", "00FF00": "8EE391", "00FF55": "8EE69E", "00FFAA": "8AEBC0",
        "00FFFF": "84F5F1", "550000": "4A161B", "550055": "482748", "5500AA": "40488A", "5500FF": "2F6BCC",
        "555500": "564E36", "555555": "545454", "5555AA": "4F6790", "5555FF": "4180D0", "55AA00": "759A64",
        "55AA55": "759D76", "55AAAA": "71A6A4", "55AAFF": "69B5DD", "55FF00": "9EE594", "55FF55": "9DE7A0",
        "55FFAA": "9BECC2", "55FFFF": "95F6F2", "AA0000": "99353F", "AA0055": "983E5A", "AA00AA": "955694",
        "AA00FF": "8F74D2", "AA5500": "9D5B4D", "AA5555": "9D6064", "AA55AA": "9A7099", "AA55FF": "9587D5",
        "AAAA00": "AFA072", "AAAA55": "AEA382", "AAAAAA": "ABABAB", "AAAAFF": "A7BAE2", "AAFF00": "C9E89D",
        "AAFF55": "C9EAA7", "AAFFAA": "C7F0C8", "AAFFFF": "C3F9F7", "FF0000": "E35462", "FF0055": "E25874",
        "FF00AA": "E16AA3", "FF00FF": "DE83DC", "FF5500": "E66E6B", "FF5555": "E6727C", "FF55AA": "E37FA7",
        "FF55FF": "E194DF", "FFAA00": "F1AA86", "FFAA55": "F1AD93", "FFAAAA": "EFB5B8", "FFAAFF": "ECC3EB",
        "FFFF00": "FFEEAB", "FFFF55": "FFF1B5", "FFFFAA": "FFF6D3", "FFFFFF": "FFFFFF"
    };

    var applySunlightCorrection = function(hex) {
        if (!hex) return hex;
        var key = String(hex).replace('#', '').toUpperCase();
        var corrected = SUNLIGHT_CORRECTED[key];
        return corrected ? ('#' + corrected) : hex;
    };

    // The preset colour themes from COLOUR_THEMES in nomos.c (colour watches).
    // shadow = minute-hand shadow colour when shadows are on; minor = minor ticks;
    // text = date, hour digits and major ticks; hands = hour & minute hand;
    // accent = seconds and month hands; battery = battery meter.
    var PREVIEW_THEMES = {
        wh: { bg: "#FFFFFF", shadow: "#AAAAFF", minor: "#000000", text: "#000000", hands: "#0055AA", accent: "#FF5500", battery: "#FF5500", btqt: "#555555" },
        bl: { bg: "#000000", shadow: "#555555", minor: "#555555", text: "#FFFF00", hands: "#FFFFFF", accent: "#FFFFFF", battery: "#FFFF00", btqt: "#AAAAAA" },
        bu: { bg: "#000055", shadow: "#000000", minor: "#55AAFF", text: "#FFFF00", hands: "#FFFFFF", accent: "#FF0000", battery: "#FF0000", btqt: "#55AAFF" },
        pl: { bg: "#AA00AA", shadow: "#550055", minor: "#550055", text: "#FFAAFF", hands: "#FFAAFF", accent: "#550000", battery: "#550000", btqt: "#550055" },
        gr: { bg: "#000000", shadow: "#005500", minor: "#005500", text: "#55FF00", hands: "#55FF00", accent: "#FFFFAA", battery: "#FFFFAA", btqt: "#005500" }
    };

    var parseClayColor = function(value, fallback) {
        if (value === undefined || value === null || value === '') return fallback;
        var hex;
        if (typeof value === 'number') {
            hex = value.toString(16);
        } else {
            hex = String(value).replace(/^#|^0x/i, '');
        }
        while (hex.length < 6) hex = '0' + hex;
        if (hex.length > 6) hex = hex.slice(-6); // defensive: drop a stray alpha byte
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;
        return '#' + hex.toUpperCase();
    };

    var getVal = function(key, fallback) {
        var item = config.getItemByMessageKey(key);
        if (!item) return fallback;
        var v = item.get();
        return (v === undefined || v === null || v === '') ? fallback : v;
    };

    var getIntVal = function(key, fallback) {
        var v = parseInt(getVal(key, fallback), 10);
        return isNaN(v) ? fallback : v;
    };

    var getBoolVal = function(key, fallback) {
        var item = config.getItemByMessageKey(key);
        if (!item) return fallback;
        return !!item.get();
    };

    var getColourVal = function(key, fallback) {
        return parseClayColor(getVal(key), fallback);
    };

    // Which palette entries the watch would use for the current settings.
    // Mirrors the ThemeSelect / BWThemeSelect handling in prv_inbox_received_handler().
    var resolvePreviewColours = function(bw) {
        var c;
        var shadowOn;

        if (bw) {
            shadowOn = getBoolVal("BWShadowOn", true);
            var bwTheme = getVal("BWThemeSelect", "bl");

            if (bwTheme === "wh" || bwTheme === "bl") {
                var fg = bwTheme === "wh" ? "#000000" : "#FFFFFF";
                var bwBg = bwTheme === "wh" ? "#FFFFFF" : "#000000";
                c = {
                    bg: bwBg, subdial: bwBg, shadow: shadowOn ? "#555555" : bwBg,
                    minorTick: fg, majorTick: fg, hourDigits: fg, date: fg, info: fg,
                    hands: fg, hourHand: fg, seconds: fg, month: fg, batteryLine: fg, btqt: fg
                };
            } else {
                var customBg = getColourVal("BWBackgroundColor1", "#FFFFFF");
                var handsColour = getColourVal("BWMinHandBatLineColor", "#000000");
                var ticks = getColourVal("BWMajorTickColor", "#000000");
                c = {
                    bg: customBg,
                    subdial: getColourVal("BWSubDialColor", "#FFFFFF"),
                    shadow: shadowOn ? getColourVal("BWMinuteHandShadowColor", "#AAAAAA") : customBg,
                    minorTick: ticks, majorTick: ticks,
                    hourDigits: getColourVal("BWHourDigitsColor", "#000000"),
                    date: getColourVal("BWDateColor", "#000000"),
                    info: getColourVal("BWBatteryWeatherColor", "#000000"),
                    hands: handsColour,
                    hourHand: getColourVal("BWHourHandColor", handsColour),
                    seconds: getColourVal("BWSecondsHandColor", "#000000"),
                    month: getColourVal("BWMonthHandColor", "#000000"),
                    batteryLine: handsColour,
                    btqt: getColourVal("BWBTQTColor", "#000000")
                };
            }
        } else {
            shadowOn = getBoolVal("ShadowOn", true);
            var theme = PREVIEW_THEMES[getVal("ThemeSelect", "bu")];

            if (theme) {
                c = {
                    bg: theme.bg, subdial: theme.bg, shadow: shadowOn ? theme.shadow : theme.bg,
                    minorTick: theme.minor, majorTick: theme.text, hourDigits: theme.text, date: theme.text, info: theme.text,
                    hands: theme.hands, hourHand: theme.hands, seconds: theme.accent, month: theme.accent,
                    batteryLine: theme.battery, btqt: theme.btqt
                };
            } else {
                var bg = getColourVal("BackgroundColor1", "#FFFFFF");
                c = {
                    bg: bg,
                    subdial: getColourVal("SubDialColor", "#FFFF55"),
                    shadow: shadowOn ? getColourVal("MinuteHandShadowColor", "#AAAAAA") : bg,
                    minorTick: getColourVal("MinorTickColor", "#000000"),
                    majorTick: getColourVal("MajorTickColor", "#000000"),
                    hourDigits: getColourVal("HourDigitsColor", "#000000"),
                    date: getColourVal("DateColor", "#000000"),
                    info: getColourVal("BatteryWeatherColor", "#000000"),
                    hands: getColourVal("MinutesHandColor", "#FF5500"),
                    hourHand: getColourVal("HourHandColor", getColourVal("MinutesHandColor", "#FF5500")),
                    seconds: getColourVal("SecondsHandColor", "#FF5500"),
                    month: getColourVal("MonthHandColor", "#FF5500"),
                    batteryLine: getColourVal("BatteryLineColor", "#FF5500"),
                    btqt: getColourVal("BTQTColor", "#000000")
                };
            }

            // Sunlight-corrected values from here onwards, whether a preset or a custom colour
            for (var key in c) {
                if (c.hasOwnProperty(key)) c[key] = applySunlightCorrection(c[key]);
            }
        }

        c.shadowOn = shadowOn;
        return c;
    };

    // -----------------------------------------------------------------
    // Platform detection. Clay puts the connected watch's info on
    // config.meta.activeWatchInfo. "PreviewPlatformOverride" in config.js is a
    // manual escape hatch for when that's missing or wrong.
    // -----------------------------------------------------------------
    var getPreviewScreen = function() {
        var overrideVal = getVal("PreviewPlatformOverride", "auto");
        if (overrideVal !== "auto" && PREVIEW_SCREENS[overrideVal]) {
            return PREVIEW_SCREENS[overrideVal];
        }

        var info = config.meta && config.meta.activeWatchInfo;
        var platform = info && info.platform;
        return PREVIEW_SCREENS[platform] || PREVIEW_SCREENS.basalt;
    };

    // ---- Sample date text: the tables from weekday.c and month.c ----

    var PREVIEW_WEEKDAYS = {
        "es_ES": ["DOM", "LUN", "MAR", "MI\u00c9", "JUE", "VIE", "S\u00c1B"],
        en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
        "de_DE": ["SON", "MON", "DIE", "MIT", "DON", "FRE", "SAM"],
        "fr_FR": ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"],
        "pt_PT": ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "S\u00c1B"],
        "it_IT": ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"],
        "sv_SE": ["S\u00d6N", "M\u00c5N", "TIS", "ONS", "TOR", "FRE", "L\u00d6R"],
        "nl_NL": ["ZO.", "MA.", "DI.", "WO.", "DO.", "VR.", "ZA."],
        "da_DK": ["S\u00d8N.", "MAN.", "TIR.", "ONS.", "TOR.", "FRE.", "L\u00d8R."],
        "no_NO": ["S\u00d8N.", "MAN.", "TIR.", "ONS.", "TOR.", "FRE.", "L\u00d8R."],
        "fi_FI": ["SU", "MA", "TI", "KE", "TO", "PE", "LA"]
    };
    var PREVIEW_MONTHS = {
        "es_ES": ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"],
        en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
        "de_DE": ["JAN", "FEB", "M\u00c4R", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"],
        "fr_FR": ["JAN", "F\u00c9V", "MAR", "AVR", "MAI", "JUN", "JUL", "AO\u00db", "SEP", "OCT", "NOV", "D\u00c9C"],
        "pt_PT": ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"],
        "it_IT": ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"],
        "sv_SE": ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"],
        "nl_NL": ["JAN.", "FEB.", "MRT.", "APR.", "MEI", "JUN.", "JUL.", "AUG.", "SEP.", "OKT.", "NOV.", "DEC."],
        "da_DK": ["JAN.", "FEB.", "MAR.", "APR.", "MAJ", "JUN.", "JUL.", "AUG.", "SEP.", "OKT.", "NOV.", "DEC."],
        "no_NO": ["JAN.", "FEB.", "MAR.", "APR.", "MAI", "JUN.", "JUL.", "AUG.", "SEP.", "OKT.", "NOV.", "DES."],
        "fi_FI": ["TAMMI.", "HELMI.", "MAALIS.", "HUHTI.", "TOUKO.", "KES\u00c4.", "HEIN\u00c4.", "ELO.", "SYYS.", "LOKA.", "MARRAS.", "JOULU."]
    };

    var PREVIEW_SAMPLE_WEEKDAY = 3;  // Wednesday (tm_wday)
    var PREVIEW_SAMPLE_MONTH = 8;    // September (tm_mon, so the month hand sits at 9)
    var PREVIEW_SAMPLE_DAY = 30;

    // Like fetchwday()/fetchmonth(): exact locale match, otherwise English. "auto" on the
    // watch is the system locale (e.g. "fr_FR"); here it's the phone's language.
    var previewDateParts = function(languageSetting) {
        var lang = languageSetting;
        if (lang === "auto") {
            lang = ((typeof navigator !== 'undefined' && navigator.language) || "en_US").replace("-", "_");
        }
        var weekdays = PREVIEW_WEEKDAYS[lang] || PREVIEW_WEEKDAYS.en;
        var months = PREVIEW_MONTHS[lang] || PREVIEW_MONTHS.en;
        return { weekday: weekdays[PREVIEW_SAMPLE_WEEKDAY], month: months[PREVIEW_SAMPLE_MONTH], day: PREVIEW_SAMPLE_DAY };
    };

    var previewDateText = function(format, parts) {
        switch (String(format)) {
            case "1": return parts.month + " " + parts.day;
            case "2": return parts.day + " " + parts.month;
            case "3": return String(parts.day);
            case "4": return (parts.day < 10 ? "0" : "") + parts.day;
            default:  return parts.weekday + " " + parts.day;
        }
    };

    // Sample weather, in Celsius. When "Temperature in F" is on the same weather is shown in
    // Fahrenheit, rounded the way weather.js rounds it (21 -> 70, 25 | 12 -> 77 | 54).
    var PREVIEW_WEATHER_C = { temp: 21, high: 25, low: 12 };
    var previewTemp = function(celsius, fahrenheit) {
        return Math.round(fahrenheit ? celsius * 9 / 5 + 32 : celsius);
    };

    var ROMAN_DIGITS = { 2: "II", 4: "IIII", 6: "VI", 8: "VIII", 10: "X", 12: "XII" };

    // ---- Maths: ports of the integer routines in MathUtils.c, so points land on the same pixels ----

    var TRIG_MAX_ANGLE = 0x10000;
    var TRIG_MAX_RATIO = 0xffff;

    var idiv = function(a, b) { return (a / b) | 0; };           // C integer division (truncates)
    var itrunc = function(v) { return v < 0 ? Math.ceil(v) : Math.floor(v); };
    var toRad = function(deg) { return deg * Math.PI / 180; };

    // Pebble trig: angles are 0..TRIG_MAX_ANGLE, results are -TRIG_MAX_RATIO..TRIG_MAX_RATIO
    var degToTrig = function(deg) { return itrunc(deg * TRIG_MAX_ANGLE / 360); };
    var sinLookup = function(trig) { return Math.round(Math.sin(2 * Math.PI * trig / TRIG_MAX_ANGLE) * TRIG_MAX_RATIO); };
    var cosLookup = function(trig) { return Math.round(Math.cos(2 * Math.PI * trig / TRIG_MAX_ANGLE) * TRIG_MAX_RATIO); };

    var isqrt = function(n) {
        n = n >>> 0;
        if (n === 0) return 0;
        var root = 0;
        var bit = 1 << 30;
        while (bit > n) bit >>>= 2;
        while (bit !== 0) {
            if (n >= root + bit) {
                n -= root + bit;
                root += 2 * bit;
            }
            root >>>= 1;
            bit >>>= 2;
        }
        return root >>> 0;
    };

    // Angles throughout are degrees, 0 = 3 o'clock, increasing clockwise (so -90 = 12 o'clock).
    // polar_to_point_offset()
    var polarPoint = function(origin, deg, distance) {
        var trig = degToTrig(deg);
        return {
            x: origin.x + itrunc(distance * cosLookup(trig) / TRIG_MAX_ANGLE),
            y: origin.y + itrunc(distance * sinLookup(trig) / TRIG_MAX_ANGLE)
        };
    };

    // angle_to_rect_edge(): where a ray from (cx, cy) leaves the rectangle (rx, ry, rw, rh)
    var rayRectEdge = function(cx, cy, deg, rx, ry, rw, rh) {
        var trig = degToTrig(deg);
        var dx = cosLookup(trig);
        var dy = sinLookup(trig);
        var t = 2147483647;
        var v;
        if (dx > 0) { v = itrunc(((rx + rw - 1 - cx) * TRIG_MAX_RATIO) / dx); if (v < t) t = v; }
        else if (dx < 0) { v = itrunc(((rx - cx) * TRIG_MAX_RATIO) / dx); if (v < t) t = v; }
        if (dy > 0) { v = itrunc(((ry + rh - 1 - cy) * TRIG_MAX_RATIO) / dy); if (v < t) t = v; }
        else if (dy < 0) { v = itrunc(((ry - cy) * TRIG_MAX_RATIO) / dy); if (v < t) t = v; }
        return { x: cx + itrunc(dx * t / TRIG_MAX_RATIO), y: cy + itrunc(dy * t / TRIG_MAX_RATIO) };
    };

    // angle_to_rounded_rect_edge(): where a ray from the centre leaves a rounded rectangle
    // with the given half-width, half-height and corner radius
    var rayRoundedRect = function(cx, cy, deg, halfW, halfH, r) {
        var trig = degToTrig(deg);
        var dx16 = (cosLookup(trig) + 32) >> 6;
        var dy16 = (sinLookup(trig) + 32) >> 6;
        var ratio = TRIG_MAX_RATIO >> 6;

        var t = 2147483647;
        var v;
        if (dx16 > 0) { v = itrunc((halfW - 1) * ratio / dx16); if (v < t) t = v; }
        else if (dx16 < 0) { v = itrunc((-halfW) * ratio / dx16); if (v < t) t = v; }
        if (dy16 > 0) { v = itrunc((halfH - 1) * ratio / dy16); if (v < t) t = v; }
        else if (dy16 < 0) { v = itrunc((-halfH) * ratio / dy16); if (v < t) t = v; }

        var px = itrunc((dx16 * t + idiv(ratio, 2)) / ratio);
        var py = itrunc((dy16 * t + idiv(ratio, 2)) / ratio);

        // Corner projection
        var innerW = halfW - r;
        var innerH = halfH - r;
        if ((px > innerW || px < -innerW) && (py > innerH || py < -innerH)) {
            var ccx = px > 0 ? innerW : -innerW;
            var ccy = py > 0 ? innerH : -innerH;
            var ex = px - ccx;
            var ey = py - ccy;
            var ex16 = ex << 4;
            var ey16 = ey << 4;
            var len16 = isqrt(ex16 * ex16 + ey16 * ey16);
            if (len16 > 0) {
                px = ccx + itrunc((ex * r * 16 + idiv(len16, 2)) / len16);
                py = ccy + itrunc((ey * r * 16 + idiv(len16, 2)) / len16);
            }
        }
        return { x: cx + px, y: cy + py };
    };

    // -----------------------------------------------------------------
    // Everything the preview needs, read from the settings on the page
    // -----------------------------------------------------------------
    var getPreviewModel = function() {
        var screen = getPreviewScreen();
        var g = PREVIEW_GEOMETRY[screen.geom];

        return {
            screen: screen,
            g: g,
            w: screen.w,
            h: screen.h,
            bw: screen.bw,
            round: screen.round,
            aplite: !!screen.aplite,
            hasWeather: !!screen.weather,
            // ForegroundShape only exists on rectangular watches: on = round, off = rectangular
            roundForeground: screen.round || getBoolVal("ForegroundShape", true),
            roman: getBoolVal("Roman", false),
            hourTicksOnly: getBoolVal("HourTicksOnly", false),
            enableDate: getBoolVal("EnableDate", true),
            dateFormat: getVal("DateFormat", "0"),
            dateLanguage: getVal("DateLanguage", "auto"),
            enableBattery: getBoolVal("EnableBattery", true),
            enableBatteryLine: getBoolVal("EnableBatteryLine", true),
            showBtqtIcons: getBoolVal("ShowBTQTIcons", true),
            showMajorTick: getBoolVal("showMajorTick", true),
            showMinorTick: getBoolVal("showMinorTick", true),
            subdial: getIntVal("SubDialChoice", 0),
            showRemoteAMPM: getBoolVal("showremoteAMPM", true),
            useWeather: !!screen.weather && getBoolVal("UseWeather", false),
            fahrenheit: getBoolVal("WeatherUnit", false),
            showCurrent: getBoolVal("ShowCurrent", true),
            showForecast: getBoolVal("ShowForecast", true),
            showAlert: getBoolVal("ShowAlert", true),
            minuteThickness: getIntVal("MinuteHandThickness", 2),
            hourThickness: getIntVal("HourHandThickness", 2),
            minuteCentre: getIntVal("MinuteCentreSize", g.HourCentreOuterRadius - 2),
            hourCentre: getIntVal("HourCentreSize", g.HourCentreOuterRadius),
            innerCentre: getIntVal("InnerCentreSize", g.HourCentreInnerRadius),
            backSize: getIntVal("BackSize", 0),
            backLen: getIntVal("BackLen", 0),
            // 0 flat colour, 1 picture1, 2 picture2 (colour watches only)
            backgroundStyle: screen.bw ? 0 : getIntVal("BackgroundStyle", 0),
            c: resolvePreviewColours(screen.bw)
        };
    };

    // -----------------------------------------------------------------
    // Background pictures (colour watches only): BackgroundStyle 1 = picture1, 2 = picture2.
    // The watch draws resources/images/picture1-*.png / picture2-*.png (IMAGE_PICTURE1 /
    // IMAGE_PICTURE2 in bg_update_proc). The preview can't read those files, so it uses:
    //   1. a copy of the picture embedded in PICTURE_DATA below, if there is one, or else
    //   2. built-in drawing code (picture2Pixels - picture2's rainbow rose), or else
    //   3. the flat background colour.
    // AFTER REPLACING A PICTURE'S PNGs, run   python3 tools/embed_pictures.py 1   (or 2, or 1 2)
    // from the project folder to refresh the embedded copy.
    // -----------------------------------------------------------------
    // BEGIN PICTURE DATA (generated by tools/embed_pictures.py - don't edit by hand)
    var PICTURE_DATA = {
        "1": {
            "144x168": "data:image/png;base64,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",
            "180x180": "data:image/png;base64,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",
            "200x228": "data:image/png;base64,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",
            "260x260": "data:image/png;base64,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"
        }
    };
    // END PICTURE DATA

    var PICTURE_IMAGES = {};
    var BG_PICTURE_CACHE = {};
    var PEBBLE_LEVELS = [0, 85, 170, 255];

    // Embedded copy of a picture for this screen size: an <img> once it has loaded, null while
    // it's still loading (the preview redraws when it arrives), undefined if not embedded.
    var getEmbeddedPicture = function(style, w, h) {
        var set = (typeof PICTURE_DATA !== "undefined") && PICTURE_DATA[String(style)];
        var src = set && set[w + "x" + h];
        if (!src) return undefined;
        var key = style + ":" + w + "x" + h;
        var img = PICTURE_IMAGES[key];
        if (!img) {
            img = new Image();
            img.onload = function() { drawPreview(); };
            img.src = src;
            PICTURE_IMAGES[key] = img;
        }
        return (img.complete && img.naturalWidth) ? img : null;
    };

    var hsvToRgb255 = function(h, s, v) {
        h = ((h % 1) + 1) % 1 * 6;
        var i = Math.floor(h) % 6;
        var f = h - Math.floor(h);
        var p = v * (1 - s);
        var q = v * (1 - s * f);
        var t = v * (1 - s * (1 - f));
        var r, g, b;
        switch (i) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            default: r = v; g = p; b = q; break;
        }
        return [r * 255, g * 255, b * 255];
    };

    var BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    var picture2Pixels = function(w, h) {
        var n = 24, pale = 0.12, darkEdge = 0.45, paleReach = 0.6, deepBlue = 0.45;
        var cx = (w - 1) / 2, cy = (h - 1) / 2;
        var maxR = Math.sqrt(cx * cx + cy * cy);
        var R0 = maxR / 2, step = 2 * Math.PI / n;
        var clip = function(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
        var data = new Uint8ClampedArray(w * h * 4);
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var dx = x - cx, dy = y - cy;
                var r = Math.sqrt(dx * dx + dy * dy);
                var theta = Math.atan2(dy, dx);
                var alpha = Math.acos(clip(r / (2 * R0), 0, 1));
                // which petal: between arcs iu..iu+1 of one spiral family, iv..iv+1 of the other
                var uc = Math.floor((theta - alpha) / step) + 0.5;
                var vc = Math.floor((theta + alpha) / step) + 0.5;
                // that petal's centre, in polar coordinates
                var thC = (uc + vc) * step / 2;
                var rn = 2 * R0 * Math.cos(clip((vc - uc) * step / 2, 0, Math.PI / 2)) / maxR;

                var twoPi = 2 * Math.PI;
                // angle from 12 o'clock: <0 on the left, >0 on the right; d = 0 top .. 1 bottom
                var signed = ((((thC + 1.5 * Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
                var d = Math.abs(signed) / Math.PI;
                var hue;
                if (signed < 0) {   // left: yellow -> cyan over the top 90 deg, then -> blue
                    hue = d < 0.5 ? 1 / 6 + d * (1 / 3) / 0.5 : 1 / 2 + (d - 0.5) * (1 / 6) / 0.5;
                } else {            // right: yellow -> red -> magenta over the top 90 deg, then -> blue
                    hue = d < 0.5 ? 1 / 6 - d * (1 / 3) / 0.5 : -1 / 6 - (d - 0.5) * (1 / 6) / 0.5;
                }
                var sat = clip(pale + (rn / paleReach) * (1 - pale), pale, 1);
                var val = 1 - darkEdge * clip((rn - 0.5) / 0.5, 0, 1);
                val = val * (1 - deepBlue * clip((d - 0.55) / 0.45, 0, 1));   // deepen to navy at the bottom

                var rgb = hsvToRgb255(hue, sat, val);
                var thr = (BAYER4[y % 4][x % 4] + 0.5) / 16;
                var i = (y * w + x) * 4;
                for (var c = 0; c < 3; c++) {
                    var lv = Math.floor(clip(rgb[c], 0, 255) / 85 + thr);
                    data[i + c] = PEBBLE_LEVELS[lv < 0 ? 0 : (lv > 3 ? 3 : lv)];
                }
                data[i + 3] = 255;
            }
        }
        return data;
    };

    // Sunlight correction for pictures, same table as every other colour in the preview
    // (SUNLIGHT_CORRECTED). Indexed by palette position: (R/85)*16 + (G/85)*4 + B/85.
    var SUNLIGHT_RGB = (function() {
        var table = [];
        for (var i = 0; i < 64; i++) {
            var raw = [Math.floor(i / 16), Math.floor(i / 4) % 4, i % 4].map(function(n) {
                var hx = (n * 85).toString(16).toUpperCase();
                return hx.length < 2 ? "0" + hx : hx;
            }).join("");
            var c = SUNLIGHT_CORRECTED[raw];
            table.push([parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]);
        }
        return table;
    })();

    // Corrects RGBA pixel data in place. Pixels not exactly on the palette are left alone.
    var sunlightCorrectPixels = function(data) {
        for (var i = 0; i < data.length; i += 4) {
            var r = data[i], g = data[i + 1], b = data[i + 2];
            if (r % 85 || g % 85 || b % 85) continue;
            var c = SUNLIGHT_RGB[(r / 85) * 16 + (g / 85) * 4 + b / 85];
            data[i] = c[0];
            data[i + 1] = c[1];
            data[i + 2] = c[2];
        }
        return data;
    };

    // What to draw for BackgroundStyle `style` at this screen size, sunlight corrected, or
    // null for the flat colour (also while an embedded picture is still loading).
    var buildBackgroundPicture = function(style, w, h) {
        var cacheKey = style + ":" + w + "x" + h;
        if (BG_PICTURE_CACHE[cacheKey]) return BG_PICTURE_CACHE[cacheKey];

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var gctx = canvas.getContext('2d');
        var embedded = getEmbeddedPicture(style, w, h);
        if (embedded === null) return null;              // still loading; redraws when it's ready
        if (embedded) {
            gctx.drawImage(embedded, 0, 0);
            try {
                var imgData = gctx.getImageData(0, 0, w, h);
                sunlightCorrectPixels(imgData.data);
                gctx.putImageData(imgData, 0, 0);
            } catch (err) {
                // Browser won't let us read the pixels back: show the picture uncorrected
                console.error("Couldn't sunlight-correct picture " + style + ":", err);
            }
        } else if (style === 2) {
            var roseData = gctx.createImageData(w, h);
            roseData.data.set(sunlightCorrectPixels(picture2Pixels(w, h)));
            gctx.putImageData(roseData, 0, 0);
        } else {
            return null;
        }
        BG_PICTURE_CACHE[cacheKey] = canvas;
        return canvas;
    };

    // -----------------------------------------------------------------
    // Painting (one call per canvas). Mirrors the layer update procs in nomos.c,
    // drawn in the same bottom-to-top order as the watch's layers:
    //   background & ticks -> sub-dial -> BT/QT icons -> digits/date/battery text
    //   -> weather -> battery meter -> hour & minute hands
    // -----------------------------------------------------------------
    var paintPreview = function(ctx, m, scale) {
        var w = m.w, h = m.h, g = m.g, c = m.c, bw = m.bw;
        var roundFg = m.roundForeground;
        var cx = Math.floor(w / 2);
        var cy = Math.floor(h / 2);
        var origin = { x: cx, y: cy };
        var halfH = idiv(h, 2);

        // ---- drawing primitives ----
        // Ticks have square ends; hands (and their shadows) have rounded ends
        var line = function(a, b, width, colour, cap) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineWidth = width;
            ctx.lineCap = cap || 'butt';
            ctx.strokeStyle = colour;
            ctx.stroke();
        };
        var disc = function(p, radius, colour) {
            if (radius <= 0) return;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius + 0.5, 0, Math.PI * 2);
            ctx.fillStyle = colour;
            ctx.fill();
        };
        var shift = function(p, dx, dy) { return { x: p.x + dx, y: p.y + dy }; };

        // fctx-style text: em height in px, anchored by "top" / "middle", optional rotation (degrees)
        var fctxText = function(text, x, y, em, colour, align, anchor, rotationDeg) {
            ctx.save();
            ctx.translate(x, y);
            if (rotationDeg) ctx.rotate(toRad(rotationDeg));
            ctx.font = em + "px " + PREVIEW_TEXT_FAMILY;
            ctx.fillStyle = colour;
            ctx.textAlign = align;
            ctx.textBaseline = 'alphabetic';
            var dy = 0;
            if (anchor === "top") dy = PREVIEW_FONT_TOP_ASCENT * em;
            else if (anchor === "middle") dy = (PREVIEW_FONT_ASCENT - PREVIEW_FONT_DESCENT) / 2 * em;
            ctx.fillText(text, 0, dy);
            ctx.restore();
        };

        // graphics_draw_text-style text (aplite): top of the line box at y, centred on x
        // (or with its left edge at x for align 'left')
        var boxText = function(text, x, y, px, colour, align) {
            ctx.save();
            ctx.font = px + "px " + PREVIEW_TEXT_FAMILY;
            ctx.fillStyle = colour;
            ctx.textAlign = align || 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(text, x, y + PREVIEW_FONT_ASCENT * px);
            ctx.restore();
        };

        // Hand shadows are a line as wide as the hand. (The B&W watches can't draw a grey line, so
        // nomos.c fills a polygon there instead; on the phone it's simply drawn as a grey line,
        // exactly like a colour watch's shadow.)
        var shadowLine = function(a, b, thickness, colour) {
            line(a, b, thickness, colour, 'round');
        };

        var hs = g.hands_shadow;
        var hsHalf = idiv(hs, 2);

        // ---- Background ----
        ctx.save();
        if (m.round) {
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
            ctx.clip();
        }
        var picture = (m.backgroundStyle === 1 || m.backgroundStyle === 2)
            ? buildBackgroundPicture(m.backgroundStyle, w, h) : null;
        if (picture) {
            // Keep the watch's pixels crisp (no smoothing) when the preview is scaled up
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(picture, 0, 0);
            ctx.restore();
        } else {
            ctx.fillStyle = c.bg;
            ctx.fillRect(0, 0, w, h);
        }

        // Pixel coordinates in the watch code refer to pixel centres
        ctx.translate(0.5, 0.5);

        // ---- Ticks (bg_update_proc) ----
        // A point on the screen edge moved by `inset` px along the ray's direction, as the
        // watch's rectangular tick layout does (a negative inset moves it outwards)
        var edgeMinusInset = function(edge, angle, inset) {
            var trig = degToTrig(angle);
            return {
                x: edge.x - itrunc(cosLookup(trig) * inset / TRIG_MAX_ANGLE),
                y: edge.y - itrunc(sinLookup(trig) * inset / TRIG_MAX_ANGLE)
            };
        };

        var tickOuterEdge = function(angle) {
            return edgeMinusInset(rayRectEdge(cx, cy, angle, 0, 0, w, h), angle, g.tick_inset_outer);
        };

        var minorTickEnds = function(angle) {
            if (roundFg) {
                return [polarPoint(origin, angle, halfH - g.outertickinset), polarPoint(origin, angle, halfH)];
            }
            return [
                rayRoundedRect(cx, cy, angle, g.minortickrect_w, g.minortickrect_h, g.corner_radius_minortickrect),
                tickOuterEdge(angle)
            ];
        };

        var majorTickEnds = function(angle) {
            if (roundFg) {
                return [
                    polarPoint(origin, angle, halfH - g.outertickinset),
                    polarPoint(origin, angle, halfH - g.outertickinset + g.majorticklength)
                ];
            }
            return [
                rayRoundedRect(cx, cy, angle, g.majortickrect_w, g.majortickrect_h, g.corner_radius_majortickrect),
                tickOuterEdge(angle)
            ];
        };

        var innerTickEnds = function(angle) {
            if (roundFg) {
                return [
                    polarPoint(origin, angle, halfH - g.innertickinset),
                    polarPoint(origin, angle, halfH - g.innertickinset - g.majorticklengthinner)
                ];
            }
            var inset = g.innertickinset;
            var edge = rayRectEdge(cx, cy, angle, inset, inset, w - inset * 2, h - inset * 2);
            return [
                rayRoundedRect(cx, cy, angle, g.majortickrect_w - idiv(inset, 2),
                               g.majortickrect_h - idiv(inset, 2), g.corner_radius_majortickrect),
                edgeMinusInset(edge, angle, g.tick_inset_inner)
            ];
        };

        var i, ends;
        if (m.showMinorTick) {
            for (i = 0; i < 60; i++) {
                ends = minorTickEnds(i * 6);
                line(ends[0], ends[1], 1, bw ? c.majorTick : c.minorTick);
            }
        }
        if (m.showMajorTick) {
            for (i = 0; i < 12; i++) {
                var tickAngle = i * 30 - 90;
                ends = majorTickEnds(tickAngle);
                line(ends[0], ends[1], 3, c.majorTick);

                // Digit-hour positions normally skip the inner tick; everything else draws
                // them at the odd hours. With hourTicksOnly on those positions get the same
                // double-tick treatment - except at 6 o'clock while the date is showing, since
                // the date text sits there instead of a digit and an inner tick would run
                // straight into it.
                var atDatePosition = (i === 6 && m.enableDate);
                var atDigitPosition = m.aplite ? (i === 0 || (i === 6 && !m.enableDate)) : (i % 2 === 0);
                if (atDatePosition || (atDigitPosition && !m.hourTicksOnly)) continue;
                ends = innerTickEnds(tickAngle);
                line(ends[0], ends[1], 3, c.majorTick);
            }
        }

        // ---- Sub-dial (seconds / month / second timezone) ----
        var subOrigin = { x: g.seconds_circle_centre_x, y: g.seconds_circle_centre_y };
        var subOuter = g.SecondHandCentreOuterRadius;
        var subInner = g.SecondHandCentreInnerRadius;

        var drawSubdialBackground = function() {
            var back = bw ? hs : hsHalf;
            disc(shift(subOrigin, -back, -back), g.seconds_circle_radius, c.shadow);
            disc(subOrigin, g.seconds_circle_radius - 1, c.subdial);
            for (var t = 0; t < 12; t++) {
                var a = t * 30 - 90;
                line(polarPoint(subOrigin, a, g.second_hand_a - g.majorticklength),
                     polarPoint(subOrigin, a, g.second_hand_a), 1, c.majorTick);
            }
        };

        var drawSubdialCentre = function(colour) {
            disc(subOrigin, subOuter, colour);
            disc(subOrigin, subInner, c.bg);
        };

        // The seconds hand and the month hand are the same shape and have the same shadow:
        // 1px down and to the right, on every platform.
        var SUBDIAL_SHADOW_OFFSET = 1;
        var drawSubdialHand = function(angle, length, colour) {
            var p1 = polarPoint(subOrigin, angle + 180, g.second_hand_b);
            var p2 = polarPoint(subOrigin, angle, length);

            // Centre shadow is always drawn (it's the background colour when shadows are off)
            disc(shift(subOrigin, SUBDIAL_SHADOW_OFFSET, SUBDIAL_SHADOW_OFFSET), subOuter, c.shadow);

            if (c.shadowOn) {
                shadowLine(shift(p1, SUBDIAL_SHADOW_OFFSET, SUBDIAL_SHADOW_OFFSET),
                           shift(p2, SUBDIAL_SHADOW_OFFSET, SUBDIAL_SHADOW_OFFSET), m.minuteThickness, c.shadow);
            }
            line(p1, p2, m.minuteThickness, colour, 'round');
        };

        var sample = { seconds: 20, month: 9, remoteHour12: 3, remoteMinute: 25, remotePM: true };

        if (m.subdial === 1 || m.subdial === 2) {
            // Seconds hand (for "timeout" mode this is how it looks while it is showing)
            drawSubdialBackground();
            drawSubdialHand(sample.seconds * 6 - 90, g.second_hand_a, c.seconds);
            drawSubdialCentre(c.seconds);
        } else if (m.subdial === 3 || m.subdial === 6) {
            drawSubdialBackground();
            drawSubdialHand(idiv(sample.month * 360, 12) - 90, g.second_hand_a, c.month);
            drawSubdialCentre(c.month);
            if (m.subdial === 6) {
                // "Month hand + seconds on shake": show the seconds hand as well, as it looks after a shake
                drawSubdialHand(sample.seconds * 6 - 90, g.second_hand_a, c.seconds);
                drawSubdialCentre(c.seconds);
            }
        } else if (m.subdial === 5) {
            // Second timezone: short hour hand (+ PM dot), full-length minute hand
            var hourAngle = idiv((sample.remoteHour12 * 60 + sample.remoteMinute) * 30, 60) - 90;
            var minuteAngle = sample.remoteMinute * 6 - 90;
            var shortLength = idiv(g.second_hand_a * 3, 4);

            drawSubdialBackground();
            drawSubdialHand(hourAngle, shortLength, c.month);
            if (sample.remotePM && m.showRemoteAMPM) {
                disc(polarPoint(subOrigin, hourAngle, idiv(shortLength, 2)), Math.floor(m.minuteThickness * 1.5), c.month);
            }
            drawSubdialHand(minuteAngle, g.second_hand_a, c.seconds);
            drawSubdialCentre(c.seconds);
        }

        // ---- Bluetooth / Quiet Time icons ----
        // Both are shown so their colour can be judged (on the watch they only appear
        // when Bluetooth is disconnected / Quiet Time is on), unless "Bluetooth & Quiet Time
        // Icons visible" is off - that hides both.
        var drawIcon = function(glyph, rect) {
            ctx.save();
            ctx.font = "16px '" + PREVIEW_FONT_ICONS + "', sans-serif";
            ctx.fillStyle = c.btqt;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(glyph, rect[0] + rect[2] / 2, rect[1]);
            ctx.restore();
        };
        if (m.showBtqtIcons) {
            drawIcon("z", g.BTIconRect);
            drawIcon("\uE061", g.QTIconRect);
        }

        // ---- Digits, date and battery value (update_logo_date_battery_fctx_layer) ----
        var batteryLevel = 80;

        if (m.hourTicksOnly) {
            // Numbers/Roman numerals replaced by plain tick marks - handled above in the tick loop
        } else if (m.aplite) {
            // Aplite only draws 12 (and 6 if the date is off), using a plain bitmap-style font
            boxText(m.roman ? "XII" : "12", 1 + idiv(w, 2), 6 + 1 - 4 + 2, 28, c.hourDigits);   // +2: the preview draws this font 2px higher than the watch does
            if (!m.enableDate) {
                boxText(m.roman ? "VI" : "6", 1 + idiv(w, 2), h - 28 - 11 + 1, 28, c.hourDigits);
            }
        } else {
            var digitEm = m.roman ? g.font_size_digits - g.romanadjust : g.font_size_digits;
            var digitRadius = idiv(w, 2) - g.digit_inset - (m.roman ? idiv(g.romanadjust, 2) : 0);

            for (var hourNum = 2; hourNum <= 12; hourNum += 2) {
                if (hourNum === 6 && m.enableDate) continue;

                var digitAngle = hourNum * 30; // 0 = 12 o'clock, clockwise
                // Digits are rotated to follow the dial; the ones on the bottom half are
                // flipped so they still read upright.
                var rotation = (hourNum < 4 || hourNum > 9) ? digitAngle : digitAngle + 180;
                var px = cx + 1 + Math.sin(toRad(digitAngle)) * digitRadius;
                var py = cy - Math.cos(toRad(digitAngle)) * digitRadius;

                fctxText(m.roman ? ROMAN_DIGITS[hourNum] : String(hourNum), px, py, digitEm, c.hourDigits, 'center', 'middle', rotation);
            }
        }

        if (m.enableDate) {
            var dateText = previewDateText(m.dateFormat, previewDateParts(m.dateLanguage));
            if (m.aplite) {
                boxText(dateText, idiv(w, 2), g.DateBottomYPosition + g.yOffset + g.yWeekdayDateOffset + 88, 20, c.date);
            } else {
                fctxText(dateText, idiv(w, 2), h - g.DateBottomYPosition + g.yOffset + g.yOffsetFctx + g.yWeekdayDateOffset,
                         g.font_size_date, c.date, 'center', 'top', 0);
            }
        }

        // Weather's current-icon-and-temperature replaces the battery value (nomos.c draws the
        // battery value whenever weather is off, or weather is on but "Show Current" is off)
        if (m.enableBattery && !(m.useWeather && m.showCurrent)) {
            if (m.aplite) {
                boxText(String(batteryLevel), idiv(w, 2), g.BatteryYOffset + (m.enableBatteryLine ? 0 : 4), 16, c.info);
            } else {
                fctxText(String(batteryLevel),
                         m.enableBatteryLine ? cx + 1 : cx,
                         g.BatteryYOffset + g.yOffsetFctx + (m.enableBatteryLine ? g.battery_pos_z : g.battery_pos_y),
                         g.font_size_battery, c.info, 'center', 'top', 0);
            }
        }

        // ---- Weather (every watch): sample values ----
        // Sample alert state: a rain warning and the most severe WBGT (heat stress) level, so
        // both alert icons are visible together for the user to check their colours against.
        var SAMPLE_RAIN_SOON = true;
        var SAMPLE_RAIN_AMOUNT = 6; // 0-10, index into RAIN_AMOUNT_GLYPHS (nomos.c's rain_amount[])
        var SAMPLE_WBGT_LEVEL = 3; // 0 = none, 1 = yellow, 2 = red, 3 = black

        // U+F0F6 .. U+F100, one glyph per index 0-10 (< 0.5mm up to >= 9.5mm in the next hour)
        var RAIN_AMOUNT_GLYPHS = ["\uF0F6", "\uF0F7", "\uF0F8", "\uF0F9", "\uF0FA", "\uF0FB",
                                   "\uF0FC", "\uF0FD", "\uF0FE", "\uF0FF", "\uF100"];

        if (m.useWeather) {
            var weatherIcon = function(glyph, size, rect, align) {
                ctx.save();
                ctx.font = size + "px '" + PREVIEW_FONT_WEATHER + "', sans-serif";
                ctx.fillStyle = c.info;
                ctx.textAlign = align;
                ctx.textBaseline = 'alphabetic';
                var x = align === 'right' ? rect[0] + rect[2] : rect[0];
                ctx.fillText(glyph, x, rect[1] + PREVIEW_WEATHER_ASCENT * size);
                ctx.restore();
            };

            if (m.showCurrent) {
                // Clear-sky glyph (weather icon 101), right-aligned in the icon rect
                var iconRect = m.enableBatteryLine ? g.IconNowRect : g.IconNowRect2;
                weatherIcon("\uF00D", g.weather_icon_size, iconRect, 'right');

                var tempText = previewTemp(PREVIEW_WEATHER_C.temp, m.fahrenheit) + "\u00B0";
                if (m.aplite) {
                    // aplite has no fctx: graphics_draw_text with the 18px Tangent font
                    boxText(tempText, cx + 2, g.BatteryYOffset + g.aplite_temp_dy[m.enableBatteryLine ? 0 : 1], 20, c.info, 'left');
                } else {
                    var tempY = g.BatteryYOffset + g.yOffsetFctx + (m.enableBatteryLine ? g.battery_pos_z : g.battery_pos_y) - 3;
                    fctxText(tempText, cx + 2, tempY, g.font_size_battery + g.weather_temp_grow, c.info, 'left', 'top', 0);
                }
            }

            if (m.showAlert) {
                if (SAMPLE_RAIN_SOON) {
                    // Rain-amount glyph for the next hour, graded by how much rain is expected
                    var rainGlyph = RAIN_AMOUNT_GLYPHS[SAMPLE_RAIN_AMOUNT] || "\uF084";
                    weatherIcon(rainGlyph, g.weather_icon_size, g.RainIconRect, 'left');
                }
                if (SAMPLE_WBGT_LEVEL > 0) {
                    // One glyph per severity: F0EC (yellow), F0ED (red), F0EE (black, level 3+)
                    var warnGlyph = SAMPLE_WBGT_LEVEL === 1 ? "\uF0EC" : SAMPLE_WBGT_LEVEL === 2 ? "\uF0ED" : "\uF0EE";
                    weatherIcon(warnGlyph, g.weather_icon_size, g.WarningIconRect, 'left');
                }
            }

            if (m.showForecast) {
                var foreText = previewTemp(PREVIEW_WEATHER_C.high, m.fahrenheit) + " | " +
                               previewTemp(PREVIEW_WEATHER_C.low, m.fahrenheit) + "\u00B0";
                if (m.aplite) {
                    boxText(foreText, cx + 1, g.BatteryYOffset + g.aplite_fore_dy, 16, c.info);
                } else {
                    fctxText(foreText, cx + 1, g.BatteryYOffset + g.yOffsetFctx + g.battery_pos_z + g.forecast_offset,
                             g.font_size_battery + 2, c.info, 'center', 'top', 0);
                }
            }
        }

        // ---- Battery meter ----
        if (m.enableBatteryLine) {
            var meterW = idiv(batteryLevel * g.battery_line, 100);
            ctx.fillStyle = bw ? c.hands : c.batteryLine;
            ctx.fillRect(cx - idiv(meterW, 2) - 0.5, g.BatteryLineYOffset - 0.5, meterW, 2);
        }

        // ---- Hour & minute hands ----
        var hourAngle24 = idiv(360 * 10, 12) + idiv(8, 2) - 90;   // 10:08
        var minuteAngle24 = idiv(360 * 8, 60) - 90;
        var handColour = c.hands;

        var handEnd = function(from, angle, length, extentX, extentY, cornerRadius) {
            if (roundFg) return polarPoint(from, angle, length);
            return rayRoundedRect(from.x, from.y, angle, idiv(w, 2) - extentX, idiv(h, 2) - extentY, cornerRadius);
        };

        // Hour hand
        (function() {
            var off = shift(origin, hs, hs);
            var len = idiv(w, 3) - (roundFg ? g.analogue_hand_a : g.analogue_hand_c);
            var p1 = polarPoint(origin, hourAngle24 + 180, m.backLen);
            var p2 = handEnd(origin, hourAngle24, len, g.hour_hand_p2x, g.hour_hand_p2y, g.corner_radius_hourhand);
            var p3 = polarPoint(off, hourAngle24 + 180, m.backLen);
            var p4 = handEnd(off, hourAngle24, len, g.hour_hand_p2x, g.hour_hand_p2y, g.corner_radius_hourhand);

            if (c.shadowOn) {
                shadowLine(p3, p4, m.hourThickness, c.shadow);
                disc(shift(p1, hs, hs), m.backSize, c.shadow);
                disc(off, m.hourCentre, c.shadow);
            }

            line(p1, p2, m.hourThickness, c.hourHand, 'round');
            disc(p1, m.backSize, c.hourHand);
            disc(origin, m.hourCentre, c.hourHand);
        })();

        // Minute hand
        (function() {
            var off = shift(origin, hs, hs);
            var len = idiv(w, 2) - g.analogue_hand_a;
            var p1 = polarPoint(origin, minuteAngle24 + 180, m.backLen);
            var p2 = handEnd(origin, minuteAngle24, len, g.min_hand_p2x, g.min_hand_p2y, g.corner_radius_minutehand);
            var p3 = polarPoint(off, minuteAngle24 + 180, m.backLen);
            var p4 = handEnd(off, minuteAngle24, len, g.min_hand_p2x, g.min_hand_p2y, g.corner_radius_minutehand);

            if (c.shadowOn) {
                shadowLine(p3, p4, m.minuteThickness, c.shadow);
            }
            // The watch always draws these two shadow discs (invisible when shadows are off,
            // because the shadow colour is then the background colour)
            disc(shift(p1, hsHalf, hsHalf), m.backSize, c.shadow);
            disc(shift(origin, hsHalf, hsHalf), m.minuteCentre, c.shadow);

            line(p1, p2, m.minuteThickness, handColour, 'round');
            disc(p1, m.backSize, handColour);
            disc(origin, m.minuteCentre, handColour);
        })();

        // Hub: background-coloured hole in the middle of the hands
        disc(origin, m.innerCentre, c.bg);

        ctx.restore();
    };

    // -----------------------------------------------------------------
    // Canvas placement. Several identical previews are inserted (near the top
    // and at the start of the colour and hand-style sections) because
    // position:sticky doesn't work in the Pebble config WebView. Each anchor
    // is a "text" item with a matching "id" in config.js.
    // -----------------------------------------------------------------
    var previewInstances = []; // [{ id, canvas, ctx }, ...]

    var ensurePreviewCanvases = function() {
        var anchorIds = getPreviewAnchorIds();
        for (var i = 0; i < anchorIds.length; i++) {
            var id = anchorIds[i];

            var alreadyBuilt = false;
            for (var j = 0; j < previewInstances.length; j++) {
                if (previewInstances[j].id === id) { alreadyBuilt = true; break; }
            }
            if (alreadyBuilt) continue;

            // A "text" item's id is only a ClayItem property, never a real HTML id, so
            // document.getElementById can't find it. Go through the item's
            // $manipulatorTarget (the inner <p>) instead.
            var container = null;
            var anchor = config.getItemById(id);
            if (anchor && anchor.$manipulatorTarget) {
                container = anchor.$manipulatorTarget[0] || anchor.$manipulatorTarget;
            }

            if (!container || !container.parentNode) {
                continue; // that anchor isn't in this build of the page
            }

            var wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.justifyContent = 'center';
            wrapper.style.padding = '12px 0';

            var canvas = document.createElement('canvas');
            canvas.style.height = 'auto';
            canvas.style.maxWidth = '100%'; // only matters if the page is narrower than the watch screen
            canvas.style.border = '1px solid #888';

            wrapper.appendChild(canvas);
            container.parentNode.replaceChild(wrapper, container);

            previewInstances.push({ id: id, canvas: canvas, ctx: canvas.getContext('2d') });
        }

        return previewInstances.length > 0;
    };

    var drawPreview = function() {
        // The preview is a nicety: if anything in it goes wrong, log it and leave the
        // rest of the settings page working.
        try {
            drawPreviewUnsafe();
        } catch (err) {
            console.error("Preview failed to draw:", err);
        }
    };

    var drawPreviewUnsafe = function() {
        if (!ensurePreviewCanvases()) return;

        var model = getPreviewModel();

        // Render at 2-3x so the vector shapes stay crisp when the canvas is scaled up
        var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 2;
        var scale = Math.max(2, Math.min(3, Math.ceil(dpr)));

        for (var k = 0; k < previewInstances.length; k++) {
            var canvas = previewInstances[k].canvas;
            var ctx = previewInstances[k].ctx;

            canvas.width = model.w * scale;
            canvas.height = model.h * scale;
            canvas.style.width = model.w + 'px'; // shown at the watch's own pixel size
            canvas.style.borderRadius = model.round ? '50%' : '4px';

            ctx.save();
            ctx.scale(scale, scale);
            paintPreview(ctx, model, scale);
            ctx.restore();
        }
    };

    // Every setting that visibly affects the preview
    var PREVIEW_WATCHED_KEYS = [
        "PreviewPlatformOverride",
        "ForegroundShape", "Roman", "EnableDate", "DateFormat", "DateLanguage",
        "EnableBattery", "EnableBatteryLine", "ShowBTQTIcons", "showMajorTick", "showMinorTick",
        "SubDialChoice", "showremoteAMPM", "UseWeather", "WeatherUnit", "ShowCurrent", "ShowForecast", "ShowAlert", "HourTicksOnly",
        "MinuteHandThickness", "HourHandThickness", "MinuteCentreSize", "HourCentreSize",
        "InnerCentreSize", "BackSize", "BackLen",
        "ShadowOn", "BackgroundStyle", "ThemeSelect", "BackgroundColor1", "MinuteHandShadowColor", "MajorTickColor",
        "MinorTickColor", "HourDigitsColor", "MinutesHandColor", "HourHandColor", "SecondsHandColor", "MonthHandColor",
        "SubDialColor", "DateColor", "BatteryWeatherColor", "BatteryLineColor", "BTQTColor",
        "BWShadowOn", "BWThemeSelect", "BWBackgroundColor1", "BWMinuteHandShadowColor", "BWMajorTickColor",
        "BWMinHandBatLineColor", "BWHourHandColor", "BWSecondsHandColor", "BWMonthHandColor", "BWSubDialColor",
        "BWHourDigitsColor", "BWDateColor", "BWBatteryWeatherColor", "BWBTQTColor"
    ];

    var initPreview = function() {
        PREVIEW_WATCHED_KEYS.forEach(function(key) {
            var item = config.getItemByMessageKey(key);
            if (item) {
                item.on('change', drawPreview);
            }
        });

        // Draw straight away with system-font stand-ins, then again once the real
        // digit / icon fonts have loaded (they're tiny, so this is near-instant).
        drawPreview();
        loadPreviewFonts().then(drawPreview);
    };

    config.on(config.EVENTS.AFTER_BUILD, function () {
        built = true;

        initLocationSearch();

        var stateItem = config.getItemByMessageKey("TZ_ID_STATE");
        if (stateItem) stateItem.hide();

        var debug = config.getItemById("TZ_DEBUG");
        if (debug) {
            debug.show();
            debug.set("Click 'Fetch Timezones' to load the timezone list.");
        }

        var retryBtn = config.getItemById("TZ_BUTTON");
        if (retryBtn) {
            retryBtn.on('click', function() {
                getTimezones();
            });
        }

        var subdial = config.getItemByMessageKey("SubDialChoice");
        if (subdial) {
            subdial.on('change', updateSubdialSectionVisibility);
            subdial.on('change', maybeAutoFetchTimezones);
        }
        updateSubdialSectionVisibility();
        maybeAutoFetchTimezones();

        var useWeather = config.getItemByMessageKey("UseWeather");
        if (useWeather) {
            useWeather.on('change', updateWeatherSectionVisibility);
            useWeather.on('change', updateParkHandsVisibility);
        }
        updateWeatherSectionVisibility();

        var parkHands = config.getItemByMessageKey("ShakeToParkHands");
        if (parkHands) {
            parkHands.on('change', updateParkHandsVisibility);
        }
        updateParkHandsVisibility();

        var enableDate = config.getItemByMessageKey("EnableDate");
        if (enableDate) {
            enableDate.on('change', updateDateOptionsVisibility);
        }
        updateDateOptionsVisibility();

        var ticksOnly = config.getItemByMessageKey("HourTicksOnly");
        if (ticksOnly) {
            ticksOnly.on('change', updateRomanVisibility);
        }
        updateRomanVisibility();

        THEME_SELECT_KEYS.forEach(function(key) {
            var themeItem = config.getItemByMessageKey(key);
            if (themeItem) {
                themeItem.on('change', updateCustomColourVisibility);
            }
        });
        updateCustomColourVisibility();

        initPreview();
    });
};