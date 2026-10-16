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
            // 0 flat colour, 1-9 background pictures (colour watches only)
            backgroundStyle: screen.bw ? 0 : getIntVal("BackgroundStyle", 0),
            c: resolvePreviewColours(screen.bw)
        };
    };

    // -----------------------------------------------------------------
    // Background pictures (colour watches only): BackgroundStyle 1 painted rainbow, 2 rose
    // rainbow, 3-9 the finishes. Each is a map (see tools/make_backgrounds.py): one byte per
    // pixel saying where it sits along the picture's colours (PicColor1-4). The watch turns the
    // map into colours with a 256-entry table and dithers to the 64 Pebble colours
    // (prv_draw_picture in nomos.c); this does exactly the same, from a copy of the maps below.
    // AFTER CHANGING A BACKGROUND, run   python3 tools/make_backgrounds.py   from the project
    // folder - it rebuilds the watch's resources and this copy together.
    // -----------------------------------------------------------------
    // BEGIN BACKGROUND MAPS (generated by tools/make_backgrounds.py - don't edit by hand)
    var BACKGROUND_STYLES = {"1": {"name": "painted", "kind": "painted", "defaults": ["FF0000", "FF5500", "FFFF00", "00AA55", "0055FF", "0000AA", "FF00AA"]}, "2": {"name": "rose", "kind": "rose", "defaults": ["FFFF00", "00FFFF", "FF00FF", "0000FF"]}, "3": {"name": "sunburst", "kind": "finish3", "defaults": ["55FFFF", "000055"]}, "4": {"name": "hammered", "kind": "finish", "defaults": ["0055FF", "55AAFF"]}, "6": {"name": "fume", "kind": "finish", "defaults": ["AAAAAA"]}, "7": {"name": "enamel", "kind": "finish", "defaults": ["55FF00", "FFFFFF"]}, "9": {"name": "textured", "kind": "finish", "defaults": ["AAAAAA", "FFFFFF"]}};
    var BACKGROUND_MAPS = {"painted": {"144x168": [2, "data:image/png;base64,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"], "180x180": [2, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAAAAAAdwx7eAAAXMElEQVR42lWZf1iT9R7+Xz1O/MW+B8UUFMQfJwFtziFP5jLMEJQUtTguXYKoM2f8EENIDT2VHCSEJJCcOWopTZ15JNFQEFGymT3AmksFLEVRwR9w6ED+wEnfP4ad7/f5Z9e1a9d9fXZ/7s/9vu/P8ww5yQCDmfpeN2V3XjiwYPYK5dmfn+cX3lncJVuzze7pcyNk3MAuLsZfKwqQLdsKkdHsP83JhrztxJOY9x/Hy2tC9965hdK+j775B3pjWtA4a/MzdLkBtMLM/IT83R/+fmY291c4U9j62b7FShtgV6oWLruPan9l0b1TYQGAQxpeNsqrhdIILInoDSOjhFjr4qv+lf2+ZOEs+dJB0hi0mwWGAeDv72+C1zl6hqM85hfgYUVv7HaVKhZp5/kRY75fXnxP8UqAw+FAsUyNl97LaykWgFoC0p803LwYM33bsb7KgWiJBfNEgXsA3Lt3z4MXfYb89NNPs39fuwX4RV0zunq8p8lmQxy5cP8k0V27wYEDhQKQvwl68EKDvuLz4Q0nB0Tv/I+2fseLMMRaN8v0G9ODBFzPYMjmRz4bMmQIawGWdFq5guiD3X4DvGQpGzrNZnaPxOFwQAfAc3q9BqBhaB/HwWN9pt+6SW4xi+tgwRgqT8oG33uKvXGmj89AK1u2k+0fCu7qqf0f2VCCCnLlvAuA6dR1SIkZHH+6IpQKQg36Cqbx6G70Hn4rF3esog+netWC9libsH5wz7qRb+ZHpmy5NXeXf/HPSyaWuX/NExXYb5go+1J6xR20xLxy3bkQFFBBRSjryGMdEB3NytiJX73Pjm5Ge2hBa27jKSH1U0+lHsdUtGxw4GDq6YS+E7kfbLKvARBvGk4BsJuFsn1sNU5quBwKoZkkVgA0w84b+P2aC494zoU4/Zke6NblN0we2WcMf2Ntdm9Gq2twnzile4InOcm0KlV3Tsx76E4joACU9uY+YysglHGJhZCpkC0f8+jD3x4EkJuU98OYOgLqapku9PDhX7jImE3+4bVfbfnq8egr/XCHeK0pB3Iw2U3nPih3R6v4QgGgbHPwawVQUXFRD6wT8q/zYdaLdUdIog/m2sbNjVoqnxJyzzN5oy+wy4EWULsD2zmVTHKyT6ynZ0gfOrUlxvEowJjgrmD9/tDQ0FAqRIDm79VDb7SkBM1ZlbuKY1raNrah/YtrgO8bu++uoBe96f+nP+Q9Az6tra12JSFvjtG8XWLMyWFNDTpdMlBSAYbQyxJkSt5bPmRW3NbeqwqEQIYM0GLWYka49xfyckbOf5ddT6D4enq/5wn5E4j1RInXW/aPHRno5sxJWenm+rHf6XUVFXkfYMhkXQN6iDpzcd/Y7y71aahvPQZAkAzAZVGFpheW7NmFmYzmJtSfVSXa3wSbygbiHHaPuJ4CxARAYJGNt+c3sY6LXnpEMt/vVpdbCycO0BVVtcL2GrRsZmOzi5DkLoD2Ue8+U/AWjmIOp1l5B4UI2FQqcHcGLt60qQ5219SQPEkHr5GJhIvrhlXq4xOPp4WG+65Rrxib5Dmrrm7BGCqFHADcAJNHdgaoHdmcA/X7gA3AZLMzq+3dg9rOkq1bl08agA4i+Q6WG9AjZbKuaCwd081BN93meCcJj/jqWEBALWbXNqZCa2sO2XRX8eeu3sxPf6Zqbh7YARVgM8l7TeY7BwQ4qAFKzC7GDZchM9N7zYP5S1OYs2cVuauA8XUA/HVkxvtMlYfvX/Tc/XswmH53bg5/d/InJT4q2w18VNLYjh11Zrmv+yVYc4xLkZ+/35x5uQUv9CJfD+oGVrVOaSgQoLs9vZEAs9b8P/G9iM4j55uiFcbDSax+3ATiA4gEyLlhurBynz9y3+2XakB2KRkzfTJD+cDyP+Hmsu+5HQKs4n0CGusGbdYiMBjoal2OyZgw8lBdtiO+32FF75KbU4p3O5DsJjuxKGPz0Jmbm3wgJYUaFXL6h0JF4pcthkyXhVCw/bXu3Fx2UECTVNu2kZ5V55tGcly+q/H19L8p2IIDpsBhqnvIAs22fK17/uiUx4Hihkk2oBG43NIBlzPfou82kuL4jvp6kMkwMQgzCNxLhdjYRtoh+RCw/RbZo62cHf4NZlmsklZlrJ1Tf2jQqj9auB9ABwyBlhaLhry8y1LTwFEduYF9/3V7PZDLV+KCWVrMCAzOguX/9PHpYMUohH8yd1h87+K864gotCpAaQcbzxRinrTSyrIxA4FI7mAotWiwaNBXjITON/suaFm4bhPEQ1staINchAwu/GYRGGlPYMiSl5Oujx4WAlI/ALsSTKhK/iwxk2ItV6yZRKARM6BfipcFYN04ISDy3Odh29hZQ+52Z38tx+oAGfdSs6bWrYSo/X4S/+HM1Ae3oEpVXIGjlyQqVUii6fdzSu1gRqwZyE89inhvUV4LLRrQeD2HEu3gm6S3/sdHqC9Av25BbVstyAYvyyKllKJe467tAvgJhrE+b8jbx9dfuo9NZXOK0rcveZaVdXK+edr8MdtABzdBjsYCGvLyoX/LgqKWo1wWgNNWAgLMgHCPVHD0WozJD0x89uvP3Cp+EHSKh7X3zCImRIl5z7/fC9xnPvpJSQwAQ78ECxqwcHGdL5eJbrldiQ7YvvMT6sxoQUjNymLvut+3Mg6ygZ85yOR+7o/oG1SChBKbCPsmhmjB95UdN/ZurXMzIpfd0S/VgEajKR2XOZbCTxx2BmimaCDe8k3sgN8ABFLJ0U/KffnHlC/QwfPFXzXNh86Hpx66W5eIgEoS4Zyv+Tv+cXvDPDvtCQBU9JAecTGU5rNhBiUnt2EBcoHY3465FJIANMlvu7esjQW4BQ/g8OnOB71tKjuIIHmdMaHddurSGiUeOTmB0IDeCygFKrhpVX931fzGThGIi4cLplgaEQC/sX4Fb4Z8VRae+BGkjZoMcBrgiycosQEiHq+8ZiaAvbvZmdzZiftYKrBABF4VkOZN/3/Nb69pgMACkLVtZPx4BLK4pomatgEYBYRwfGQxNdZpM2eyay4m7DdeKYEWNqA1UgOA+3a073G5BYAWgCPJCxKif/2c3FVsl/F36jCZEIAR864UvMwII0tYYmVaI4vdw3kYwkNfUCl9aBWlr9vD3c06ePiWPzCPEu9QvZfGAlhCQw27/rUmS56iOb0jyf8Sr+2EAMQxCFmp8ye/sPUre5UHlG31LxqrhiLKUIM6ilgbMN60pWvgUK2/w8OnbwutOW5KmFwByLEA4qu+L3/Y6zN1IZAUyCcZBswX2kBI5b0tIhJchfBf+p37N0AnbCmzWsFmt7MVzzZe3/b6jxtqM3dHWHDrSoAaDC1EoIFxmTCKmJFJcoB4/q4C2gABEkBEQRk6/06GTWw851JV+GnghpIboiwy+d+XVxKXMeBCNsoNoAN3X72XxWIBDdD9ms+gs4CQC3jsn+HKfLIsgtdLMieEG6kHis7NJxSYOZOHub18UN4AE6bxb3l/roiZvrnDv/1bNiXoWGFoAQ1Y8td9LQya4ATohjjYK6A1AwJJTJQ5RSjDCCQtrqYYiD4O3FIBXqgAng8ZkwIboebuJnKgQW+Ryy2QiLSiWZ7fk3dz/ePxBDPT5dVCl44V5r0SIeo0cH9QU7SM+cBLc/sc71stASCN94E2Uv52GCIoyvmo6xKMrUiMQAN5iA1O5rigd9QnQevf0VJJu+D2/NJvZ8zeQNVxrkI/d0ZTX+SuDuQwLOOGXQWiqIKph2qH1ZPO3NZL3W4gHxKq94pwARYOd32OIhfiQmmQo3V5SFzc+dp1jhDSKeuEpitApxWmzQ0yij5KkEAaz7yu2Yf8SWPx4cDwj4jsWApfAhbWsQmXG50naQf+4wCzeToIZEFcnHPYHdJGqRu3cGv0Ff8oK3MP8zHQYyEymYh0FKBUcyy5bB0lgKEDYCoMWAzkkitH00Fi2cmTHchPtCOkQgFovqnzvXaVcy90Zv00uriGcOai/x5JqULChkoFfmuASqmvR/4UQIuhRQNozizndBKQ1J10BMscthe9qg8iGJABcXCtpnvruUhgahHFQBmH/1X1R7TTbkMlqUDC78VGavfzWfjOtrNuUPL4PhqwaDR6seKZm8NdRUcj67C7nRwbUFvp0f6qQCqAWwIj0wCmeJ/LygfGzX3/4a0nMiUgIkngf8QTr0rKWDmI40Ty2DW/SqmQQl9tBsBypIkJ9lR+NUMwiwSyACj+XU6ZdRh2OPgA+g55ZZp6WC8VqCQJUZSJf36ysaSwLxze2RZ+DtiiQUMpEVyuMCxxbSRzfM9O6cGrZEVP5ivQbfIAuKIAaqwc51Q4viqba8ZIqCSo6YhdvPbhXKSOuw7AC4sFII+zW7/jpmvdV83zC2dUAnggIzULiPt+oPc+uPXChiv9oqwGAu+8wtSmarA5JdHmlAARrfl257EXCQnv8IKPF31goIVSEvkZWHFzONCRyrMNd3tGm+BaPxrjx3FGA7D6HGpgCL884E+VHRFUIiKWCe5oy14HZTgiMARDSwul0BJKLuxasRiQ+/OoczpaLXR4yAriXNi6JvrcAbb0zn1ZbwBGArYbgE2FaHO+q6MkkoE1tKG2dyB3jZcIej82GJMopLyxCLqTcvu4V2IG6BCuuZDTsPrB/PpPWAsGOMUYK6LKCwkVSE6eATIymGRk7xmbRQsWoJTSwxb9eNDnwu3yOctIYogcQKsN6hEfLDTGAbyLwhc9l+YCL9hMqETR5VFtSjkKhSNl6nezY/2qgUQLRAAYygTC7jfKYj6tnQLcCQa0ZvNfXNNXV4Ae/yXrHVgh+CUFXHniKSJJIshEUSVFAhtigL9lXy3hKhooLQUNXzdzZIfv0PLILVl0YwO0oK0VCp5WBiOor9T/riRKDZ9yDfVjvFwWAvDDUYCMDQGKt4/V74Jdea4UAnqcmgZgYfN7YxEeAVCHOejpkcF0DRjde3A3B4GXWL2a3oALWwVxjwHIgJL69R4goxQiKN/iVRE/0vL8DhjbP6Qd4mdWE1RHUNCBv2qSx2bCYTRkNwEEVn8KiBLYEAHbZEoAFDX5DnmwHNgeAaWErR8bShLLf58wbsDO4AmwPShIfuBAbe2BWNlT6J1GJKgfXe/fDHDpB789j3tJIpITQFJJb1RDCrhxzqgDiNeUlgNhVQaiBC737ftl9P3rQOkfi4Pts6BJ6JE1anS6qYB/cRQAL10bxhMkRGwuiQwDRmyI3JCg0z1NkmFhYZQD05p59b+NL59rKGXVpaEsqm4z15kRerSHVQcPWBt5ZXLN/9qgKCKBKJpEiF5DHf//0xEBYej1QL1mXuF9J+wIvDNufwcceNn3qfjijGAE6LfJ6vrmpXNrsYGISiIW4EsC1CUlJaAMBG5qXBmknAo0dKT3mhh2xNIB8UM6KoFYzEIBBQDeuvBwHZA9EjUAwaAIdkoSSDKw2cSIehhApGuqwVALUFoelg9YnDv/ueKqgY7TEBcEBGlNf2iFONJJhWZGAWRjBdQEBwMOGyKSKGKTnE7ph0KMAa5ubenAeHu7688lEPoBK9r27tmdoRk4B/hoOtSaFww4JgDeWT1Fs6aYSwawWoM/Lf40EJ6INhEJJ6IoinGQA5QAisa/6C7PtwCsXwpjDGG5q5gtngA4wHihp2Lj5TeK2sn+6IOtwGpgWDY4JZBwAswbRrKRDKADRWDO8KeHUVNh0Yw3r1+vqoypS9qBYs4tOfyGL0IqePfYKrlRYDhoQF1dPX81tzBXi6KIKOI67D/yLBsAIkm+BKURpYSRUHo5kTIuWkfNP30VcGzyuihnjFiHkEWzC/uHG0ZqmE8UQHB19Vyglw3bBckmYhOR0btH0NoSckDRQQQRYdAC54WZx0dmZWXlwpw5y5cHQVutrwxo3rgZeClY58eVx53VAJ8ennv43Xp4Uq0CbKiwOb+NxTWbMubp3PBeK/XUJPI0dC+57vjjvqEF+LCeRbXBYBYKwHszANXAaNQEG6zBfPscxf6OJ72CJVs1ThXAPIAMB8pfPSGwZxfJL7dgAX8YZNCTC686CvcCPHlqT6npu/VRwVbWNlKtjy72czITss17bKiCJRnYVN+i5EO6FIf+z6tCpB0uJGIhrDwBuUazlk8PKWAPSeB9+ChQXY0QB83esGfu/oTg6r7F2YDh1xnIaoIAHE9EEFXYYLL5zZh/xMxec71LdtcMpOeVEgH5lEOuhtcPLdXPgFWrYC9UV09DVkAczUDg/OaRMUGPqHHdo4C1qefeFxsqVDbVwFJOD2PxmZPoIPPucJa2UE4CWEAa6njdp34MuYl5wEmPadNAlo53M5C2liirwdqEAaDqWhXq/eBQBEuiTQUqnFKVimm9vEIoo1XHpjadIk/z9OCEeVxh7OZHM0giMW9mpkc74CHQ7Aps7uSv1w+bPzk4OPi9OyHPhdypBRTanps+CRncvv1z3VG4Hv4hdDV1hGsgH/LRsGtL43992qKBuLgh2xbhAbQLaT3O94b62fdxla9vOQGb+4C/o5dNRAKbCAyAooxJOjDmAcZOoPQwJIQhJ2PQRgbsAfDn7t7g4BxyZggUeAMU/LuGUUAUfMrFaxDGZMjGCSI2lQ0VMHRlGehGMAWSc9zLKKWcsPxyjg0/sRH6RBcCScU/nQT+8K+UpcNGI2kTOFga3BRYP8EdnK8ounjnxghAJUkiLlLEnERijtp4Nr5uJMZlyMOJKA2DBCyNw6M3t+kf9deY2aHZWqjeb8DgjwBsTrN8ucYvb3jCMNZawS/sFG7OWQm7iqFaxDXQbUiVMT++M8nTs3s7k0HzBVigvLwc5CNZuhFD9IabgHpQwOwTycnJ0xHSSGPeG0RMFW8efAHUGN3ecV2mHKfY32wTJZuIhApx+uoXQUicMsN4Ft7SdWRriAhzHUn86gdhyNgN/Hk65SiQU4mMtHTvnXovNned+G8kJTXP6vrhRlfY4Y22y/OvGFWgkhBtKsnPez0ea+I5awRyLgidXqURpYTNJSF/UhD9Hw2YseFnoGH1vtnDaIhsQHbNj+bNQOquUWuB08cImf5hyIlKYHIxSKIoidhUkt90z2P7M3b/UXYdXucC3KQDysMSyG9YAYdOMmi51gwXubO8NEdPA4Jfj+r94thovcR6jFWVOJkOx5k82iHaAJtKCj9xvJ3W1S3GcPgCxtPN+4kuMgA4GxNz2jIHGL7346PoAWRxFMQBBRMKzkq25+qXQtcJrG5gC1rUs4WopCrHtO28WHcmwAjYm70vILCwqhTCykl4QoecIxNcZXpLQWbv4wC/CfTkSQ1e3HXvDeA2gwfl/QCKFUiIUPWnPW8edTt1ZTog0JuSIwyFCMLKgSSWg/yqq5e6jbpet6ia6ukIxAGkxkVfS4ey80Q53Kii36EHx2ujmIyIBNIX+6eEQ8abJIKZwUr27IZ4l1+TDzGuTEIiHKge/CvtJ2CMAODtTSqkRQEH2R4CdM3ik0FEuYIq3x5HxBfP/TQFGMvMbO6mEDSu6J6fkMtuKLw2DchNYvLVs+BBJQLEkZaWBaRXY5gMT6ogBH66E3UQkGwioLHnGeuM2xZDk87EP6bBHFZ4AWEkgKt8ZNxYiZBEfEhZ9N4ZwR1oZQATBpIFBef5IYolEEKVG3AQojw/sSGJQPg4dHXtdQF0zHP7ZqWzcA7l93s8Nf8dgAnXV97XWECoPHbyy17AZsGbgoKDaamkpqYHszrflSVDaniBKDiITWUTpXm+9APa+QPOuQ2/ThNDSdKUUloOCYQBXLUcSpcAsh6dYjqwUYC4uI0j/cjak3ZQjcEKIQcOODnGkBoORmU7S5zAN2s05wNg/wCAsyOWnyWmOdsSAeTn//WS9ewb5yF31YgfCj0AzEL04K6ufy6YUOCdRrb7p8GGg72YNSvM9Q4besu8kCAr4WUTsLh9DfP2TBnOkTm7AS+2PHr7/8nEFjkIgVF6gitBy/8F48ZjyXoqc/8AAAAASUVORK5CYII=", "AAD/1AHpOgD/jwD/1BKagADUkDb/AADNHADlJwD/UAD//wn/1A3/QR7M1AD/pQD2gAD//wHE1AG5mwDhAAT/JgT/owD/1CvdGBD7BwD/RhjgSgzn6An//xDEHQDtbD3/gB3//xLp1AA0jCb/owj/QS7N1AB/1BLVgBf/6wCdlgPJ/wHkGwD5gAHk/wD/1AHbRCrf1ACZ1BXy7Q/CGAn+QCjDQznYQkXN1AB2gADxFQDT/wDuLwH/pATz1AiwgAHs/wf/Iwn+1Bzb7hOtgEz/MgX/1ABX1APuFgD/kUT/TAv+GADyFACt1AHiqAD/QgD+Dwv/FgDra1P/mgjWAADSlS3LQhfX1AHAmgHaoBD/khD/pQD/Sh7+iwD/bCf/7QCu/wX/Pz++Tg/1owfu1ADz7RC4/x/fHwD/1AHSOQ7/vgDO/w3+FxH//wHZgBL//wD2DwX/1Bjingvg1ABE/wCu1ACuAAD41An/1CT+oQfnAADFaljRRgD/CwD/Ogf/NQn//wvhgAn/FQDFoQHq1BK/iAb/UAH2RTzp/wP/6giwpgX6GADf5gHuCgX/1ACMFgDlIgD51Aq21CHy/wjskhn/BAD/gDj/RA7d1ACl1ABklRnJGwD/1BvO1Aj31AT/Pw7+1BL/gADLRwLjig3/pwD/1AnI6wyd1Bz/1BH2oQD7TgP/wAD/gAD3mAnOjR3/1BmqQDbEPxHONgD/1A/P5wD+1ABtHwX/DAH4HAff1Cz/jyz//y7JpQT/Tgb/1AnggADb/yaygADo1AH4DgD/QzDVHw///wHRHAv+QAXNkgb/bBf/1AfYNwP//xXcKiTIJAD/FgDa7hmt1BfoIAXqFQT/UgD/TAD/JQH7gA3/TwD/nwPiPwD/lgDKgAL/HwDzmRPUPQP/ogv/qAD8hwD/EgD//wC61A3d7Q+ogAb/MgD/PQn/aT7P/xjMCwj/gC3/1AHJ1A3oGwzUlhLLlwHRTwnz1Art1A6nkwD/gADggCP/BgP/Sxft6g3T1BHjpAr4ixT/"], "200x228": [2, "data:image/png;base64,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"], "260x260": [2, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIIAAACCCAAAAACvaE8hAAAvRUlEQVR42k2bfVhU5dbGf07QRhOJJinJSgsJnRHU1BETpTI6bExBPk41SNHM4AzKQU+S5BE9iscw7E1CmZEZ0pDpA6Hxi02HrNTxa9QScChTyvIDCpsIKXVH5vvHHuzMX5uL69rPetaznrXu+15rD0gekjUVCAO6Mum1DWfb3A/ZDPOfrSzo0R8+unYZa5+dp3N2hIVrAA1A2+s5z3xawOMZH95x/+bmBWtSx2kxVJXz0T31Ne9Qb8xa+XDWyu1fwpgvx6T/uG/TviMD2ldX7/jjjaV0Lo1zk8jA2yaDubM38sxrqr3lk/rCwsLo2tEFrP324sXHC+Y+C8m8n9OT6uTbZ7/99lk43LpH8rVp2tqsYKXtti08MaIUiA7d3L38nUwtVBnMZigmNNTI4e0c3u4Yc3gM1YWr5jJ/MoU3yErexbp1IXHYngUKzRBBcGfw0yr8v7CpmZmDB/c8xHHzU4+8/8UX9wCpe/XMIx7Iim0rEOWOWnzU1qprO45GD9mc8MSU/P0j1zUXJ+0C+voI5L3Fq++MKCGinRIw0l5Y6HCUjeGe6rTNcxttdWcZyyC9ftAp6+MEY37CDRAQwH1dYYoNl7LLAzMzUo+fq/r6w80A7C0NPrwNmMLHUQUzw31qfOADXO9eFYaw+YXCkc15gdo+Avvg6+OLtYH77vmlvbCbCAdGh5GI46QSCtNGPvDEJ0xqfZk3liZblz4L3Nb7qTmyV3TDMdXcLnOX4ofAwYEMTr39YQwA7N7dCnWxH7Ov31FyRoZabVGrkcXnoy+V/XQ+dqSZvr4+6LOBNInXyeNXqG9v17XTTmE79ZAFVx94hQHbBHWzg3XXs2Hp7H/dDH6isxN3XFzcKZVt54dhAJfAFhYGfPMeY2Du7sNEl1IPU+IpLobAeiSr1eerzUANrk/1rU5pINhsNgAzga9otYthJyXQ3e0EHBAKKefHLJh/as0D98w7t4aJo4Bnx4NxLcEQ3OsmLksV1uj3gX+rvy9/jm27d2cf5jDMChlQfZTnt1RXMxVfCmoL4PMhZDH3cfUg2zngGh9shg/wArBlcCGp9egdd2MsieimHp53P3sw4vfE69f+uG6oXvrR7Lfo3FVBby8QjJuTKsrtSiiAGcrrzwNweMtUpoawnaVgJhZOH0YNYMlAZhFXrr/O2hnXwcbAzTEzNm/+paa5ZsubfeXs6taHptY/XlPjKKSdmhra990cM3DVJ40jRlC16YL20YrZAHHBwcqW114O6DKX+/efCdy34zg8/IxuajZT6QlZPRPmbdsVdezGkZ2pzfKiDGp9aqxWOXbo1i83AjbMsBm4M7PvzfCtsLEik3qogRoXpJBZM2HogJsDQJP34e2flqQLUDFv6V1bG9wA9BLsVoURaOevX/XDRHMDnNf3H4YDwNl5AFOj6+8Pr7WSMT0Di1qI7h7Jwpagdc1mYP78qzc7tmwO/6Ug0BbYXpNCDa7MxkbozmysAXjyiSc1pzPeu2NlIQBH1pH/am8vQHAwBFAedmv9ub/mVnwDfH07IasJ0vekprVlFWdVkvU1hGzLwNKm0cAGK9KNQRvnd4AN3gzvYPHXSOEdi8eyc8qEd+prAGM8LqiBzH9T9g/u1XTcfIsvFjwHgqE9gjeCby0aN+AqYbcMaP3vA/tDeqovnppAfchMVrIKhKgtprfR4axshTbggAWrxXr8/OEnrReHgzn0F66G/8LCjXdmOo68F3iF1PoaMlOpT80vC0okkzEzZ61cdXb1gMvvvvbOsKFB7Qj3M/wE0BsMsOwvEy7l/UoGD1+uVL36VC+rB0JO6yr4Ivt01FOOT6ded3csagPQtGmsFhIuXDlquTkAMx90hP/9zaEn36rpe4a7Ncm3R2TWNOIkNbSblEZIRFd+nGPh3IRjYhPIAp8nDz/Ri98R51Tcyky/1myprWLovxg3o7R0ILNmhaxKS0vrIwoe7Fu61/FUGwBtmlpqEWPvPEoRZgIzxQ4WT3qLzGym9aGCGhKdNdBNKAQFNXKiZRVDq6Dn6Ig5MgjIyQkQHMwwZeEBgy/dB9BFWBeQyatL7yz9pzOE0lnj1uS8p2Hd4ewtt6FzsutNTZv/yDRWdcdT+Yef6ArLA68Wr9arhTLrY+NsO+8viSAzlRTIRA9BXK+6MozJF6Y+UcA/O1p3gzzcO3H4CeiNPBPcG8wyVReXAMLCCOsjrGnwc8taAWZyv49UoiG2mm1fbtGTokGj0YCmrQ1LR8Pqwnd4wQxlnxgALVEG6qowz9n8n8xM6kMzARLh+vXE0xycTJjxHUdI98AgeejnuUETE3qA4M5goHft/4SjEhHZtLb9tpVrAy3ypsfbNLDHewxuxL77R3iHoAYyaoF/N3xVkVfOn6CfZskH8GoNi7WUJ/4WFQRAakrmgfONBF1PzP/KZFkldxDw/cDYoycqTwXv+qjipfi/lgyg79ZzVxhkg+3AxhmsKIV82lg3q2I6Z0cxoPJeH2rf9APqWp9lQ+vxUWfyMBMIP9C88eqgq+GPfP3mJ8CjBz5/LJV6wMWYj+A6mctLJ6YX2qY/0djDkPZcq+rGrr8REOfuX3WYisBLyvYv0QddwNpiCnJ6gBD2iEuRtkJW7GGwWHxqDRkZasL5M42+jW/y+paaZvq4eFXMNGsXPwn07f9Yn1IPRkJLABITaz68OTNkUt8RdH/7yvpw1CvkQhDTe/tNeF8F9wFcCgTmXoLBOziDDT1qZg7XQF0020ZVH9lpobYWrOpaK/iio3Zt/ICtH5DZ/ffmQMaLcMig/QQYWXgWalJTCaX97s9IzGRkW1jy/YkjY9e8OAyV9vu8+U1w3b98L8P4QhVGF8B9Yfddui/xvjCyZi/Zdlij9+TQRW4F1L//CECcJcXnA3zgq3XREPZJ/YxfVr4zboPquZiK37RaTlehVO3ERBrrQ4kAPUHAo8yfsvKfx95LtNhmjdjz3v9VJARt8c5+GxjWG0wnl1X/G40mYCNDH/qaw7RCGqWlIrz7/gwANbIMMhZ8KTx/B1+3fB9kbv7mttsaCxZ6Abz5/nLncqbS3U739evXG/WNYbPnlRWGfnNn9URGfROQ3CVUcVK7i8hhdCrJ6RZ27IK5XLIPXrjwG7rXff3ll2v2UFH3nMRuGAxsyEDAJwu+WkD42+CJB9b0YAuMiop6+4rhTS+gfb0PoLGm3hhKKBB63QkMv1IQOV3+z7Pjso+X3qBiCLRXEmYDfzS4A+hSrkQfeb9eyvsVQn4azpYP51KALXdkahpbPoekXUi1VrUPQe1D7ZPR9B7/oTmTc32nDVXke7Xja8a9uVgbCAQmktqtWBDRTiLUxA+b08IR4Z92E9kIyIIgD4czt3yv6lLCca4ErWl5r7JxKfD57tuf7ZlZ4K0DeB9gdYpP9qktasjIUAukf/vtA79sPBdo63t8yxaOc8e4Nw+lGSi32Q40ZoaGhgKU0K0nsx2Wb9q+fc4/PzJlZ49WFs0Nqvf0xyOowsIuAZSLwJ67yGVI5SwedZbR6sk9svfpOtFyetGiQga61IIlAx/T2/BZwqc8/8wL8+ePXJM3ds3BSV68k6h67DH6gEnUQAQllNBeH/RZzX8uA/B/xrCHD/zeIssIQEIukQT3QjCgoisPLhEq2WHWA7Bw4TrIroQ9ud6dq9nLRRu8aCoA2WqtJQPaLGS8/TaqHjN5jiUH0TLpuFbyHlpcBcyFxu7udsf8iMK74/XQCEOUnVfM/rrmOgIATU46IZheeolTze0rh/uuOk0i0efqvwHzsj0HIL2szXskOh23BDyLF6NjkVqdYUGDpg1q2a3fXYXmyPq7F3ubCawJl07TB2b+lZhYnwJB7bDv+uPXgQoAoSJ3U0Gm34Iq3hgwLBiIJBK36lcABokJ2RC9/OHqy1PXuh6iYA/PAFxjHQBbgdoMH9CmQcMGMM7MBqrqvGgzpXEdvywuIzAwjz/JzCST1ERKfirZDPxr6NarALlN91/fXicDyHKCEejtpZMzoBqcreCVV1sPt/JeTzl8kzL8mdWzBsJU9gxsO2yLByhtnuhoo7YN2qglHEYU0IfZW/TAPq9369L9WR+0aikDJqQafyqJ2Py3CIcDXDgpnxf5DFDVPs4qp0Ugy/HDh+9K5QzBkcq1VNkGA4TyWnQ0rUqYupjLuFm7C5fCNQ3s431eZNwesU2dAQc0tRnWjA7rn3d8GAhaqMioPDokm3HRBkM+8EV9fGG78h4HmxOZkDhohpyOAQH++cA4gyDsmw0cYCedkcMIxq0KIxDsg7L+ZDDvLSVPvJI66WJ3PnsOw3usgA0AB641E+7zWTVtaqjFKsjRo82AwTWkdube89edy2mtqqIc1ROpmUQYAaPRiGNf6q4pjP6y5/4mOb1y1fJNJ9cAFUFBd00H6OykFwYM7iIMmPtrL7B26XCyZpw/PumejvCRO9c5Q2Z6nr74C+yY1Cs0j+tAQE0GVtQ+te/n1+o1tOGtZG9tRq0WgHK6Brd3h5YADmNhCY7jKa7U54K+/r/EjDGV6llMF848uBw5gn/2/OcvvDDXbINL5HGujVk9XHnnOA8cRz8j57Y5MDPt0W+iFmFeTunycSCofXSwSE0GDrlY3Yf52tYHYO/xAi1EnQagMJXuwm5CjZRAe31QyhnNzGkNG195vSNE4kvObEmviQB7uj81BYNKEViyf+1do4EQdoUCqd8+Q2tWbF9rmob98OxWcgugA1D7EKyAfLFhWaANwo+GN83fljoJDBgohz9TQzeHloSG4nA4HHST2Bhxcfnyaf96/VXbNvFPnr7toyG5kLDVrVwJJTWVA1LGe3//tQ1eW9btDPkY2M2XW5CgDQq5c/l+7+pmgAyQXHKH76XCzAnHN5qxrmX/d0uCAKIfqwIb2T9DhKMkosRoBMfmn1yJHGDNL9tAN/Tz0WOs7K6qak9oelHq7cVPK1W2+4DGSZumX9nGOSry6BkK8xhCLG1tdRrvDMzAsQN7miVBXZthEUWwqL6abLKOs537YMD350rXb16u9dJ6iD6wQTfgwIEDIw5HaCZP4njwBGQ1DpQlVYQsAxAZ+VeZUuBCaGsYXIzO3WIDbn8y6/Dc3VHASpH9y9nKDNIA8FmtCBIbDm8TozHbWpMZs+W363tzthzfEn36L8wBGAGHEWNJaqYl3dpl/cWTzZhdrVwQBDli1/VUzgT3Qzc/Xuhepn5x3vBWXtgJ/O4+etuYw9VRIErMYCsPguYaKbJPrUaSUwT+fTBiphnmLGrb+PBLsxuOLz2J9aeowDx2bnmBQqMRHBiNOHBQXwOfh7nrPh/H50brCEBoD4KXuAUeFRPKj3/vXGRyrQE9wO/ubTfe5TSwR/vgg1D0YNa6A3tcAj7UIrKMT/zy6gAgL+qOFdE3Yk/mvz9JYVpzsv/ygYM2jPP1jWzv7Hz55TfOfPro6E271hhASICEyMh+IxQT8pYPqC3/UGJGDlTA+Sa+fogjgN1L9XJGVStakwWfDwQJ2DDiE3YCjfNz1h95v6z9uGWaBTDPmVbvT4060FBYn+i0UjjMsfzdTc9OsoPtCtBEvZEzRPb29vb6TbBntVU33df166TeJPhlHA/w6B3Ht/VRABSxhrNZHOYaQq1iCZILoSaM6PnldRPoOr2YNS9Man0MA9h23kU3hQ6jEQ/ojA5cqZfwPkqjddb79PjeGL8d2ZAQBERyJjIyMrjfCxsvAn0Zj5Z4Z4vcfjvxj1wEKAXIYjnV1bGeFSmyTw1IiCBZHvoZQBteP817fEIPlVWHrIeAKfUwHyMOI+g81NSk1AdjET7R3ZP6yvtLNq7fLSNAginVRiRngN5eFYBp192JwKQZfA/rfv+d81+Hpn6cC0AxyzGezSKQCxI+1OFIglEUN0z5NW+kCNlRpwkhhPFlB7EoamFKfXehA4cODzQ2NtbMHvpUzPd3rR037t2PRipepOJ0/ROdnUTaGEak/0ZIYD/zT55a/w7j7t9HGFwvAnJjowCHo5io2Jl7RFD7MOLyIQlLB8McDJzmuFl5x8FWMM9PrSF1c4kRPGAsTEx0ZqKZ+4Tx38uai9Ie9axBAJqGRyFCMJwh8oxiwqDGooTGu5yH4wl94cksOJr9eZLRW9Bfc4uBqPpZAmofaN4ERJngcprNVQavl7jfmAjTpq2DvB0vZLpCHf5LQTcuIz9jXVDoei6y5EJToqJlJPBz3Bp6ezFHnukMVgFciv194u320JCvgSsNRVP2PfoMRQ4tLDuyhaLiUdXV8H0rsiUDdQYgS4tak3ttF23j+g5p4U8dgMXirAJzKvXgwOgAI2TSzeI2yybDFzNC3pDly9tBpqrpVEhUAMFwpjOY3gCgK7p5YQKbWP35nUOA4qfIdv74bXEAmlagmCyqq7MeFDuxqmt9FhDDM9ri3v2T4baLtk1bjqOCL8LBiqEKeoPobscB6HBAfU199uzEBbBp+NttEwAEWY44S2QVBCtajwowH9tlFcV7Z93z0Dc4OVo9b4qz9dtioE2Eaqr5PisLci+oIUNtRSNltB2b9+v6yJvmQBI6OnBPYEJIK1iqIC+sBugGIx7HVCNA3wQuX+568OeIHoYCCLnMHY0bFKUnWNUFWdYUJNgDdwNTss4WA1OgFGKzz0I1UFQEHWpfbYZFs0Gs/Zht8PsjA4Dq3qXP3nnmC6L1B60AwzNTN5csNOIAxhQCNRz+lL5j+WvaD6HYUMHsMXeGxPUzqgFXw3B03CtKIl0HHjcN2RV/ituyWlbOIfYApef+oAgj7D+L8dPzqIEMqwU2LGo7Nu+uP76+tKZ4zfDr8Ucv/nfWwXWK3FL+879TQyMUE4wwPyjx9D+iKXM4AYYyuwo5tynhpZOX3bgB4uJUffAwCCISsAyWmMiqrhdNfUdKKQCKcQzezygeNKH2ZWRo2izUti2yarK3Lfm9ZXjeum1N14/+stydzTT0BgMwgXqMODCiczgAPhw+ciS/A6RfpgKEJuCyG+Uk3ATcB5Gjb3MB496CXaz/Eian5v5BX10pBTkUwa8z9mdBxQbU+CxtG6jVtFk2CNlP/Yl500nvq5sZFaefCwenHTpNue1samiEcps9UOioaeci5nkXAXK3XwZIaAJwA52AWwVz846oRRCbn/12LbCN6iNpVEsSFKCAgAcnY6TU5/Oh3vCxIGDVtC1SJzRumG87Ha/7hZGAt+ogWAxgJkXpRTgAHDWcmgstsQDMA0GWZRIqaIqLA4gjDhWXAlfe2RWOKN3PQ8yG4q+3UVBxA5G6GTOOQNJ5vo8qclAnq8nwIbjosNQesMK23KXvvz7TEzkSWF7JtGmW/Cry2IfjeCFGjEaj8bg+M5MJXAzbDsBFkJ9+OreC3OqEAQBMCyROhdQQpvvqqYmSSBnLhnTT8Ai3kTsVHXuXAjSsXrOm2ghPC4AacAl0qOkQs7ftnnCEebsYMsF9FIAoIO9RgHaMDqAealKux7PJX2LTEc61NQlNuTydEAdwcEn166ou0xg3kcu/nw0rqC6XwDQF/tC0raxfveovDch4ehY+an0CKbiQOtRICYee2ezhzBSu3PlINt6DWA8C5aczU+lGwSyp1DDSe6u5NfwI8pnZCTIVY19+uQmAnFHtqjBMPU4iBwgBF3q+zYIh/FE8mSJ7XVsqLM2uBpYvTwL2yKgzkEFkg1HIaIWF6154lRzO7Wja6X5fu2PJwWlAXl3qpNDQCIcDxRHMXNRvgcANcqmqIqFq/BtlispTCSowgSRdrhP2lD1Env4Kp6uPwNTpdaxIA4qNsH8DHJiFjFWWXC6gA+tFMeX5y9G2eo6OZEg9eGGahb7y8rc43o1RgY7QyMv9FgzlIlRlpiMgn3z5GHFx8CpnI1SAyWQC/f4hA0NDyoEDWeSO2r/CkzaTkqKsItYMPgsO6f5wIUMtiClISLhkJL489j6BhiskLzqFjWQsYIPA+pT6EuXwjKHQOKbfghtwwf/84uWEyQkQFwj2syqw2+2YGDRpbr+5lX2ztuXOLCWNKIqAQiMUr6KDWh+CnCKmIBgRcW0oeNq8Fpj8ejyRWpKt+Zjhk1TXT45TRhzgKEmEM28pb718GwDK3WjiD7eb6jM5OSa7ghfsgNSd090DQGkp2NM0CmbCz0xQSwAuSZbUogsQkeIG2o5qhwz54m2zTVvGDsCWlwehDjwOh1HnMDoeIOjU5A1+G8ANw8PAelDfBLjtMGrU66ouTCawY+dnPRWBkJSroW3ebQUimgKKAJYDp/d2iGSAKIJDEDvCJXj97Z8AeMQGXv0OLGUAT+ZHYDQCHp1DNybxcXaV/o/szi5D+hoSxvMysNY+qr29ReVnQCaTqeeZ4a1msHrb0Lx0Q4cfNLGcYoq1pYKgpAUJEASQ3gx5f6H5hXlTpmAGlpKDFaCvGmN/dhxbSCbds3/8HxOiiSlUkBOwtiDCT+jsmOww6dWLNhiCtoDoz/sozS3JPV1cbFxzkSKKvNeQsXYgkCKKsosOxDdsgTuIdf3S9DVwvCpZoUEAhQ50YPRQGN9YUw8b+/8xD0qibSO2XA0cqDQD1p+NuEPxggnsdviWcidaL4Q8LT0KeKkucrzIGig+ku5CRpBdkqJYCaLEU59gHvj9KibYcJ4s21HJY0rn2RgBHnAwNcKVmMnPL9zsP4lYsPHdLjh2K/SJUKiM3Y6J0Hd91UBcFBpmfQYVEHUWgFGjiN2DIKgRRCQBRAk4ypMEYomf/EVlnHu8FaZV9SlZ0WhU3n9DNykT44/PPLePDW8NHTqU7bCrJP8TdhGHX3ZmnN8LJuym7ofutkkibmjr2bMCTWlUVBHAZLhxOgpkfCClICMhuvwvwFZRXX3HfeuyD5JsMQQCl2gvBJ3uXR0eSE0V98Vfhs1cvnwZ4I3lmwrO43TTr4M3+3mE3WSyhxKiBFspqYBYQBFJAGRN5TQp/iIlAgIIIi8o8TUw7r6cbHbE7NADBj4Hx3yjx1OGTudpr8fEe/CWPxwWLLAjU+3F7XYTDKw/iwqw2zGBiQeeM/cf0azSCimXYkiCYy+yP4pZcjg+NSkI4eFKgpja/Q/AzNfueDCgy5lW1Uc08akYQxXAAiU1/W+0+iXw/0MwcCPhr5M4qwJM2O12O85mRaAIqAOWl66qULICbA3Q+cc4OmQ1sq8jRRZS4Lu6F8zkwTLbPi3rcio5aLCRzzv1CmTBAzr2hW4kAGhj4wZg0yYDsONHP3AE7Fkqu90OJkzYWVpU3sWux6FuOr6uvf25kRe9HrTgU4cvQgMuAWSZpiciH4U+zH/vAKaR03V3FdA3JpWSEkCHx+NxRHAT4E/rxoU7AAw5yBAedytPrEWFyWQH7CZg4gs7mb3ECwPD+E+pdJpiGqi8sdUZXcQeCZ/PigYhRVGLNvxBH5CHLT7HG7WEN+8uH5RoI/A3Ihyg03lAp+O4Y/BQeGusXWDu0KHx79f8G1i37Om4W0a4VXP8yRET67SI7AL2ItGMv0ittsw7TxKzsFhkNQmiDLKEwCKCRuYR2JdnPs6bB5OzK9/K2SsBhCplWqeDfEJBA9asv8PQ8PDu+O+RqVi69mU3QG9vL/SqzP7E4J+j0M+GNAomyiD6Wa1kwd0wcpyYsEHwISLIgpCCzIYDmIFAAjMzjrx997h3u4M/pq2MR7sLwejx9O9ydjJs3LfPdM9m/nvBfmmAIAhUJOAGIv26Y79OZocm6AYtM2fu6doDRUBS0vkVEwFNc7iILCNILmQZAZERkUqnt48vcweVE0sGM8g33BeKkVPgQUeZsaTEOBaKp079at83F/Yv3rq/RzbcD08D9HYGA8EqpVLbTSZY+hCEAnV79/73p4JrUEQDWDgBtO1xICEJalIEBFwgHd6lDBRh61t44xrrkkdFPw9VR0tKHDpA5wEcd7eXCBi+ib88VL7QucRn+j1EqEhgqxHoH2AIsH2ohCMmOw8gARW6mfXPlwDFFCXdityCX2URXB3gAkQBpuwwA32BgdjM+dC3el11P9Z1gI53deR/+lEm24ee3Pe2JgAygr5vGHMBgdwgxwyU6QHoVfXZMfUrlmfASRLsfe9Aw1cDOU1xAwyzTCSuuKAUCUQEEEVRlGRZvJhrzoNAMF/7wFsGbxw/ZcbAnC9xGHW6fMj3lBUCARyb1vrpheF8m/Tn2buHAUx7mTiIhF56I1X3KadwFTtEvgMQmDYT3Vdc82+pE4sWpFmI4YJglJEFARDCJabfclGmNh9GHrg3T/mz3eHxlEGZDjKNvFkUMNm1OuXyWD5duWaBCCSf1E+MA84QSfAZld2P20wAeaL+SpypjjoPrMhVArJhGF53wCrAJ7t8EpKsRhDlDhFq/Dn2Fe/GKxsD2/LyoArGEKHT6aAM8ktSKcTKufFNwU+tzL5W/c4+CeC38WVNy3ptwcFnevlUpcduQrmR+56ukWYvaRjJ3r254XtscLpYcQMZgAslDEU6JBkQaN0DfdQA2ooX4h1lfpekYwTyyc/PL3MAlA8ti5h275O8co5zjcsBEqopa4JeiOxFNchksuuBq3oAPRQXQGnFewW3eFRDAysqQBRkRJAkCRAkZO64DoFjZkM5X7reTLbi790rjBbKgFBIH/yvOB6JWL559ImsoQnIMjRR1UfwnGDoBBXYcQJOgNn+Za+VwjkvUUVJNJCUpLXAHkGWEESjSIqEJIsgLvsIDDNf+ADKoepuhYUb2O7A4/E874nJL2Mq3d3bp27G+8mrj2v4uOq2Ywi5BhKyxqKPAyKHRSpsSq83oR+EE2az3r8V2x9RUNwADvACs9ThyLLUIYjqFBEpHIl1c6FqvOoXzJT3AT8BVNnSFSFc1wL5h7vrQwu5xz3iuxE/fPpT2aaL26GqgoCmxUUfulGG5FR2Oziddpx24ApQNAPSv6o7p5DlBsBNQyn4mkUQJVlyyIKITxDhVyBbXxEYSJ4Nyqb1H51RxynlUUdqd1Z624YfPnokcN5tZlgDCAm4cSvV2tzZqfJXAqderweuXIH9zIS0VwGKkpKAOG0xIN+vRIGIgCDKMtLFaYBh7jLK88gDq8UfkA6HB4+RMijzpNSnjEHz+Vslhx+d+B3p6cqgXeGtQZIzoArFrge9aRCD9EOAJcWl7N2zfbeSFxvcScrD3nGSK0WUEF2SiCwrecq3BfBmooCtx1r9YxwoCCeffKa6cLF456uhn79d2NraGXakRKFz/l/wmUh6VU49Tr0e+1WuDmIJQxSodCDKDVEUJ4EVN0XQbAQBSWHpgiAKSETFAFqwlQNUVZVryqP63+7Ip6ws/3Boaih3TvkyfXrBznOrDIZtAFz4rT/vBdMbqfI3Yhg0aJCdJFhvLFhJQVrRX/zHCsUwDtHlAkkUw2XZ5ZIQRPHivzCsM/zvZJaZMjBi9KMFZZJiDJssDYNpW9WTtKEFAG3ZLcQSeUbFIOctZrsrbsmVJY7p4syZJNGgRKP7xAkvp4FmIUUEEakjHFEUZZdE9WCq/FgeKC/PazMDix0ejB5PGcBUB8BGrOd2W3/I2tCgJNR0uU8xobf3DMEqk+IFvckOnEkCyE2DKQwpgqKkOJiIl7qZzSCTIkqCKHVIkiQgQt4JcEYTaFaaxXlwCMyA4xQ6iMnnhjEUBwIPjxnz8I7LK6MRQF4TNmB1koLcgoNBZcepx+lUIGxWnCJapdXR0EARxRA30aI9EZXGnnFqQZJBlkTElBRZEoDbDbQCNsUR5QaDxdKa9yvg0UFZS4y/V7adZ6Iahry6Z0LA54CwfNiCITklcfg7EirlQvgZ6dGGJQwp+oO6tCKSipW0YPHD7WalVkvKEAQiSCQtpkpf5h9htlFV1ZpfxYBbwmcL+SXdhRAQXzLoPzPvkgzMUbj6pz30JS1TYqFX9Rcfxu50AyQBdcVJFEEAbjdxcROL6gAIR8YoCiCECwq21MKOVsX5eWYzHAIWGlFgG2X+DPBS8vzZoz980ieNPaCsNIaaBX1NcQCdwapbFtgxQTF+mnM6jqSkAACr1Y2evdf2NMsIguh4SiZc7pAlGYZ/BYb1h0ABcIFRYKDcAkpfSJMPJTjAs7kw41r8gI2NT967AGD4kAxqFpTFERcXByonOJ3AVeVSsN7dgGb6Xi3Q8McfSXhPnPCe0CrzyFyQYTF0IAgpkiAyGKoee0yxoM8cdRBLNHnQjg4dngDgVOhPX2K0uIFnX89qSNwkA7GfPk/msPtMgdOmTXs1ToUTvd7pxyxxW5KWkIS4orSCBqDI7cXazER/D813P5Ci1GsZWeCEMp9jBgzvND89jXwMQIkDQPdSGVDiGPNl+oc7ifA8w8ig8wjA9s6Unk1lsAQgToXe2Z+d9PqG2Di/3lWKn/WdiG06QcVe9l5j4gUXgigLYkoKCEjy0ds/hEOQd40o86mxnY+VwyHDh/ML8RgB8svId+DA1PbAmoY7dXx7bxvKsN6PgSPuiADIyTHdyo5cveqM12sbSqCooOAaDUkk8YPuxMQmrKuZOZMVe/aMThEQJJBBllNEaRJOgwEDiBys4VSdDfKJJjUCIx6lSACMCbr8SsQjRJx/iO/SEQTIvKc/AkdVjlKJCliBQehPNVQUT4kjKXfmCpKIoyh5uPUEWCAtDWZdQ+2SQRaQEQSZlONHVLvvSEhKTX3CkGZb11Jps0X9ZLESZOSUQwfEQMy7Oh3wPhGPtD/AD0nKlQ77kd8UCfqsQu79XmD2ztLSAGAKaTYFtyV8ZZkYzMQVuRTMhIEgCrIIkiDLsiTJOR+/9NJ/43vu09sOxc+pSU6Gx2g92PaFAyce8mmJoaVsLFynnfMeGr+9riifwia4QxHBR1GpCnXecsMuseAcNDScHknBBXccnM99BWITTliANGA1koyAOgVAFJGORKV9NH5szr59B5MKcsIwm6s4NA3+aywx4imjDCB97JdBeJyv7I5IHDBC6QnI6ZuOEXGWnFHtgMrZnxqddgKpaKtOQkudovCsfrEZYGKD0kGf9Z8OBGR8MgiCIISzYi9s7ql8P2cHVFZOC8xjmuUgH+JwONDlx9ACnrsYI6fv3g3PvvJEYhsg5AosGH/pLHAWcvCnpkEMMunZuTq35m2KK/xjI26RJuuJpqZb5bhZSHFJEkiyoAxSfJtKyCPn4z/VJjM2hoMArU52KrCljHzAWO+A7QtHPr5w5EjlqytDk2E7C46NqmQUEZCj6tYrgQA4xRUH51W6T5dSkOtucLu9r28NZmIwvUaAmXvGIcsiKQIpgCSBRO3lek72aIFTLewAiM5nTj9uigEcikg8QsOIJBo/Aaraq2Tu4Sww6iyVlar+SLgKTLcpuaCuFIiD0RVVaGH0GqBub0Ez4YIgKhoLoijLPP5g1HDeD1GCOybzJwXFm014dB7yW1piQOfQnWr7Y+N3DW3ftX36g781Itzz4+TK9ZVnz1Kw/qAqtN8Gu/MDlsVduRKnrQOvkpmOWdgK8Cowkz1hHS4ZwT8WBJKoHkqUMr3S0uJpOQUcbD2k5GtdPtASQ76OH4rHv47lu3Of3cMAwAC8QQOsr1SEnu7+Qm1i+4Db3Es+a6jYO71OC2D4bKsVYvmM4gLS0sB/BCDJIAgpcHlkCM/2AMnJLbQsxXBz3UHaFPBaVlYW00IM3U9evv6KxZq0cKFmwDygSl6w5m81ScD6yMr1fb0BoTj1AE7skxcuvPPlex7S7R24V2hY35DUy73nmWgdveLFjyoBllu6TiBi9MkiMjJIdUH/IH4uUY8dguQdRFPFDoxgdHjKIL+shTLG5kHQ69YRbZpPtn0gAwjPjP/Oml9aAORwMFiFPy/YJ9uP++5c2nBjKqtv8cnzcKKK3F/IBWY2c78Irg5ZQBAEJLh8hngoW7JuyUELJOdjYM56NIMdfqEyBvIdAW/xd+u5775re5J/KgQi6N/PtV+mtLQ0B9y9KvR6vZPZYaceOPfww0uB/awonRmVBN7Rj5/QxnKCitF4CwoAtYwoiAiygAshRWDoPnr4RyuwQ78jJsxAFRwk+U2jRwfE5LfE5AN/sjzodYv2O6hOVSybs/LHQDh7VhkewOl06p07b3SkXy7vWTYkaa0OrlHUgFKJm6x8BkZKKWC7EggCgoxyFJff+ve9kfFVyZC8I2esB2CA8u2aB2ghpgV0fyyCAY1WL5+sVGgEoeet9xyDUVRWAiqnHpz6OWPr/k7i5cu7ppin72VFWhLAZ5/hTbD4+7ClpA30SYgysgtBBkGWRjvogX0GpkEyp3RVlHHT2s+n3i6DmBjeng1kaJK2B21btVKhnfvCNr0xnrNnIYe4uAClWO/imB1MzA4ohdKCgmiWYH0cDL1HeBygAAp6lzsQZEkUkRFkuHjU/Y/ffriWk7YjeUkYjB0ErQwA1aoxDqAFWgBOAcs/e379m9qSlcgI8F6KgQVUApXrWaLy4zaumkwAFbOuuQv8GParr4jFYvnMr1mUQgouQZQEWRKQpMoBz3XFV55Ea0kOi8HDoDehagCnYUyh0eiBfCU//mcBEHfhue8Clk94TQDSoeKhe9pzWA99fa+p9EpmcmK3Y7cTGD550l2rS6fAegjmCFgfB+P3QMHMZlkQEURZEl0yo09n/uwlPn7uT3fsAKj8U6Uh6ubNMijsdkB+WRm0wB+XDUAJR3b2dylj7ndt+2gIletZv75ffXUOUtSuCPHv7xzYlJ6NOYD1WIItxCbAZ3Q+SG5pbilIIMsSoiC2Xt6S+sVv2sh9PeyIwaPzjE0ut1HuTqcVzTehRnTk35omTIflI75T+gkCFDZu/a3ynd9yliikTjUI4OogBpnQL5XoWZ+zs3qFQmctVivjJsKYGQFQQAHgQhBEAVqvBNcnJ+ejHQ/J5Og8ulNheZjzhm5PB2F7xCkHZWUKbIKV24E5z+EfuSX/46VE3Z4PS5YseZVPVUqNvHoVTE4T6D/bV5Bls3lhCVaU4QuyvQ8qDymiJLsEWXCd/PCeyh13w5aTJ3HqPB7QXf2pLQ8DmVWa6+Axet4mP6YFXoJVAJu2X9zub6xs+m7uO3mTGZWTA2D2AzenE7vdhElPQ9HRIk2dFtZbFC0itmIV2tPkkss4EBGR5PLg/6K8AGitzINKBoUZYF16Dm1B6HDwErQosksWsKDfBbIcIV8n98FOBT9Dp8pfJ/WYTJiuQtKohiRQnEACVppIfxFl0tqnYHeR5Oau3yKJgpPx471VvxlLx+akXT1XAoTlRXEdD8p9yId8uAlsOvLHGr880i4QVmuZXMYoRv019anXO+1w9Spw5UaSdQ8VV1hCrJKWEr75xdu/AyAFgargu/VLOPgTOfuAfGPC3zxkjQx2RN3caXMzuNAIxFAGMTFlAWwDMI947LM/0kFGoKK1JHIRnK08y3oI8F9JpTXk5IPi2N3aZ9IehQctzc1g0fqHMLxaEFyiS5QF+P5hpsVcDas8ot2CFkjOZczqtGE5XUDhOEDnMTryIaYlJl9DltIvX3Zp/O/+DyQ+8MztuaMgEugb1unHjh+k2U0McpqgiLg48CahbaYJ8F6wMjoKnF7SSCEFXLJUnwctIZ71Vd6TIV5gWlfNa3ml66bfZM6cKpt/9rUMWmJaSGceQOeqS/fee3WBoprn5yfPJgfWv0YnKoXO/evPO+12O3Z2JUFhVAHAkSPBYD2BxfIVFRWvOb1cQAJExPueK3/s1HdjD3Kcfce3wOkDNigIYSfVXTCVUyjcXrmXiwE4dnLZDxrlE8oaazUXqVSEkWEqwIn+P5rBoNfr9bijGjia629yN8FEmpr4PrcUPQV7XLgkgI8H5R2yjRiEgfj4kEl4qZzzaucYmJMesp25Sp0E4CVatjMCYNOCgIruc4qHeO7jbsghrg/wS5/Od2zl6AEnDRTj9ka5k7yxDKcpdvVXufDgqwUVCmZNEQGGn+g7iLlyadVJ2KdFS/Kw+TuzCRuA+R6slOiA/Px83s6PId2fXTrZzsp8BeBSdjExAtzEQZwqD0DMjjukZ5CCn05D1NGGBpr4bPToIyuCyd1BMcq9XBQkCUhw+8thZzKTq7awL3I8wA4b393+3bCb2H5kI3g8RiiLAVpitvvHVzbBxQmykh62z/D2c3viVB+aGhsbs3tfiJuNXbFASwOG9ZDQxGf0ro6tUFojXiiQNkxucknDJRI7PSNbwqJC4sczyevFywy/5w/u5CanMLI6xtNSRsxf6r6iMm0HciMM61dzlvUKTP9/ws9/J45wjvEAAAAASUVORK5CYII=", "1AHTHAD+CAD/QAD/1AD/gADjqAD/QRTQ1ABe/wD/TgH/jRr/AAD/AADFAADf7hegNQH/gADCoAfmFgHKiAD/Mgb/kgz/1BjNJgT+gAD/own/gADQkkv/1AG4ak/MpAfx1ADe1BL//wn/lwzLEw//bTX/RATW1BnhmgjU1ABxbBP/GAHd6xO1mwLa/wzVgBr/RSrf1ACX1AGkljbO/wGrTQr/1ArC1ByiGADrSQbmO0K+HgLnlyLM/wHcIAD/a1f/QCvDgADsEgH/ixH/kgD/GBX+/wD0PAH/ogD+1AB91A/d6wCf1AmaAAClLwH/Nwj/DQH/1Ar3Dgz/1ACxFgDT1ABVah/MIwD4Phv91AH31CL+pwH5RzL56RD/Cgj/1AfaTwT/bR3/gDf/IgfzjS3/1AAwa0f/1Az/SBTm1AzLjiH//wzDgCH/pAb/gEX/1ADt1Bi1FwDkbCz/oADx1AGJoBD/JwD/oQD6/y3B6wvEMgD/kED/gAD5nhb/pgP/1BnvkDb//xfcAADV/wHo/wjwQgD7FACggA7/1AHmRQ7gTQ/uQDfB1ABAQh7VRgD+1ADE/zHxQBzI1ABp/xTOlwDN1Aq3mAHTQw7b/wHK1AntpAr4OQD/Ow//1BrXgCr/1Ca91A7UGgDxpgD/hwT/QyzRSCXqUgD/BgD/GQ3+FQC8gADznA3cjQD/iwz/akHE1BGE1ABMKhDE1BTAQSbOQRrOgADZFwD+QlvVgAn//xm8/w//Iwf/Dwf/iAj/ogz/QxfZowHunADhUQT11AG+Rx/eaTfTOQT/gBT/nwDo/wK8/wfgFQj/pQL01Cnt/wHRRBXeQA/L1Bn+1AHKHQrc1AGsHQD4Kh3Kk1H/6AH/pQD/SwD/IADvqAH8IAz+AAGuogvs7wOz1A6pQjLN7QyzgADKQQ3SQzTagBjxAADNAAC6ngfg1BDvkhb/gAT/Mwv/FACtUQD/CAT/Q0fZJAD+PQj/lgPJAAT/UAD/QATOHhL+1AbmHAf//wX/1Ab/1BDmSxv8"]}, "sunburst": {"144x168": [0, "data:image/png;base64,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"], "180x180": [0, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAAAAAAYplnuAAAfaUlEQVR42tV9S28kSXKmPdwjk2Q9eqYb6JnBHDTAngSssLtn/XydpQX2viMIA61G2z2qF8nMcDezPfjLPCKyirVTfVAWK4tFJplffvnZw83NLfDvsN6o3RMRExMzMwfmwCEwSc5ZcrkTySJqqlrujm8GSDdvWO7KEwQOodyxSs5SnkBEVFRU1UzNrN2bWTCoN2v3CoCAgIiIgiioUp7eiIiUSJEU0RARDQAANzeYboffRUSExtF4caCi9cO9+t3tADSYaQONgqiCqkRsRgO1GVoDZLCFefy5fxEAgEgeMzOhFrzyOcQTaKV2rwAdNCoKqgqyNTqUSNHBPSAYd59sH9dF6Xhm2yBusDfqcKA91Yrafm2hGpWHIAvq/rzmQc1g8eBbA/wGM4GqzLDtS0xXqg0ADLS9sYiCgqrqzaiK2gv2thz816aHd7NvN1PVYnsiIlt16CHoQnUDjYpQiUYVRAysnmyd5TyA47jHiXWvoOawHGSGDlUaz8dEW1CkiWolACXotiiNaiU23aHe6HSr4w5/I+UdZmbURrRs5Kwz0WrBYMBWmvTRvJ4UqomIPWrz9HrAuMe8eTMQEWbMRJVoOfYd6j8JBjBgW0VuAKbD66mgqgo31Ii4UXWXbrmbMY9vwFbRVdNMhFKFIVvIe2FXTRcj7FQrgZLWZ0QtVBOxDq6dPvrb7xGjeRcyPWinDiZi00q0avlMTQdgnf5phljJroouVAMCogAKCqKqYJhQe8S4QQx711ce43F7zFCcnaioyI7om2HcezxQAgNT8KIm1YlrUhwuuP89MkT/fRcOHWZq/HZJ75RxHFy88wADJYVhiqglA2Gtd1XWR5DxAPMGNgJV0y6wQQfTc2A5cB8WFGfnUVFXqrHGl+I+BJlYWWuapmQVMm4h4+w6Ouz2+CJopJpRkog251EYb4D3mLUw3XErOkmDkpI2VaMWqlkr6ibrhgMQt5Bn2O2V1QRgiIOLFWplWirNk5PTQ++BkyEOqruqERFJiFlZC924p7ndzfoY35rJLiQzMVaiZado/ZIh4lYdSkrFXVdLFCRk3XoQGB9wkHk04O6BG8/BKgV189PWiNYbmna5xxTGO9UATR+CJESsDrZuMbc/Hm3741B7yAzNzxV1iHcdR5gtFA+w03QJL1XVQx/FgbSkryWYM+ZtwjSjnjXNzExVGkMdVjWt/3+aLi6koSZpCTA33IbY8DTEOBsiOtxtGdcRExGZSHMeMiUcL9I0UiG7oW5UA9SoSEUfPNLrTlzDfCDr/nUE3PkOZmqQSzSUTrR62Ht5bB31jNoUUaCKuuujakQdYuf2cI4s00MqZq43q8roKcfnMbssryJvop7lQUUgXdSBVXolwKXV8Lkw7lPpschixixD0vMK6+vkgeTlQaZFID0zY2XVArw6XnTRY5swudhTH4w0qFaHWUQc0d3z7eVhNvTRvYeSosNMps0U2/OpNC+iXdSAt/PpTnaBzMzV3cnkOsy2qGfvYWpmEBS3+ui22DEXpmECzY1qMqcP3K1t25d2qyzmaoWzw7O9qD9XQjh2H1YFUiIMVT2ysgrLFBWPIE8rmikalrqbtQpYzTrMHOpbzsM4bsoqCJs8AmdFIiASMowgawbub72BGUxFjZ7VEXMIMYQYQ2TJKWfJkidxeEXvQ4tjWr1AaKjalBSqLaKULDgXgRSycbz3br091Tn8py1TqlaYpXDdElK9wfTGEAHAaCMQ5z+gqKPYIkp5czPFoMzCwtIEAkfVx7l818RRi7IB81Ybx0x7Nwg996jOlipuz7RCZZq0ej1CKoGRWblyPUDdAu1Who1nEnGSLrUZ7Zi/xPTOFBvZw3s0gSAiYi4CYRZm4bEu35Xt3H9xwkzMzCBZSr1bujgOvce2pMe0K3Y6UxyWCODZQkIK0N7J+dafBcYS0FeSqhUuMUjKKecCWq1ANsf0DYe3Z7r56RFbuj5q8oOESJmEmYMwS02bXEFhXzrwXrq46FDdXa6WWNcrOmHehZbG9L7utkkh0D13w42EiGH3K3XKGGAUCAbdHEKMMS4xhpwK0w1zVYc3xGNJz0wPqp2ooXwAkJk1Y8xIxEElCHM3xbHG3SxoYbjFYguBQ9C2g5PrUkVnzNuAuMs93LsHirMhKiAU1N20KCOJ5IWD1ERefSDfLLd8EG/xOzAmkbbp5GodsziODRECgIF1j1e4VkRA0maKw3uUbK+IumpzUA0+P50SU7/IqntmnPtWmavs6obog3AIBhD6vkVNmzrXBXYTSCO77GtQLpwFaQJRdLinaoL7hhMH5IJ67O7p0IfpjdBiZgAAAcEAhkaocV1hl2fumjYFkB7YcgxSBNKKv2P5Mqy2rQsd6sBJcoPdyxxbfRyYYfmdgawWHUssn02xq2PapRLs+ggiIsLMqvPyZS8PRKyIQwha/UaWeTNr7zxcKg1tMy1QfQUG7WlbtQvw0BCLr84llV9CLvk8ToUbGGV2X6CpRHOgtdE8gz4wxC3NiIgBARtsG5gd0Qi7xYjUegszhyCSmZnVBZh5s2u4Jm5MN23kvCP6pu8YSQEGMoOCu1rk8B/ee7iNqZqElGBxipKD5E612zba7jITEnEIHCKklIai7VAdW3G4vWkMiO1lgHWDhKlotF9itxS1ECc5ZK6bi9tUryd4hGX/PoTAM8/yAtB+D7kYItpwgWWdq5NAjA5si3JVSBQJOeTh9tzmnE/wCJkChxCj5ZRySnkj6FkeHvW8b1oNscMu0h6W2Lk22oBue3SJYwgh5JCnCohLWVyqVHokKKVc07t9v4XuFb2FPOThYU8FXMDDAkwTCDHHHELIXDoKqhz8C6wrB6RihFFTlfS0PXsT9A4yQiCr3gP9ohQREI0aaCMAcN69JyHEiU8xh8AhCynScNbgdEiIREXQEdeUU04p51FDFxcR57R0D7l5jyPYxRaNjIwAAawqxDqajESUiEOIuVKNSNv6ac3AG9ExSKopaccrN0KLXyw5yC24VLjoQo86B2I0idq98UTEfI45hzBS1D3TJX6HEGKENaWUUsp9A05uqaPQTDvMTdMVLqCZKTWNGCGgkddHIxtLvlcWUDHmnEOm+gRzcGk+uqT/oULOba+ie72ujpYsNZqnIsWk6SYNNEN1GjFCMDLq+jCbltklMMecQmAiLLjHgrK66BpXQow6iG57FXLo8Jyr3GLGQDahBhuoDRSbqq3gtlkduS6hTjGmEFiov5m7vo6Cma9pXVMqgh5NVjInpmY2Kg5bbTQ/jaOkBeUFaK+MDFVb1chIwAFSoTrEGHMKeaxxYdOpRGVtKGthuldodnZoamoAQK7vzoOGpmkYVFfshWxUAxMyMrIC2xxmBEApqMPdklMInKurdmvE6qQ5hLAs9LymNa2pVJRa451sxAEAOGH2ax/omh5UQ9e2VuygOARS7dBqaiuAeSWuNCamHmFGIk3VSccYY1rXNa0lfrfirmx8h3WXQdug0hxaIANX8nR1TzQdQiEzmry4i41EFEJYUoqBpQVFdB6PCuZlgXVd17WKo1XwNuo4gOxI7qAr1VvQDbaamYlD3fsrCq4qkGVJKabh9oamCYlCjMsS1ut1Xdfkq+gytVlp77ihTdvktDUcyCrVe9AFNqqZgmJXNZg1fQAgYCquYUlrLA6EfP2OCBvRel0nzB50qYkBUIn5u17PGTSiAz3ruuoDTZsTxCPQUBzI3bKscaVuiTjskDjGZeHn63VdU74F2gCKn5/VsdEzAkIgMEMPepK1aYGNpmZiLVYaG484kwqXy7KsIRHRXCklIgpxWZZ8vV6va5Latqttl6WGQw+ZdjS7ZUkFDTuyzaCEf7RKNWp5BWbG9Se4CbcI5NVpjXGlFhR7S1gh+kRPBbP0VmNPtEGNnB0xzYEQJtCGe9AwxNCpxrFe40o1AJSeMCTmEJfTul4TOYXUnDssp9NyvV6u69oKNDJ5vA1kuuU2atpY6h4DNOxdSHUvaGiqJmZmxMbTsn4lDiGersuy7uXBy7Kc7HK5XtdcCnhTT7cqQE1bbtkg3AZ9LGwz7aARWxGdjcGFR0TiEO/P1xgSE1ELLkTEFOJyXp4ul8s1+WJY7zqAsvNVsy36rJxn0J7ryYlo1TUaGpKqmiixkRm7kI7EIS7n6/VaHUhf2xAvp/M5e8xZJLdOmhky7RIOOGiDmUEfSaTlgKXchEiqJkZsLdw0eBziq/NlqVRj7b1jCsvpzJ+eny9rrxwU56GiCti2GG/FFNjyPIG+CdvMSK1TXTXSYmTzfMghLOfzpfpq6Kjj6Xxen54v11SW4cXnlU24aqnHgr4BeQN6Y5Abl12ppra2M+UR1xHxwmF5e3c5XWemw+l8h0/Pz5eUW+WgOry6wVG2rm+5jYP+KAyIsIe9t0fShloras00FY0BicNyd/cUVyYkLMGCOZ7uzs+PT89rqiva5juAvoAZcMdxWTIHqonmsUYG7IG61d76UZdSmwJECsty//R84cE08+nuXh6fnq5pAq2G3EHvMAPeUMYt0HBD2WRqZGqdahq9Dm19xHF5c//0tBbUSMQcz/fLh8fHS0oprX03y5B5InrW8zaaHILe4Z69toddqDZVURLVrBp6IRAoxPPD0+OFuTDNzKf7h/XTp+eSSKdadsTa+zikQYcWOKPuxa4O+gj31mcr9S1gLeoeGyZlyU9h+f7h0xNT0TRxvHsIP398vDrQasTc9hU32tj55j1iBAhcQe5x79kmcx0ZqkpK7PulAJGX88PDp0I1MofTw8Pjx0+Xdb2uVR1GgamCrtKgL7HsECPgAG1HbO8tspOtpqUHgbOkChsA6cNyfv3hMRABEIVw9xref3her9drIVowhEb0zm0AHmt5au0DhBAmYo/+TCKp+wlVIiwsyllklSYRiufvXn98ZkIgDqfXD+/eP14ul+u6ppQEAnueK+aRhh5a39T1N4Meeti9gAG7LRQraGUVFR4RDgBpuX/77jEQAoV4/3b9jw/PFXS2su856XljgDvIm7sd6IO86Vgl6mCrqAhLzqk0QAC+O//mzfvACByWN3f/9u7p+flyua5JKQYOHbNXxoEuDjOlBjoOQR85DhiLwtkDtj4HVVEJknNOVymJZnj49V8+MgLHh19//Onj09Pz5XrNuIQweC7lkGPrO8yh+647Alamb4dy5/KO2G5kZ8khp6csakB//sN3/xEQwum7+Kf3j49Pz5cVlhCrnhvPe5ZnZR+H8Mb0sec4DIu+4te8Xz1Ok2NO65qzKPD9D/++ECwPP/z5p48fH58uGpZYee6QaVd2vrVQ2XgQwBBGcPlsPHfI53NJVSMiWdKyrk8pK4Q33/9fhtP3+V/fvf/4mMJ5iZEb5o393cw4bkQWBAixIf4c9n2CPW2adbJzWq+XD0ngn//wwPDwwx9/+sv7Z3w4LXHQ3IRxO32+jXaAdscQP4PeJawe9tgoURGRnNbr5XlN8OY3/xt+8/Of/vxO78+nJYa2g94/DhJRwM9gHZvd2JieT6v22qhH3/2L89qtHa0WXUQl53W9PL67wn+7h1f/81+e7x7OyxJ6QOFNguTTz83+sD80g3OHVYjgi+S2O2+7fwke/1B2UUguEnl6/0f+LfyvP55+f1+kEbw2+mbSjHQ+24O7DtjxWYh+y8oO2hcNjl+SgX8VzaGoquS0Pn/6d4DL/3h1t8TARKMA7DdT8RjW4WGZ6WsE/wlvIf0y8rj+l3uAfzy9/WXkkX4JQ3y++8N//Qf4e/mXP/0yhph+AZdH3/34t5+e4NPfwp/fPd79Ai4vffPgYndvf/377/9phX/777+H+P7p+fzNg0v6lmE8rWuOD6/f/vA3Pz0KPP70Nxfgj4+P1+Ubh/H8zRKmnNOa6f7+4fV3vws/XwWuP//4uwwUni5P67dNmNI3S01TTrCc7+4fXv/w4/95XBXWx59++yRAHC5rjt8yNc3fYhFQeLZwOp3v7h/e/pjeXbNBvr774ceLAhKH65ryt1sEpG+x3MqSs9KynM7nu/vXP7z+18ckBpIe//K7H3KpQK9pzeFbLbfy1y1sN/bXeBbBGCvo775//rBmMZC8fvjV95dsgEjMKa/C8k0WtvmvKSHUgCICHBvoN79afn5KWQ00p6f3v/3VWhbpxCmJyDcpIeSvLNaYK9aUs7FZrHTNLKfT+fzw9u3jx2sWNVDJ149v3l6Stp2MnLNIIGb564o18hVlMduUxerkAowhxLDE5XRa7t68hY/POasCqOb8/PH+7ZrbbixRzrkc+5rKYvqVZTH5mgLkJI1KNJZuuxiXZVnOr14/fHi8ZhEzMJF8fXx8c1mldJ8V2JqElfSvKUDqy0u9LkGyfsSbSkN0AX16eP0mPz6nUmwyVUnPj/dvCtWtqzaLmpJuSr36NaVefWlRfcQTtxWAobYIhiUuy3L36tXy7ukqIqUBVESuT4/fvUrZjUmi0qTClWwkUkL9qqK6vnD7YqcNFcPW4R9DjDHG88PDw/p0SeVME5iqSLo83T+sSUYzFSGRqPQhSVrI1q/YvlB40UbRxm2oqkIbP9ZAn+7vH/jj87ViBjNVkevz03cPa9beT0xIRCKax/6FkhKivnijyF62JbfDDMj9KEU9JXR3/3B3eb4mkVKsNjUVSdfn892aRW1uAldpp8/1FuqbW3L6os1Pd3atbFYglbNugQOHGEII8Xx3d2/Pl2sWHUyr5Ovl+XS/Zil7Bb1XT1BVy5Ak04raXrj5qS+B7LMNUzVoB/QCd+dxOt/dL0+Xa6qYO+p0vVzu73MW852cWrguuwvU2gVeuM2sX97Q3xBtgHVcBIUmjxCW893dnVyua9aZac3r9XK6S5XqphAtAzjURMlmqr+8oa8vaJ2wDWTqJyEb0yGezudz+HS5jo0MgFIIkfV6Ob06F9R9SS11VlLpaqhUkyGSF8mN1gn9QpPKhmeAMbRl2GHBfF4va6pEVy9aqE7rZfGgEdysJCydL62hhOwFTSp6FE12bqM12zaa+zlZDoGZw3I6nc94Xde1jRSB1tuuKuu6XuM51zN8XSF9AJiadtD2knYg/Xzj1Qayw9zPu4UQluV0Pp2u1+ua+8iZgrls/a/XZTmlLMXvtVlYhemC2qwLhLqybzRe2QT62NU11FBPr3M7X1+cBzPH5XQ6nfW6piRtHxSaqE1VUtpSXQVSp9thmTJHRk3X3v3tW9wUPttM6CD3KSpO0hw4FMyncFnXlPsoFCcP1ZzWdT2fcg2Vtbm2Ug3VAZqJo/pmM6EhBPtc22avydSOkz1oZg5xWU6nk6yF6K4NGAqRlNY1nkqmNLdPVlRWNCJUYR/EGde2qZ8DPY70kBuLuQEdl2VZTvS8ppSlzxNsTJc0Nqe0xrtTFcgBaAVENS298WhfaJDVW25jqKOuOubZSeQxn05LXteUsmv/GPow1ZzSGuOSZQN6HN9BxdJmaWiEW9jdiRiibUFvi1+9B3sa5ek8HpcVywJrJVpH94ertBeqw5Jzc+Kb4xketVV93G761lkZMNXranc+oZ900dVRunmXuCxLXFMVR1OHNczla5JTSmlZeuwxNziowldARS0zGor/OGivN0QLNns6mDBDbbXdqYO4aiQucYnLoqWLtEMeNe4KW3LOawhNIMbT0YKu6vLHwMpBH5sPMlg7yKCzmsGXRd0plToRuFXGm6ZjjDEuC5eeOzf5yWm6CCTnFFI6LSLO74Gbc1OYbts39fCs7Y+MWDPEKRC6g4uEuBFHHxTAVM+BLEuMklI59eZ+1qEuDiTnlELM4mPmkLYOgZTe+Hqg0/zhnDLUuGj6CHM9N1VHADei21yDwnRZGcaFLgOztgg+7nSgDucd1eMUsQKgokI5qtLOoZoPj+UrYV92HuemHNHzDNL6UZZZMeR6GmuMsBlMd7cnOacQQohtXIP1U2BVHFDkgWpQzk+AWSsutCkChlXTG8xdGR30gR3Wg2YxxrhAEYc4RTdNO1WXcnDgRcRjnjYLnaqhOIJxMtyhbpreQG4d4zQ03WN4K3qGugrnhrm9S/2cQ8t6y3cq6hjb/O7+4nDo2qA7EHMacWRD1/QW8tjK2amjiboMJQoxWm1rHHPEd0xXVx0KapHosr2eX3d9GFR9QD+HOsGeNV1/EX0eNLfpIkXS5bR9mQqmtvEK1lM9qlTntETnQGy3p70t1yrsYHc/PfVv70Bvqa6YQ4htuMg0dtltnrpURnPIOedmiyNwTgfpN6CVzLawmzyst+aiR723wz6cL8QYYgy4ppwlq3gXvfvHzJREc8g58SnENqBmA9qGQMogtnoM1dwUEgQvD39+8DOguRMd2lgDqeroiywHozvroo+QOYcg3e3ZXh3HO65tGxy99wB/pHUWxyyPdsa3SBpSlikWuiEFUyQ3U1KVzCEnjuq6at2Z4z4luIFWasfdm0YADMNmCsWEmm5oevDMqQ68EJsO+bvg4mCLiEjmMsykgrZtQ4mNiYgVszueZ+VgcF/UA+3EcUPSfbRICJr7jK1xgq7Dbsuu3slcdv0lcwXtVwQAbrQxKXlLHCfDrQQX2NP8OXXUqVWlkt7cXY0sB/7AprBYmWZegqr2fnE40kcdiQhdIGPmS9hdCMKroyVL2Dt6aCg6cJA2DKUntK3CBiO6tMUA1WgukpmDhJ7IVvOiTrWBktcH0CQ+CPPEAiePbWhpJ1JcAQ/68Q/1qQD4FoG5mFkx50q1VV3TPKBUCazB7pB1vBlhNwZ/rw4koml+ar0uSOhn9NSv127IAzxqka6PEdDb3MxhiN5/0NBf2B5KOwiHU47XrmbCHEz6pJzpzPAsD/B71LXNogiEOZhLQjaGWDVNG3mYmYU9z6PtZcZcz+mFRjSlA3H0Ko2jGeBAIBSDqlVT7HNKNyMzN6bYu8XomOhJHEMfpQ5WCrzaxaHOkW7TZLeCaeWEIhAOqhpc3uTG17bJtdConrkOh0TPDg+7pFuZlAMz5j7LbM6U3AHt8X/bCCSzROZQRQ3WRb2dXXtE9Zbpw7S01PHqxKpWdqzjqmR7qZipa9LmSF4xs4pkIg4axk/3UY40ixr2VIcvSRqH9+hV9MChXhPEDeb2Kd2cMNlcTRAWYRGRgnr8bNWHnz5ZYFfcM9Mjgm9Ci1dHR82BmXkasDsUfdStOlK9gZpEhFlZw7gAymbirvVRjo5pxZcw3QIj+qpjYMv+ak0O1C3QNhYxKiwsIpk4tEF5bGabicxAB0yTAQw/TftUeqijioPahgVT9jzDVh6bCpP/tHFNIiSBQ7tsC1u3xGl2bRua6Y1xNkS6xbSboRo41KnR6nwHuKWES/CcPEbXiKoKsQgJsYY2oobN7GB27TDFYYzhpsNzdrjVRhnPre4yQgPkXiD9yx51IZtiFXWpSVodTTqPzNybYiDwe2C099N1jvqo/Pfx3LsLNh3Bbl+aVzBlULiUofJtb8kY5nndfeKu+cmIgOFIHVOON4uDuY7n7pds6uWJGv32ze1mLnGqm89ExFoE0l+5E8g0cdfPzaRZHsfqoDozzmMmcURXscJYtGyDy1i+9EaSRnXjuh37B9jOru1Ee30E3Kpj1yZM04T8Mp5bjy4yNdqDD1fYPiz27pwywN9rbBpNWkd9bvQR6PPOo13Gj7kDx+wn5JvZpmPEAR+AD8471GQ3cCkRE3FxiLOkpwGlFfkL5FHEUQe310tV+As2gcMNtj/BMfW798VAZ5qIVbn4jzJ/Q7eoD+VxEFq8PLrzIGZmHBdPGLWtba10Rrzt0beBWFUL1dxMsc2rmuTR3LTugwttYjn18fhD0jQu9DYtslzz53xwAzZd+rbFTcRd1Fymgw2icfYetMvyyHvqBr7tVZQrGDKB+OFJdtC2vF1uHfV0dXU0gXARtXFdDxSicfDsJ6ve1vSIhe1iMfWaIDpd7G2L+vC27wNVD5u56qPCNqxDYL066MWapkkdxGTSx9yNBZZtulWP7XCscdv2opCQSrkcDzt9WKf6hqaP3HT3z9VDF3UQM2HeXFXPrWanBe328oWuYLb1H0IS6hUBK9EG1ubt7jWtsyHSVh/V3VV1MDH3WYLWQ8KG7I0JTudnPM3UhhEKCSlX91Fg18vvzepwjjrcssPp+nTNDsFNP6wXGuhl0g3sbUAcj6kCoJqEtEykWWIfVOp8x8YSw8EhGdwpuoXE7aUAxyJwhn2A2kMGgKGP4UL8rCQwPyUYYUIdZsh+0Ea/UmtnGnaeo+Pelw4A9qUE9wM7D9KZrqoGdZKuhqhH3sM5ERopR2Ma5+l2c7HjoORxUPzwBYU+R0aFVLgxTVXVYFXSOFgmPcjycEe0n/Rv6hYrOq39phXKUT4N+0e34m9BXa8HWGYlFYE4qltTSCE7zEnolHDMkmbYzE31a8KpSmO7067mHwNtOCap1zXzZgCYAWhXtHMeetPlzVfVo3pRL711WVzwO3AHZ3TdQ+xAH9ou/0xswxTBDsM42b7UO19kivsuC4juMW/qMUcnXcG2j3Bbi+5XSihUG9W0yYwc1f5ocMBDnzcu9NaP/0yXS9ZNsWvazjpcjs9EY1e1+7Wd6pJW16lUe48Hx0xv9jqZiWAeA+y3Jbdlu73rO+i2KUPL1JNdfDU1UZdojrtDwjeyvG3LAVFJ/XcLwwnE0Vlz2xXHCsuuHjlQC7NV3G6Xdrhp/QLTM2IisnGl1tbHBrfKd3PV9LiwhwBmijRQt9nyjuqyIb6nOnwO8Wj9gZlnnYpg2/7UI5BmO6KxibqgRlXl6qiH12tXmp9A/z/NrrWLjY757QAAAABJRU5ErkJggg=="], "200x228": [0, "data:image/png;base64,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"], "260x260": [0, "data:image/png;base64,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"]}, "hammered": {"144x168": [1, "data:image/png;base64,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"], "180x180": [1, "data:image/png;base64,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"], "200x228": [1, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAByCAAAAACABisOAAAbyklEQVR42jW6WXNdyZGtucN9reUesfc5AAeQOWiqq3ut+1f2T+p+uG3Wt62qVEpJJSmVypmZTDKZZJJMAiAIYgbOfHY/oPo5HjwizJeZ+1pf+T+s2OEZwRQBZxDf/79GU4gZahc2ukcGWYMH7yNSLhji/Sdlq4HIlMvjzYEpQt2oJusMGj/pzAF3B76kW9IpCYC5+fZTGNycZIXapjNEkHRyuIwMOGHgDToLIUIAnCcO2nYTCaLrQD3p3G5rJLqu2LYvSoAON+O/L9W5DJCEsntZikIEAC1bgnDAENccuwxSMoI3W5DuthmnXG2M3L5xdzjcMwEDsJ066IDD8PYprDPAmYKsrbsikADti5/6jz/I4nTHZ6+G9TYCFJweb9wFh6F2yNXo+qHz28/KvD2QxroYu+1iA/gno7MUCJJcpdyZF3eAuvjnvKzfnj/4aDAc//UmFhp6dxKA27mT7rC+crvpuVnsu8NhHikBIEJY/cnpBICEA50rCMJpSIxG4dunISP86pfJh988sqStoBydTudFR8Hh0cK7MkJ/xGhw9wgRkDNInnfb0Yq54/7VGjKLdABOe7TYuXunXv/9zEGjlNycPSkkbcTSp+o8xst3gBxES5RC2n887T+Kzl0ZBCAw4LpGMQdA6nc/OwkQDnp+eZbXVwfT5wsQdEZNgl4oWJfyjW5+OV2g9YVORKV1EF9/M873H9wbmUHAEYITuKKZAVTEztmSFQUyh74/d9doqwdvHSCUKfrajGSxmiSenLl82/Vbymt4Z2T51w7oTua/6iHADSGYA2c0cycj6f/9eQQ7o1m8PJQ5S+H0vAPFSIleUCR1bELMLgGSHWEWya5A+T+vHPCyPLCPirsRIM38pnO6+a3qYo6S3Bjx5pUBADv1D09IpUTS5zCKpaWz/migoNq1sk356NIPPxrgbuLl4Uc5Lv8Kd8D8zN3lThGMn69ml7W1Gmc/kpAzTf7xNVQDlOAbQJJVOfEWEFmTm94CnUmrfy9ON2fW2L67e/L5CC8G8IQGSAQJfwUv3Xa+XM47p8tR3dHvrDPCRcIviIgola6jkRSjJ2xzZ7zpeMK/rAB3Y9Yku6sfRgJefPH3q6EYMmBGHmwJBxKob52gItHBfnMoyShhfBmRzUvQ2xtQihqOEt/9c+sSCw1ujJqCFy7pMOrpj8bFVE7RzPj8toMzStQthCrGaPjgBqWbbS6w+fKSe79rW5fzaiZGRqW7+6NNcbjVydIcWZNwg/vo4MVXV4D7MofihPm7NUhSEYa7l4iogLqCzZ/HjBIZk4V3Fz9/8LCX5UsXM0OO0j+aG0TCP9zvkP/1DhXrgB9/MMEc3GynndP5zEgpBdI9a00GaB0+X3nnRqrCXH5x/atfZ3csZVXSDasfOoRIZrt7cVvDELg2Ay7NzGGuOq52isXZ3EjVoEPlueVeqO+Icf0IBKGo6e4R4cvD3bl7NFGObvjz1kOCMuzDjSppxnB0LAXT02LmBKmy2AFf0vxW164XXbc9WZ7u3cdk++cNSUG1djCPTEubj7McrCWs8P2bQonMhNePrwkzCTp4krbFIHNzJgyy5dnBrBYoKdDHl9kJjtXFctm+hygpW4LGbPR07X+HoOqkDnefjwiJmXBpejCaSVx8eTzOhjuYhMFdoJvH/POxTd0JInL2XRfFg00q69XkkqJqjYBcfS1Br6/NrNg4W666dAaZSWdG7WiQnj3blK5bXqJFIeXuMJt/bdYt7vQj2+Ll/nVMCkqmRHoOy2BkU2gt1BpjCrFPEgFyKuudjEpjBr544w8/uPz62roOkiFkDLm5c/y8E8wXja/25yYWS/dICFGfrHdd6isiPJWpsa/jUUcxRExqvL56kJ50Rm4/PSl+ubq6LqNRVCDhVYCbbb5eCwJiPHrciQyVZmFBon5xWOKMvZe29bFHtrg6e12G3ZkYUgzavPNze2CGzJt/zC0D3Hk/mkRFwnaWIAEvn87DDSnFoOKQsvrUzAn8/a0ScbNZra6HZXt4Mbu4GieY8HfPGREcAs9cvjh9GKhvvhk9ApFmnciIDHylSWcQ8NWGDrh6ugFwRgv3VkZ1/3lRkba7AYMtfP3Em0dEH785sBqhhsV7keGX6r9/3nmKkR453tYgunG7M3aeX13JzSEisZYHWCM0BrrlJ8skxbh2Za2hrSlKqy3V31lkei9/7mJUxubNiw5JRpph74yhKgIV3Axm35/z9vpyj2l2rEFJ3JTZp3OKNfqYbLKPCC0Z0Q21Kji9nBCtrC/ETGbVpniSqYLQnZmUAQqs8vH8nwkXKQE0z7bJWh1kffbNThOpWnt7cNYyInSuDB+Y0vobU/8R6r4zKqMGlwgyZEzx/imSUBACFV+e5b10ZcrNMxYPLhWSQZ+9shVpyJZZtFFE1vOjPquSofrH0cbV+7OJS41qoi0SDFoEpahOhWBo7r56y+6y7EVWxfbqaIHdtnRKi7+eib65s1aNSmpmbfPsl2Xe31EopLMngg9UHcZCtoCp1iJ4BoPM3UUE3ADJ8f0YsOXJh7m4PFtbYdjDm6XFxV/mVUHntERk1IPF1ReXqNLIeSkCPyW9pU/Tf32CGjTNnqjCxRAJH9LMgEAx8ZUXCHZ+ceEpUuK4d909+coTiqxo4vb18fm23x97RQ7t/dNBfZ2sAhjQVwk/Z8ijf7raLOudVg1wfv1TvXd3B29egta9WqebKxg3MGQm3LudP/5kSDD6Cjv9+iZbq3nvPKK11s4gKeJfHpchogXj+Xxcz7NLK4W+nGevcvmnM1u+O2vnpwVCPhk96GDfX3RBtaBb/Ol4unRW1JrC+wsyNAUXmUPNfp5R+yEnr8YJW4jlTdBr1uw8ImuzJTf/ugIAlHCH/OSaVpAK8M6cWcFEfPlTTLsVYlBE6KJCMQyFJ7VvEdux5dDX1MeXEcnAS6PVrFHAyFpDlW/WAABHf14Q8QgA3bLKJ10NCZ6Hj2TbabfNmpB02Zfo+/Sc9H1VnbH2Q82K3/0CjatFOaLXqOHRusiaNcg3DjgY2XUjfPE2HYykIds6qgBe/JFwH3dQmFKdeahmsJ4dT4a2fnL4YDdrZtj60cbgMdw5iaz0WncXka0SyGO4S6QThq+e9NWkkOilX3dgcPuvq0wBfuf08mbNLXZtAqmefWLL450fyuRk9yEi2f/lKtzU16HbJFiz1q72QZCnS6dgRrUY8TVnthOZgpPILtzzf81FRE2Wryik7hXPSamHn5egrcCm+cWvqq7/eVhBDa3W/r1nzYjwKhLEscNLURVVN9iOZTOLZgiCT57f3fvw/qdvU5Bar1lXlBzaYnW8mv7ylVJtkpV16LuL9Z/3/Q5HDq32rKsxMxjTOUkAeWxdYaYk3blGtTJubvgwOs7/dG5Hpy/bZXXWqME6S/PsK4uidInoMWmTxsnQkp/+3FiGVW2thXUfXZBRf3z88UfVnFy+BRQ1QtJ0gQq4++b87vDoiSlE8uF+pFpPYdYA9W0drP20f2Z9tDqdqLVat88bm2xvrL1KTA7PH0yf//0cB3nn9x/ufPu57yZaiN6NGQAlJTHbfyTREa221YxDz4h6pVaDeRVZp9EezncRqZ2YDDX/hsisw04Hln78+6nOVl8XgJg9PVg/N13xnkrpCrRzBTNnTVFnLKMpIiJ/e6BErWdfryacVOe2r0O2m8dNH/T9809am95/eNBU67T33UUZfn7qNTigE72oz3NRmB3eu+eKxcWlIFAwhzaNcPfI0Cu7Q+6/XDL6qWW2/TbNrJ+ouzrZXP+BoGz54Vmtkz7TlvbJTaSi9hqLqfa1v5B1BVjNTg6vHexRrQbpZnMwI5OuFzOd8vHKqerasbLpLft88T5rG3ymbMPOUM+502q2i8+XMa9UtNZbF9GGSs06hJSJn9YwM8e9jQiQ2vzXClb3b6yYr5AZ2XjwLfXrD7qL2besOy3rttb+zqTPFzb77W759LS2O+eubAG/f9VqlXlskoqaMduU0hU37MwoEqgLRSadb84zs9YwxTBkfumM2ddn1u5fx6TGsB7q7qS1IyMv7KdlGybDaoxQZp1uJEVwhEkht8MNDJFA2wCkhFaihurJCaFW+9+cMDLyYh213114C/z+JoZ89+h+ToZ++If6vjYb2lCxe1X7lsTdmz5D0uZ25TG+Ayl5QXez0sLLuju9vyv2J6dV2YSyNxuGoJ6x9X21Ifpp7M0u/7FMu391MTuJ6Nt0t6Gvsl1m0Bk7FyGgdLPiCgKXSzMKFP6vc4BU1Jev+4cfDu8RrU+JD98Ho11sI9ow1K6f9DUfP6p16Pkuhv5/3687PZKpmoN3EZF+9G4X1T3OXHR3HVA1QwTOQZAUSrd8e7rzwBWkIu4dNTG+wjBtEYlpX2P4JbLf2Yla+93pcJ3JGjUl3l3kyfuj06NzlyKH6U7bbudXq8umFG8NQpKK2oWRGle7EtwZn/8xIuuk1hrZD9u+tcTY+umkjzbsDMOdN1fn611Syvnh06OVq/XXUGRLvt43A9R2b9dhIkQqam4SVARxV+Ps6Hr2atxuN+vV3YiaQ/Na0/5Vu7EzrSd32nQ6jE9mzNpPVm9/uejfLRVR+0tX1hZxORqpCExHIwGUrpiLvnAqstXts9dbSHVvy4javD/J7f43WWv77CK5Fz9ff/TrKS9fLLdjMRge/8zUB0eMrP2xZWsRGSKlrD5OtgUgzMzpxbrSFYN15eBS1hloDmVfX32n1r1T5jRXDZcn89zxs8el3d0pddhp02Nl5OQCmW0nSiQJmLtDAR9X9epqtURj1JTipkW2DLVlHxF9HyfMfmh6rsy8Vm1DHLbpvTi7sxlPNsO071bDtLXrTWbW3cMu+op7sxYiSTKyBkV+8cQBRNQUlcpsEaENPLL1dei9H2r7eax1mJ6pTnZ9Mdyd7ETd6lp9JWsN8pWRbagfng991g/fR1CquVRmiIynPxRzQBmkqJItQ9Illa3V0N31UCtfZeund4452R3688lkmJx1ra76VmtbRkQ9gFoL/2AlK91wbsXcUCJbSIw33wUookVQZLBlSMx3itpqhB5e1uxfICfTvj1cT/t+5yHa5IvDQHvQJaNfesR63rde5KqwVfvhcjJxDy3Nu3Hcdsd/MitmQkoUKRWRVM6zDZkh3THbnB32w6RP3p9NMmPs4pvDyMy+lfHxT/ofv//mP9tvppFt/s/xvO18e8DIftrX+wuR1OwPYylmcFwvy5rdWtgT1+arMrQMRfR//N4Yd/YyFEM7y8n2fx63IaLvK1n/n7fM7tXi38r488X/duf60y4zYkMqVDar6TtW5+bPY4KKJD5zEJSG5ysAjLv3Wl1rs3j6FUiuZvdr7X54/9Fk/6+rFrg7q0Mg3x9RtbVkUYz785NOZE3PjJaiLl+g35l+c4nijCrBcNtztO1YIG33D0CGLJyIPhfxzWnm6fhy1Vruxt2u385PXyRrTod0ZA7VcpltyLhxthbB+mPXLc5mDy8KQZoVEHAHo807Soq6KObuGO7MsvaTLEenSU7qb29q7Pax+vLabaJeMa0tq8XQgv0qW2ar1uTuOl0EQea/7DMzSMApKaK2qw0V2dpIklD89+fZGtkv5Dlt7e4b252o//YkFHVYW983ZsUQjOB8qKFNqkoEX4wGKeoH17jNGFApShksoVANEu7R+nb/nWW2ob3C0Leh7u5En6qH2QbVmGpAZAzsQ5AWoUjrjQrFwZq3g9bZhoOKu0MA1TLSjawpd2bm0IIfXfZDdd9Maxtqf3i4wzo5tJw2UX/zew/29voB2erV4cVv7sXNT2/X93sHyuGtFjIeb5ZXwx11BYKypgh2kXLmtkbtE+b/8jpY4qJXm2Qb/6HucjMup7WX+P0a10dXx5O71+fPTg2xPnt+YYzVzgctf9qAocy4unYv25kPxGQbKYBCp8xUbGpUgtl2Lle6+uowfn23z/ony6qesfC0Onue6vuJSvmkCylrvT6mJJbLcXtMEpFZXwHKxGZ+iQ/fRUgwE1tKEZuQIlqvx8/vHr4o3r2f/eZ/PD5tNfvWH6xntliPWWLSqjRjQUYOtRNMrSa77d0rsqawPJEyBOIlProm3Vx1YqFQnn6x+6sWfb//6Jq+6Dxb1NmPFy377LOdBFu0uLsYaq+WF57O1mcyLKiajPX+fWUG63NDZBDIX7D3unOmiFpCGv/yM85P/9vvl58defSxd6yqfgj74F3rlblZRwxq/rvDxj4258vmjdlCDESr7un/nB9/1CDZMWvAnZxfIe/MJTDPV30rz77aMirfXp/cMFtg52CMfhKeO+spatQDoQ2W/quVLY+W1u9+fJaDkPJgnwqWrxfsTvxXnvuuW+/D9w1fLHaq+8nh2pg3P5lqFYhY1wa2+O1BPwmPNv+DeYs29MqG+u7k9Bw2RK2//1EtGH7eo4ZYvz0Rg8vjj+NIEQSBfFVwjmu/edWZWbe9+3bMgCvQd+HRt/jgckiw5WfjVp3BdnN+dLTYZrg8Jlnjv13E+O50ntNpp6iPj0VDn93JpZEgAdxcAVRgtrECSvH7fTePiKwrj74lpm8zUevipXtV36L7x6x2vRrnHq0XYu/781U63dFv66tDUpmOwPzVZDqxhOu5GyLCSgGpaPXuyQY1stYR2ddkfXtIr/eWx4URbVDVymUt1K63U0aw7r81WUNjKTtvXkCMrLIS31/PzxS5254tdpcgzCrJqBnCx28zWg0bJzUTWn9nW3C9fhhdH0P12LBU70ndm/fGfvXFYb8JcQpZsReFipqkeL4Pwsu4Orwq2AUcTCozSLffXak22vqHsvcAvf5iRX2rNT88azUFFXllJXD/XPXy0VFp9y+9VlWnfsZ0VK0UkN+NnYmMelLQbUD9/xElIdTfnaf76rsuLhftg5uZsQ61yn73vLaUYh4aPGQ+lNNHr1WJe2WslRJPf+JQixgEr48E61CDM3cAomJTAZfk4m+fb3Xx1CPAtghYTGsk/NfnIDY3V5spawkVdJ8cEYys5eMLRFiefWdl7HbMQOY3xSkAWhWCBCNiDfcQEZH92t6/8BBiGqptO62RMs83N2BJ1N3LZdeNnZ6eOIQYxAErMN8/ocN8HGyEzt4LYA3YJQAmqujNPYKMzNX/uc8pKGia5PjgulekO5+dRDGEV37nY9RSOxWvXlMc985LnH1fmkPitnEbnzsoScyXo0cSghXTbRjVfvzTxq2bbhHToIrviUy64ysqwFBdmxeoZF7OS1UwANxdvv/O3SpSjrJ4wgvoVu9lhIEBK372RfuoIer4v547QkYrk6TMdfx0iN3A7stFUF4b48xVonr6x/ulplOUXZ88MQocnMDsrzfY7RBJknNnoBT44rNfyvnp3m/v/vIfc0cooxsYDHMuP12f5ztXCwXFPhGLkGUrYbs3m6gdc/P6aOy1hUJM08lfO3K700kk6hki6AWPf9i4Ezcv9r/egqFQEDsbeaH/YUPJodrvjIqsVNwoULMA/Pi0tO7dk0UB/cG5RQtnvvznCIbKpIBELCpBOB51TinU2f0TShHB6tvJtmP8eQYGEJllcjUV0xSLqIwoXq8OJrMfj9fK8OBut4kI6IfHXQARPv+lzyHmHAkHUEyK8CI+uKJuxyLfdsd1+ujYGYKyMp5d1unew8lQxtqcdHv9jnh3eOtkpcqH50bVv/0SYRFgHpyeg4w7d4rjVo4hMwl7B5YKZjrib/ueU3VKKpS+ubTtxeJE93ZrH0Xt/PloxIP3NIeaZHFv6f7JO7OEwg2nDofb/OaeFQKUaBZBtr0rhmo66re/uLObLFMKJu2gyBHi+uJeofuL020UZXvhKqpJcv25Pvz2AgB6OHG+AgAyxqs78fJbKNw8RMk+eC1muufTF44qizQFmNBb0FmTcgz2/qVhlNeoD86zVEkY/7aeLwIIiWGer0fnbTxTZt9/XxBW/HbZ4v33lumeB08cGRR2VkaEir8XPRtIL/jpfRfsQiE8mAVJCn+dKez+uFSDQaW7ojlvCSS/MUcxhhgUPafrCs+jL8yVVA3bWTrC/Z2RamGioTsvzugyADw8itoR/OyazsBv9ylZgd4VuiMCIHhzyzdJAuk2fnBuy/n5U3NWKRWlTFYMq++QyFQRjQYDw0OmHAdER352QQLN89dnIKzkKW8NGwDgpTsqJP0XuPDq8cq8DFhmKCJoI8jNs1fXu71JLAS653Vjt1714vv39mEW++wi6BEIu9stQfjVKosS7gR8Y51jPQVJurvmX25hXbfdWY+KYLjb9uzb/VE8s3spFOrwZ2iqTOPZ8yvWct7qX88IMeWy7sPjVbfsTjsRopsBfmPFMT/bqwYzY/zb1lEKrLu7GaWAuZc/X3Wk+9Vqb6f4+OUFstxwwv0Xq5FM2uW7CwcjIbewmz917tCOEnbrqGDpBsiucM86Y/v8zOkdwPSd5Ui5OV5deyFA89nx7sH+1kUvi4sn820YM9TZNLdUBACD/mMsxbzM+4QVwEyrtzkCVGzOp73p6InBOwcyo7uz6mDueuTFhaBnlJuDDka6hfqVE0yq88n0JkKk0/zJucPgxGKIYoU6/vbSd1YjlPTxuuSPzzmi2G2kgXF3uzQePc/VRoSoCNA7cxKQ781GBQl1pds7ugWMgKtvWeAAU/PabPXm5apz3wwFSbjD/7GvvlsXQi0Jokxmvzy7xo5figiKQufF7RYyfPB2G9VIWOceVQRh8YdtmtEZks/85eG6wM1srKCbIc7elnFVfQRrFQD5+MUbM427tkEGKJrB3JQyxzCsIjoA6E7/08v0/t1o5fsLMxWSQdAuXkOdAWZucHdE/Xzr6OY9x2wCSPr7AzPKuw/Ot1VOooAFnunmxMP3YAFcV/+2RXe5OK7D3g+wAngSBHDZFVhx/Bf5iOD+qdO7suKUggOEP+rcxQL8+n24gxw7GJT04rAH14VmwObfN4B1cBuv9o7dPUgZ4LqxYrLiEgwOkU8LvDP6tpuOBoB+cOIOoUTy46sRILpOJoleHBjCYAXljzO4s3OG/MGFwZUGGMArWjGZizAgiJfXQClwJFa3MIN/Y+4hR5W3uPDg8mJejSSteL7+cr774G7Fn485mqvzIFEnSwp0o7mPK5oVF93pENE9M5QCICu7xY4V8vHSHaJl0K2dHF9vu07dfXfC/ew/ztGd3RxE9ws4mgMuAuXjN0G4isN8UdzdPWgGQPCfVijF4apB7xbT9YtX57l1BRF0YvbDKJlxe7UHavuPZyXQFaCrKigFTHO4+71zoxu8wP3UnQ46b9FH6166dw5XC7iju/m/lwVlOoYI0hnfdQA7KMrFXn321dwAdoXh2DuDd1RYgbvlYql+vZWtMblyQIQZvDjW02+3XgrAGoQ54qtV8TIve1VGwXl65CA6hbxcffdz5w7AisJ87xosJL1zd+w/GR2FSWMyCiW3YvQ5/qDEaABrEgb46udi5ra+nMQoOOKzAhKWgpt1Zp0DdBPNhrdFDri64u5fdm7mpTO4+c5CBNyKbf/2/wEw/rSsUarIDwAAAABJRU5ErkJggg=="], "260x260": [1, "data:image/png;base64,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"]}, "fume": {"144x168": [1, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABUCAAAAAAEki57AAAHo0lEQVR42nWY4XIjOQ6DP0C9dVv3/m+7FnA/KLU9W3VOxt2TxGgQpERQAkBCks4FifOGAFSA3q++/zpXgGdwXpBzPUCC/wvU+U0LPUD688UvKVBR1T+BosuHeQYPl4kPjC+ZC0QF89yWATFtg5qL9IgX47yMMAOkHlLVkDl4LeAWtwN2Qf7EGqBXJB0YSslVuW2be/N8cfyldJKH9EdoP4QODD6EeA6O/6R1Y/NPaP8Ciho34Antr4vxQ8rgYeMJ7EunN7LQNCe4nND8L6Sv3AZRjzqTNG7e47jDynlDO0j/pmQdqQ9KK9K2WWVwgoPzfAH8Q+ktb1eKD5tCCqRZjWnjuHHQo5/0+5XbLxBIGomO1Dp3A+FGOHr8VcdDjqF0RRJ1b9JiMjmMuThu5OePMjrRYblTSp6sHUZD6Cw3lyqDI65G/lNwrtwGx61Cq4i0MRlCjUwjOc+beGwGcIJDJ22j0ShD1fBqVIi35Oi5AcmyuJzQ6uwmZrKWW0pFjSaRkbwdR35+0sWVyZK0aiQGsIhMZDGBxkpktks0dfSKM9Gd4AYBj9gtArICrRXamuCRSM9N1ZTBe4tkjFhVffbXs+nGjVbiViutHE1BvuGIJWxjiVW/jMhsjQQHilp5y2WbSLeybU7CbnEytLBUzQehRa21V2J9RqZIX6Bb2cPp3tXMNldyU8Z2s1qzVwbDfYHsIxQya8oJGQktpnzICnvFirodXOrKrWSe74qdlEks/VBiGLWoyupo7Wp1yzFbMuHhbY22pHWRzroV67TBqelt1O1a2ZJcjDbo0U+H9GguFloyrE6ZN5AWZ1Ta1pZh8h8kPbZF+Vn9S+ojrdMCLKmqZpGtKO5KXBdZezYsnkMEBmvJWlenWbPGUbuC94q2s1LJW0s7px3r4Safaa0nPBY+u9tCalsUV9v72TLV0oaJRtIjuPnvqGXLFg+eklyoIbONbJmYsvQZP2K4dXTska3p4ba11L+wEbIUVfHGWyt1sT6VejqoXD3wImnZw/RF0tnjGhQfnG12oJipolY84xOmZSAt00pasvsXC2F544CitV3YtMhUMhUCnp70cRvQsltpWe5jgyxa0DZp3LYyQKvj5KYg5+5WJvJEuCxswTOh7ZXKX5QBmdh7Vz9naQMCyYuiJTztJGiv7ebANG054WnM6NsbrdeLCbwEy9i1gkL6qcw0f7n0mlUQD23Gm0q2l0eRguyypIVQaPHI4PZ65/vFrew3usLpbtDayEsoReuURvn14LcBP/y8Bk/3b6wx2Kd2J09N2uR+97gdbqP2hLW81vdmea21bqF9n6VfC3OmhefY5LaRIiRFGt2iRlIrmrfgvhL35/qceeL94VsGPXjbFALJ7rFu6FbKe31+FGvOBtCMno27PQ/Jxvns85jjTA9UKc8YqFNeEs07xHwedk1dAt3J4p+927wzSE8omtDOesr11BWkz9Nt7dJWW5B+6tV/dnJL+6C1046gOdPUYZ6uv9i1PuvjO1qx20+1muy8A9to1Oe4b4RoJFrS9WgD+ni8LGy19EN28Wr3Tt/xbzTKVGkjRETqR93rs7rRR8fMbqXVP7A3YzBzsGjbpyA6KD0wJl2f1fTZlTRxTa19gj5pdbBufA9D6Widelmh6/PEH6dIo/9QKv1A902ckoS2z5RXg+iuLQfhz7Off6QPEh7/mGq3rT69UGcM22mfsz6gu8Zmuyt59vNhpVhZUVT6EZtMeNDdZvQTzTNLilCrIjVrd+1nI39QvbW9VdqtpulWdwtJ7kyLnlF9e+xLEPrY+0n1bPCka3xWqqRlw25Lk7tS+5Rm5lwR6OKzxow5iNJke48CG5KOXCN30mTG9TANhiBY/bh7pUh7dvdoN1Ug6ZkbE3X3sErbPtOnUABHyWKvbuyg8dh7N2dgG0qZMNJZKGnaux/NnLuS1e1uHG2EmfEhZ+xLIR1OB7MlmazdNaturW4rqGsIzTq7hynthrtX7zLhFdr1X/ls+Na0mdOgzwRMYJOENE2TSXubvJN22/Xf2zdEsYrUMLMenfk8dyg/nSPvD3rpdf19YKS34it0x7MBOjEkTXdzo8ttTW3X3/fsYlrXnF7wzpvK2Jg0HFbD5xA5pNr1NwifNtMR6A6xtCRqyp5khd3ddN7y7Zdd/5k9pG+DHeOUiawaxTv1/CPOlT5pSPrEpZF73sYTlAq5ntUp5Uhf0tniLqWmOXs2A9HVVHI8Xn66UtEMV3dkTxtG7/eYJe366zi1t2/Op6edZOx+GLVPQOT9eF7Fnxndb3CnOeHjTC6m+MbWs8byja7pWtcpvY1cbwvvZcMJ5x6HfcV+S3WtF+c1Gd+DwtmE5/n8pKsj1I/iXQvxiyO9BzLkBTka/yD04p3vZa4bfB3KdTmz2ZzQ+m3Sl8YfgGsmLH78ad/cleYcp/6eF95MhZ/Fe4zdPZPV9WGnAN6O3JfWUGn6C9Ou+fCLpreQeM92k4nxS+XnKPOeaK4fB/fFuUA/oeX3PJQ//te0rH/B/ET2nsr+ipT+HEN+IenzdaGQORQ9Gy7vBPaL/XMq/nNqO+fZx8Ve9xz+BHrdrnqPEX+yeMeF51TyWVn0HU1/geaA5Qv0G+1xi/8DcdoHTk8gE2IAAAAASUVORK5CYII="], "180x180": [1, "data:image/png;base64,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"], "200x228": [1, "data:image/png;base64,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"], "260x260": [1, "data:image/png;base64,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"]}, "enamel": {"144x168": [1, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABUCAAAAAAEki57AAAFiklEQVR42o2YSZbrOg5EI0DsvXaN+AM0JGXpZSk18LGTV4GGACj+jyDMzMyYd10gQECAIEjQdUXdoRAAOEFaXzSjXSABL5iQGHkzGAHAQdqyC0UjwYegC0MVRhAESHCaWZLWpQkEgcEgdUhSPDACFHIzW7bsUNXGAQdIkkxRHCrKrgIhvDFro0bSxQlJPDgpiAEBYfBErLV10dJJ6aLhmEIW2pwtBxDclq2VpBE1IKHNClNYiKKoZqQcAQjzZStBB6pB450QJcqCYoa8BJVdQLituWyttI5GEphYhSkAUxjVkLzLLgC+OT6aaOloScooJ4oAjMEHJGiAm5klZfkqn7MDJqmTJTJBAZhIBsBoNQiyTPPlCVrLVqVQGlbOCFoUCIABZGBAAMrZxfK1lvEAJQdhQFQ+AAAtMeVpAB3+5b7cfa1lCWLZE7kiSFoQ6mewAVF7/FDk7mtN7AUhqH5yLqlyAFBDOhSZJcZ92QkSFb3pVKVFBJS4kyS6TSIlx2qjZcw6MjKIpEgILA+XKJG0CX+lkU02ApKivW6iJUmJoQDCINK2ohK1Nz+Y6QgSgGSytI2iShQFNIWWPqqtRmPblopqc5qGQ4oalwMGiAaRbsziuNicDYIgg8qs/Ja6gkVaojzXrkUy63WGDYDCIp9mqtpLsn3NTs18jLmNCpJkln4SECwyVq2HnUItisqtZyK9DOJ5WW0qi128WZ2lAKOsNTl5QHD0tFo9PwEESOrpqFScbrFxHdoZmMWzAB+fSXbruQNx/+vP7z9XO/f5j3d8u7z/GwQ6Lo4gEdOpUf347QEPSV6boK78VAvri0ub6qdf0Iwcx7U5j2+nHd4GE4T3Rs+VQUnRZSRmcCix3cRfbPN5djB3KWonSFKEQhGn3WdIdEjytmJzKuAJilPWlyCA8BIUVMxumjKiiCjYBOKdQ9c2rQRpFzY1J7anzsCOdYS3oJgRzZQpgfTRaArptOyRAWMaSk4Ww67ZLenhqIevAcB3xFJONp4JQSmKDh10WXY4O6eoaYPaRVUTt3ik0rZwEx1Q2DQemWg4QYefnlsIT9OggCnKMNMJGlI56bMgeIU0atCnaQZaYU4JRwJob7gT55IQFhYWoIw6J2MdB44dtdesdElAWHAwNyitOwzb5uGsMK5gzkvBahpT+jWarirwvt28nhNsTrqaQh9C4q5KvXdvh8t3dgWneTyPMz9+ftZ1jaKapKodVee6DmoF3ZQLNoqy5G/QrtFT0Q7Oz04TPMg1mkTqBvXyTXnLRqWi5uSt3Rt75UlpzuVpSZ4nn43S2dj18vfLKWcH98ri8OyxF+KDA8mDko6Zp4ffB2ogr3rStGpjGXCip3s8muEnp0FBhQG3c3ai3J31k5PO3hPYxdJD1junQdmFVnrmMY499rnwxYk0LcAw1TRBvIvCx3DTpcH7fJpnMb5l7T8wALI3RDobDEMNWMd8+OynL5xqMSGXAsxD9JQPvI+Cb3K6ZckLU+eKx8B6rn0bHnI4mISsIbyOp++j4uu3asMiwgMAJQUs7GPY/BhDZ17phCxN2GeEvyE1ZOzL45wEbH/8Y7bec5g6s6+Rv8/Of2J6eBpVXj2wQfjrvNAPyk7eA9Qostgg+z84eyTIvN4+ypOQTEYZ/8TUSHAMPV52WeQAT5A1jf4D0/PAgNK0wy5QRopfZ6vjzV1s66QyLeXIciCx3XMvYTlIT92IQYUiwnXIkRGtZ95p8miWeLyr3R4Pj5TTDtLx0nfejh5vNvfMdIPkNfMNRv06czjEnkFqCIhTU94esBgQwTENPCw7B4Hne+gCKdoVp6cvywj9zktxJpNCjjoVsT1tff7Hl6K2bSeTlMesDpjsaRkfp229By4n/3qhVzm9X0m8KTpnwR04APgPmcxpfnHFKB8AAAAASUVORK5CYII="], "180x180": [1, "data:image/png;base64,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"], "200x228": [1, "data:image/png;base64,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"], "260x260": [1, "data:image/png;base64,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"]}, "textured": {"144x168": [0, "data:image/png;base64,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"], "180x180": [0, "data:image/png;base64,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"], "200x228": [0, "data:image/png;base64,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"], "260x260": [1, "data:image/png;base64,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"]}};
    // END BACKGROUND MAPS

    var PIC_KEYS = ["PicColor1", "PicColor2", "PicColor3", "PicColor4", "PicColor5", "PicColor6", "PicColor7"];
    var PIC_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    var PICTURE_SOURCES = {};    // decoded map bytes, by name + size
    var BG_PICTURE_CACHE = {};   // finished canvases, by style + size + colours

    // ---- colour table: the same integer arithmetic as prv_build_picture_lut (nomos.c) ----
    var picStep = function(a, b, num, den) {
        return b >= a ? a + Math.floor((b - a) * num / den) : a - Math.floor((a - b) * num / den);
    };
    var picToHsv = function(c) {
        var r = c[0], g = c[1], b = c[2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        var s = mx ? Math.floor(d * 255 / mx) : 0, h;
        if (d === 0) h = 0;
        else if (mx === r) h = g >= b ? Math.floor(256 * (g - b) / d) : 1536 - Math.floor(256 * (b - g) / d);
        else if (mx === g) h = b >= r ? 512 + Math.floor(256 * (b - r) / d) : 512 - Math.floor(256 * (r - b) / d);
        else h = r >= g ? 1024 + Math.floor(256 * (r - g) / d) : 1024 - Math.floor(256 * (g - r) / d);
        return [h % 1536, s, mx];
    };
    var picFromHsv = function(h, s, v) {
        var region = Math.floor(h / 256), f = h % 256;
        var p = Math.floor(v * (255 - s) / 255);
        var q = Math.floor(v * (255 - Math.floor(s * f / 256)) / 255);
        var t = Math.floor(v * (255 - Math.floor(s * (256 - f) / 256)) / 255);
        return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][region];
    };
    var picBlend = function(a, b, num, den) {
        var A = picToHsv(a), B = picToHsv(b);
        if (A[1] === 0) A[0] = B[0];
        if (B[1] === 0) B[0] = A[0];
        var dh = B[0] - A[0];
        if (dh > 768) dh -= 1536; else if (dh < -768) dh += 1536;
        var h = dh >= 0 ? A[0] + Math.floor(dh * num / den) : A[0] - Math.floor(-dh * num / den);
        h = (h + 1536) % 1536;
        return picFromHsv(h, picStep(A[1], B[1], num, den), picStep(A[2], B[2], num, den));
    };
    // A rainbow colour: `pos` along the stops (painted: seven stops; rose: left side 0..127 via
    // stop 2, right side 128..255 via stop 3), lightened by `white`, darkened to `value`.
    var rainbowColour = function(style, stops, pos, white, value) {
        var c;
        if (style === 1) {
            var seg = Math.min(Math.floor(2 * pos / 85), 5);
            c = picBlend(stops[seg], stops[seg + 1], 2 * pos - seg * 85, 85);
        } else {
            var mid = pos >= 128 ? stops[2] : stops[1], q = pos & 127;
            c = 2 * q <= 127 ? picBlend(stops[0], mid, 2 * q, 127) : picBlend(mid, stops[3], 2 * q - 127, 127);
        }
        return c.map(function(x) { return Math.floor((x + Math.floor((255 - x) * white / 255)) * value / 255); });
    };

    // style 1 painted, 2 rose, 3+ finishes; stops: 7 x [r, g, b]; table: rainbow bytes or null
    var buildPictureLut = function(style, stops, table) {
        var lut = new Uint8Array(768);
        for (var b = 0; b < 256; b++) {
            var c;
            if (style >= 3) {
                // shadow (black, or sunburst's colour 2) -> main -> highlight
                var m = stops[0], hi = stops[1], sh = style === 3 ? stops[1] : [0, 0, 0];
                c = b <= 128 ? [picStep(sh[0], m[0], b, 128), picStep(sh[1], m[1], b, 128), picStep(sh[2], m[2], b, 128)]
                             : [picStep(m[0], hi[0], b - 128, 127), picStep(m[1], hi[1], b - 128, 127),
                                picStep(m[2], hi[2], b - 128, 127)];
            } else {
                var pos = table[b * 3], white = table[b * 3 + 1], value = table[b * 3 + 2];
                c = rainbowColour(style, stops, pos, white, value);
            }
            for (var k = 0; k < 3; k++) lut[b * 3 + k] = Math.floor((c[k] * 48 + 127) / 255);
        }
        return lut;
    };

    // Map bytes for one background at one size: {mode, w, h, bytes, table}, null while the
    // embedded PNG is loading (the preview redraws when it's ready), undefined if missing.
    var getPictureSource = function(name, w, h) {
        var set = BACKGROUND_MAPS[name];
        var label = set && (set.tile ? "tile" : w + "x" + h);
        var entry = set && set[label];
        if (!entry) return undefined;
        var key = name + ":" + label;
        var src = PICTURE_SOURCES[key];
        if (src) return src.bytes ? src : null;
        src = PICTURE_SOURCES[key] = { mode: entry[0] };
        if (entry[2]) {
            var bin = atob(entry[2]);
            src.table = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) src.table[i] = bin.charCodeAt(i);
        }
        var img = new Image();
        img.onload = function() {
            try {
                var cv = document.createElement('canvas');
                cv.width = img.naturalWidth;
                cv.height = img.naturalHeight;
                var g2 = cv.getContext('2d');
                g2.drawImage(img, 0, 0);
                var px = g2.getImageData(0, 0, cv.width, cv.height).data;
                var bytes = new Uint8Array(cv.width * cv.height);
                for (var j = 0; j < bytes.length; j++) bytes[j] = px[j * 4];
                src.w = cv.width;
                src.h = cv.height;
                src.bytes = bytes;
                drawPreview();
            } catch (err) {
                console.error("Couldn't read background map " + key + ":", err);
            }
        };
        img.src = entry[1];
        return null;
    };

    // The map byte for every screen pixel (as prv_draw_picture reads it)
    var expandPictureMap = function(src, w, h) {
        var out = new Uint8Array(w * h), sw = src.w, sh = src.h, b = src.bytes;
        for (var y = 0; y < h; y++) {
            var sy = src.mode === 0 ? y : (src.mode === 3 ? y % sh : y >> 1);
            if (sy >= sh) sy = sh - 1;
            var k2 = (y & 1) ? sy + 1 : sy - 1;
            if (k2 < 0) k2 = 0;
            if (k2 >= sh) k2 = sh - 1;
            for (var x = 0; x < w; x++) {
                var s;
                if (src.mode === 0) s = b[sy * sw + Math.min(x, sw - 1)];
                else if (src.mode === 2) s = b[sy * sw + Math.min(x >> 1, sw - 1)];
                else if (src.mode === 3) s = b[sy * sw + x % sw];
                else {
                    var j = Math.min(x >> 1, sw - 1);
                    var j2 = (x & 1) ? j + 1 : j - 1;
                    if (j2 < 0) j2 = 0;
                    if (j2 >= sw) j2 = sw - 1;
                    var near = 3 * b[sy * sw + j] + b[k2 * sw + j];
                    var far = 3 * b[sy * sw + j2] + b[k2 * sw + j2];
                    s = (3 * near + far + 8) >> 4;
                }
                out[y * w + x] = s;
            }
        }
        return out;
    };

    var hexToRgbArray = function(hex) {
        var n = parseInt(hex.replace('#', ''), 16);
        // the watch only has 4 levels per channel (GColorFromHEX keeps the top 2 bits)
        return [((n >> 22) & 3) * 85, ((n >> 14) & 3) * 85, ((n >> 6) & 3) * 85];
    };

    // The colours picked for the background (PicColor1-4), falling back to the style's own
    var pictureStops = function(style) {
        var info = BACKGROUND_STYLES[String(style)] || { defaults: ["FFFFFF", "FFFFFF"] };
        return PIC_KEYS.map(function(key, i) {
            var fallback = '#' + (info.defaults[i] || info.defaults[info.defaults.length - 1]);
            return hexToRgbArray(getColourVal(key, fallback));
        });
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

    // What to draw for BackgroundStyle `style` at this screen size (sunlight corrected), or
    // null for the flat colour (also while its map is still loading).
    var buildBackgroundPicture = function(style, w, h) {
        var info = BACKGROUND_STYLES[String(style)];
        if (!info) return null;
        var stops = pictureStops(style);
        var cacheKey = style + ":" + w + "x" + h + ":" + stops.join(",");
        if (BG_PICTURE_CACHE[cacheKey]) return BG_PICTURE_CACHE[cacheKey];
        var src = getPictureSource(info.name, w, h);
        if (!src) return null;

        var lut = buildPictureLut(style, stops, src.table);
        var map = expandPictureMap(src, w, h);
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var gctx = canvas.getContext('2d');
        var img = gctx.createImageData(w, h);
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var e = map[y * w + x] * 3, t = PIC_BAYER[y & 3][x & 3];
                var idx = ((lut[e] + t) >> 4) * 16 + ((lut[e + 1] + t) >> 4) * 4 + ((lut[e + 2] + t) >> 4);
                var c = SUNLIGHT_RGB[idx], o = (y * w + x) * 4;
                img.data[o] = c[0];
                img.data[o + 1] = c[1];
                img.data[o + 2] = c[2];
                img.data[o + 3] = 255;
            }
        }
        gctx.putImageData(img, 0, 0);
        BG_PICTURE_CACHE[cacheKey] = canvas;
        return canvas;
    };

    // The rose for the preview, drawn at the preview's own resolution (scale x the watch's) so
    // the petals have smooth edges, and each petal in one solid colour: the average of what its
    // dithered pixels look like in sunlight. (Drawing the watch's dithered pixels blown up by a
    // non-whole amount looked blotchy on phones.) Same petal geometry as the watch's map
    // (rose_map in tools/make_backgrounds.py), same colour arithmetic.
    var ROSE_PREVIEW_CACHE = {};
    var buildRosePreview = function(w, h, scale) {
        var stops = pictureStops(2);
        var key = w + "x" + h + "@" + scale + ":" + stops.join(",");
        if (ROSE_PREVIEW_CACHE[key]) return ROSE_PREVIEW_CACHE[key];
        var W = Math.round(w * scale), H = Math.round(h * scale);
        var canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        var gctx = canvas.getContext('2d');
        var img = gctx.createImageData(W, H);
        var n = 24, pale = 0.12, darkEdge = 0.45, paleReach = 0.6, deepBlue = 0.45;
        var cx = (w - 1) / 2, cy = (h - 1) / 2;
        var maxR = Math.sqrt(cx * cx + cy * cy), r0 = maxR / 2, step = 2 * Math.PI / n;
        var clip = function(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
        var petalColours = {};
        var petalColour = function(pos, white, value) {
            var k = (pos * 256 + white) * 256 + value;
            if (petalColours[k]) return petalColours[k];
            var c = rainbowColour(2, stops, pos, white, value).map(function(x) { return Math.floor((x * 48 + 127) / 255); });
            var sum = [0, 0, 0];
            for (var t = 0; t < 16; t++) {
                var sc = SUNLIGHT_RGB[((c[0] + t) >> 4) * 16 + ((c[1] + t) >> 4) * 4 + ((c[2] + t) >> 4)];
                sum[0] += sc[0]; sum[1] += sc[1]; sum[2] += sc[2];
            }
            return (petalColours[k] = [sum[0] / 16, sum[1] / 16, sum[2] / 16]);
        };
        for (var Y = 0; Y < H; Y++) {
            for (var X = 0; X < W; X++) {
                var dx = (X + 0.5) / scale - 0.5 - cx, dy = (Y + 0.5) / scale - 0.5 - cy;
                var r = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx);
                var alpha = Math.acos(clip(r / (2 * r0), 0, 1));
                var uc = Math.floor((th - alpha) / step) + 0.5, vc = Math.floor((th + alpha) / step) + 0.5;
                var thC = (uc + vc) * step / 2;
                var rn = 2 * r0 * Math.cos(clip((vc - uc) * step / 2, 0, Math.PI / 2)) / maxR;
                var signed = ((((thC + 1.5 * Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
                var d = Math.abs(signed) / Math.PI;
                var sat = clip(pale + (rn / paleReach) * (1 - pale), pale, 1);
                var val = (1 - darkEdge * clip((rn - 0.5) / 0.5, 0, 1)) * (1 - deepBlue * clip((d - 0.55) / 0.45, 0, 1));
                var col = petalColour(Math.round(d * 127) + (signed < 0 ? 0 : 128),
                                      Math.round((1 - sat) * 255), Math.round(val * 255));
                var o = (Y * W + X) * 4;
                img.data[o] = col[0];
                img.data[o + 1] = col[1];
                img.data[o + 2] = col[2];
                img.data[o + 3] = 255;
            }
        }
        gctx.putImageData(img, 0, 0);
        ROSE_PREVIEW_CACHE[key] = canvas;
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
        var picture = m.backgroundStyle === 2 ? buildRosePreview(w, h, scale || 1)
            : (m.backgroundStyle >= 1 && m.backgroundStyle <= 9)
            ? buildBackgroundPicture(m.backgroundStyle, w, h) : null;
        if (picture) {
            // Keep the watch's pixels crisp (no smoothing) when the preview is scaled up
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(picture, 0, 0, w, h);   // the rose is drawn at the preview's own resolution
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
            var tickCount = m.subdial === 4 ? 10 : 12;   // battery meter: one tick every 10%
            for (var t = 0; t < tickCount; t++) {
                var a = idiv(t * 360, tickCount) - 90;
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
        } else if (m.subdial === 4) {
            // Battery meter: 12 o'clock = full, 9 = 75%, 6 = 50%, 3 = 25% (sample: 80%)
            drawSubdialBackground();
            drawSubdialHand(idiv(80 * 360, 100) - 90, g.second_hand_a, c.month);
            drawSubdialCentre(c.month);
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
        "BWHourDigitsColor", "BWDateColor", "BWBatteryWeatherColor", "BWBTQTColor",
        "PicColor1", "PicColor2", "PicColor3", "PicColor4", "PicColor5", "PicColor6", "PicColor7"
    ];

    // Background picture colours: how many show and what they're called depends on the
    // background (rainbows have four stops, the finishes a main colour and a highlight).
    var PIC_LABELS = {
        painted: ["Rainbow colour 1 (left)", "Rainbow colour 2", "Rainbow colour 3", "Rainbow colour 4",
                  "Rainbow colour 5", "Rainbow colour 6", "Rainbow colour 7 (right)"],
        rose: ["Top colour", "Left colour (9 o'clock)", "Right colour (3 o'clock)", "Bottom colour"],
        sunburst: ["Main colour", "Shadow colour"],
        fume: ["Colour (fades to black)"],
        finish: ["Main colour", "Highlight colour"]
    };

    var setItemLabel = function(item, text) {
        try {
            var el = item.$element && item.$element[0];
            var label = el && el.querySelector('.label');
            if (label) label.textContent = text;
        } catch (err) {
            // keep Clay's own label
        }
    };

    // Each background remembers its own colours: they're kept (in the hidden PicColorMemory
    // setting, phone-only) whenever they change, and brought back when that background is
    // picked again. A background that's never been changed starts with its own defaults, and
    // "Reset background colours" puts the current one back to them.
    var picStyle = null;          // the background the pickers currently show

    var readPicMemory = function() {
        var item = config.getItemByMessageKey("PicColorMemory");
        try { return JSON.parse((item && item.get()) || "{}") || {}; } catch (err) { return {}; }
    };
    var writePicMemory = function(memory) {
        var item = config.getItemByMessageKey("PicColorMemory");
        if (item) item.set(JSON.stringify(memory));
    };
    var currentPicColours = function() {
        return PIC_KEYS.map(function(key) {
            var item = config.getItemByMessageKey(key);
            return item ? item.get() : null;
        });
    };
    var setPicColours = function(values) {
        PIC_KEYS.forEach(function(key, i) {
            var item = config.getItemByMessageKey(key);
            if (item && values[i] !== undefined && values[i] !== null) item.set(values[i]);
        });
    };
    var defaultPicColours = function(info) {
        return PIC_KEYS.map(function(key, i) {
            return parseInt(info.defaults[i] || info.defaults[info.defaults.length - 1], 16);
        });
    };
    var rememberPicColours = function() {
        if (!picStyle || !BACKGROUND_STYLES[picStyle]) return;
        var memory = readPicMemory();
        memory[picStyle] = currentPicColours();
        writePicMemory(memory);
    };

    // Shows the pickers this background uses, with its names for them. switching: the
    // background has just been changed, so bring back its remembered (or default) colours.
    var updatePictureColourItems = function(switching) {
        var styleItem = config.getItemByMessageKey("BackgroundStyle");
        if (!styleItem) return;   // B&W watches have no pictures
        var style = String(parseInt(styleItem.get(), 10));
        var info = BACKGROUND_STYLES[style];
        var labels = info ? (PIC_LABELS[info.name] || PIC_LABELS.finish) : [];
        if (switching && info) {
            var remembered = readPicMemory()[style];
            picStyle = null;                               // don't record while swapping
            setPicColours(remembered || defaultPicColours(info));
        }
        picStyle = style;
        PIC_KEYS.forEach(function(key, i) {
            var item = config.getItemByMessageKey(key);
            if (!item) return;
            var show = i < labels.length;
            setVisible(item, show);
            if (show) setItemLabel(item, labels[i]);
        });
        setVisible(config.getItemById("PIC_COLOURS_RESET"), labels.length > 0);
    };

    var resetPictureColours = function() {
        var info = picStyle && BACKGROUND_STYLES[picStyle];
        if (!info) return;
        setPicColours(defaultPicColours(info));
        rememberPicColours();
        drawPreview();
    };

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

        var memoryItem = config.getItemByMessageKey("PicColorMemory");
        if (memoryItem) memoryItem.hide();
        var bgStyle = config.getItemByMessageKey("BackgroundStyle");
        if (bgStyle) {
            bgStyle.on('change', function() { updatePictureColourItems(true); });
        }
        PIC_KEYS.forEach(function(key) {
            var item = config.getItemByMessageKey(key);
            if (item) item.on('change', rememberPicColours);
        });
        var resetBtn = config.getItemById("PIC_COLOURS_RESET");
        if (resetBtn) resetBtn.on('click', resetPictureColours);
        updatePictureColourItems(false);
        rememberPicColours();     // the colours saved last time belong to the saved background

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