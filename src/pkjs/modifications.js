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
    var BACKGROUND_STYLES = {"1": {"name": "painted", "kind": "painted", "defaults": ["FF0000", "FF5500", "FFFF00", "00AA55", "0055FF", "0000AA", "FF00FF"]}, "2": {"name": "rose", "kind": "rose", "defaults": ["FFFF00", "00FFFF", "FF00FF", "0000FF"]}, "3": {"name": "sunburst", "kind": "finish3", "defaults": ["0055AA", "55AAFF", "000055"]}, "4": {"name": "hammered", "kind": "finish", "defaults": ["0055FF", "55AAFF"]}, "6": {"name": "fume", "kind": "finish", "defaults": ["AAAAAA"]}, "7": {"name": "enamel", "kind": "finish", "defaults": ["FFFFAA", "FFFFFF"]}, "9": {"name": "textured", "kind": "finish", "defaults": ["AAAAAA", "FFFFFF"]}};
    var BACKGROUND_MAPS = {"painted": {"144x168": [2, "data:image/png;base64,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"], "180x180": [2, "data:image/png;base64,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"], "200x228": [2, "data:image/png;base64,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"], "260x260": [2, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIIAAACCCAAAAACvaE8hAAAxj0lEQVR42k2baVyT1/a2LwINaiGFypGIA9agbUHqVAGBHg3IicrgRDBW6tAmdaCi4BTEolKRSBUUi2KT1rE1EpwYxBzAaAsI8VRsKRxbjRapCFaKBo4WWs37Idj/m4/5Pc+z11773ve611p7O2ybd2peK1dAhN+Cy28GRUKphNfhp+L6tOJv72jUGtTw2jv1QlyBR44xZ+DqQCKRmjLzl3Scitt7pdM3ZK0L3QxxMX/ck5TmDni3iZsB72bn6dsaIJF7Q+6tYCNcW0gabe/8wjFw3MjOdwWiVk5daRSBNcILLqvXgZrXAaLHFydmvaZGjUYD1Hd1dUnffNMxgC/nOE7aNbS01AR8fopv1uCbNuvW4LOzbtF9GIIrDAYMVT1VLS0t7DKI+7HJjz253BtygJ1kQFpbG3w9DN4jPp4KJ5h8RQQ7NBFMuUyd8mnCq7+/lgUA0+ZN2QCoIZufot6XFrZRqVVpKeLq2BvD+f7XHyB/TFP/2LXy+9fLGPv9liWIkRugJYiWUHYxrIa5+3/8aS5sDfwuZgUbga9GVTDmMmziE4A3BFbsg3DqFK2ndtEfXl1mt4AKSyIgg2xS4FZ4FpWu7p5mz6LCQ5MHHjv25NXcAZqFlZze4uIbzowVJ5r+ec+/zWCoCQoCqKqiJimHHN57vTSwdOX1a1rYST4LGcOP3hsBocTDoxenea1eoGGTlcnzWifP62+U8TsAG3j6saVpFclSdbYXmRlQGS4OR9y2XaVg8KKghdKpuKnJC929tioUWD5rBot6jgHUAnJDUC0YcgDTygsBkwY93dpTGjgBZn0l+FHO2aveDfBJgOUpgtYrp3aAGkRe0AjPn15GDRs2QAWQASYNrXiJvH0wR5tVbWKzFtcuPj67eu1a3NzcWLs7dCy7fQAWuYcgh5qaPjcGy5MMnZKL554/v/AgllvUHdjZsh5WcONX72aRKP7j/KcgYB4AImhtbQRmNExBwwb7n9Ufi5IxkkErVEzXowpQmWGzCVeztPj7uZJHMGb37n0jFu3eR7VPWdm0Q31jU9MpJ4ga0sCnU/afjJjoo0f9Xn99yEa+nvVvDLfBCqKVE6pwcaJ1sgarxiqyenFFxNP+U0D9Wt+HFrFtERy0kpxNNGhV4hig92gMN/bu9lk8HWAfYRt92RAyd/ddfvkwtCcpOLiGJAzkBIHBgDGt/3rSYBL7URUXw5DZAuC+CCsgcjshwAsCRIBoypTJ1nLd00GDItkG7wBWTgEaUmHfttfqFaoY2oraYmKLuroWXZt1C2A5v6y65Ussa08z3ETr4U5qajAA1IRiQA5S+sdeHXz1ld9U8kc1R1t4Nw9GEiAUioD953ACCAM0QCN+XgCapi1ZiQY5U0bhPTBVDbyW1T/3g1VULhS7iokp0quuzXjsszs3f4wbrOX07mpWM7y6oRKMBhr8kWOAqmwwAE/7l04qArd1m91cMT1Rrg/lxpKvB98XisBaXyW4cqpRrenblxHvOD2wW5PFvDK+hYe+qV7Z24ANT6OTxeJwE1IogsIpzh+wNl/9o5qmET5ACBDyRkUcyPFHTg5///oRydVJY5yHbN7+iPcWZcBp+Lq5+eFgAA4JJmMlAI1Gw2WmBATAusvqT0e9VgyGbYk6D2jNSEoGKtID4L+YTEUEUNwZdDZsd8/yR7gxk927ia1eBbPm8zkgBwNJchjWty1+JjLy6o8UwnZ/Bw2vOQHNAN4gAoHXvMkaswSwToGnT4lkSinMw6KbR5PYuykDUhFD4mdmTAAxJjFt2idTxh9BmD9mzO7z5++upfDWjPN3fzl5/sMlGNAt0xkgB33asmXLkIU0AhMm3HsTf7CZIL/7ZYRWKw0NWBn4hQAAC1YmXz5x+Y1XIZD++QUixluOfkyer28OqWiwvjNP5WqflElaBBiDDuDLGMYehfO31ob8sOD+F3tX5xUABg4qMVCDom4SLPM/3LWVwmsyftreiJSNKuEAAH84jhXrhGxBeSugUU/2a2yl9cQgUBvYMN7KZ9VYSGhiyz72qd8VRU/5e21NrjFmYlmwHqrGkg1l++BW9uCzwBDqd6GUy+UYDGlJL96QF8aq8ED+XJ57bKf+J6HYG5o5DhxncLIgAsB6sREauXIlcZBGI98FUy6HfEQ1URVN3EkGDRtwlp6RSh+B9M0uYq4sO/iKH0sg++yBA+NgLWcPcGP2UQqK65FDcIMOY6BSOYlJDWCIRet86/VA/1Msyp8KbQgHC0Xx8QANOLVeYQcaM1dEXBEFmJEDWeuY8mXR8C3TmMa2pNRk1Hey6WlzjFbxphlzANS+5bkh+lH1tzPPAqziussK7nP29Ly4wzT4AzUgG9fgfxXqlgS/9wjwu1d3isSZ7Ow/XVAWdRuhCOHDeBGDBUxGo1GDyE4QU8DgX7xwF+OFXK6YwRZfIJvX9tWjAlzNAW2IzVcuf5PxymzeM09bsWJF8UifuZX7yrh+zAXb50CDXJ5G4C6a63RAINK6nywTenpgXqL6rX9d5AHcZjBCay8iK46CK0xGfRGsVkDjB6izGQ9Mv/sJcrYRuQ+v7FVAcQzaN4EAAtidTvYH8XUnBs9kJrwVwqpxZfvem3YWGO9PGv7BdY4V3kolk6C68ofAazGw7pRhT0TE3nPQBkt4CFZA+E8BXle0hFmtkydbJ0dYYd1Mkr9NjP52PMObfzL4+hK9TKPIyNiGsa1NweYAVSVtZse1aY8/MJn2UUbZeaSsXcvZ7r0HmO3g1uuGf12aXJ4DO5ctOxgYqPl48dYhW+HhZtjcu/bP8BcgfQhYjw98RSBqxSJhh6ixcXJjuagRlBchd8MduMv1Y+TmclBNh6gils0qPb2VWlcVXYRtf/vtTz7J+nFY1rD+JtNi8Bkx7tZs3G0AXPUPNhiQu0ED/sV5dfcaG6EOP3YISzeoqRXbVdnx4xDfMUBAI5tUYEV9BTVcPgOaZdPgWyhxgUSwa6i22HZ3d20n5hgFdD0y4LduYa5v3MAxt59KZ60GrvsMhlY1yOW/y+U1cnnSo0nU1S1bctawbrvbgtIhPzUKEr8c0iVc/u6RDcBx4uMR0YsAJousmxD5aSZbNX4wZ/3TSPqjyWJRAu/lAurt2wFzDJ2oFPquNn2lkelT+P1AhZt6rPQN6RvRM6JH3YJbABquGgw5wYZggwFF4EdXr1KQK/AXbJCD4Tm5LEztfbv7M7yPPeM4IhBZvxDgdwXRDg1YvXL9vLZPAYi0ZElIAxISwcJIvmZaV5G7tlOl1+rRgqsrFcUr3nv06HuT6caN2TNHzNy3z2XGAcBLOAl5Ug3IyaHCePDgpNouP7q6brBHwPNNwzCx96s6eM+ReMCKxxjBz4jUao01gmkQ7mkw8CmgLi4uLhaTGlVGIttvc9vwsakIszZGhbtYHN75rJy1Yf1nIiR8MDOv4wOrOECyFAcgODjYLqNrbtLw6LprbW3POU4Jnm8W7JBh5L/qCwDxdlBe+1EwGutFoPWKGcMnM/2ByI/RXL5MYl5Shk4HwwHkU6TbO2Nog6UmzMWTJ3UNsj5dle8zJOUA7GP1+fOwYsX3rYREvyBlecuwNJbV1UNwsCWmPDFxTTcY/2ppwXM6Nyue+YMVERNwsl6Zl6exiq6IQP5gHbAekFgkhLiQ87ElN3HlT/B6xmWjuUvhGoAYTFKYbNbxxrF9p4PxKNu7e+1qZhLNfbv01hkJrqkJllfjBrCtymSCO2q8SNyDbj0aLIGdFY4gsh63IgoQzKN1dABWkZ8fXH76FDRXfi/dMF4U7YWoQiSZ9mIX3y0MD4cYpEhNiHn2wO/GtJBLYrHPhrnVc4fP5DyEMwTGK5WkydNkcmSKRweBLbnw5lwnNJArYL3mRFMTMO0ZIitwnB8FU+ZB2A4iFiyYAq821N2tu0wk4yErFepBvg5Yd5ePZGZxnw+kFAFLoABW+BASAlA2m8r5p7ygQQ6G9EAD41oUDZMYnzfve2nvMO5UJyb6J6JpKsO5lGZg/3HiiRciuAxoNGAwPIDLdROJ9oesetLtk/e9owJ2IcIZE22mM5ja2ghgzqAOkmHFrnO3oOn8j2H7BsNMFkF6Tk4Fye5BLZFgJJDIU4Lvpct5rXjPngY0jhnO9g87spLjcLwXQevfQX0QcvhuNIBlPGz4p2GahFy0oGV4/Wf1RW8iZk6XFIrE5uili05mP1KDhsHV7r/+qoEDZz04CmlDDQThHZoJLQpYrPGHBuVXAOTucXULm8HVq8Az73iOE0+V4AoEBCAqruMyBjX4FfdnHQBN+KJMzEaLitESmK7qKpKaAlCh/apIcWb1Ej70OuCn9UlvWvXqq6vOH5g9++jcVhTpEARVVaUp0DI9vWcB+D+XIvNC/hzBHmXcgrS2iilAgyh+p8dx6wSByO6G6MAHbz6YojmD1xl4CoxnizyXGTLxLpXdS+M/U6Et6jJTbFbo28OFhvXQOpu0JijsHHy/bMXgF0kcwLDaqlogyZC0aUxig+Deve+fyw3w1a6GEZ++DZe57yjyFjX0xjNYEOF1BrNfBGDPtVuhP1DPKoAEWAev75cBFLpquwIognCtyhyTNiV8gmbw3Pvu7sT6nl7Lgfv0MAR9DTW12S4EERRKLTrZkbm5u56DXG7YvJmF654HK7eLU15o6P0i0X0nGE1ARa5hyu8NAE0T50B/tWH8t5lWEpXeSe9+rVUBfPSZjxRzQCVF0QHmmGe1R2uOwpgRYRvg1X2nrxP6sGLaWYDgoNogKuS1QRC6M81fJ7vr7yE/NS+QOiAR5n8dRKaPaTDNG/HoBQS0ApNvfJO+6htgjm/jGUCzIS0rpTunqQS+Xsnr+99NpZ52iDGHd0k9KzlzdflbT96u4o4JIvkdKjnLNI628t1i+bCg0KCglnVApMJdDoe55TQPiJTLn+8xpTl17Z3EKCFY4+N7QYjg1JkAwrzybJ3pNxgkD4z+eQ4Y1VlgdcnLSwDYBXAKFAREB4BeSszO78rEQ6M0y7kK8OqqH6sr6QaG3JtIEplVZFIF0NKSo/SHcxMDYd3DUzc2b5b+5LPQGXi2ERFYrVy75iSahhlK//URYKiru0s0PN+TIcpKTQmqhVT2r0TxNUgwdkKlXg+mrxovFl3OR/3h1dxjPaWvdhYSW71yNuHOBgn/368qtLSKBrQNWRv8YLPbcyCjZz7LxQANx+16tcOp7/HF431rPwG6XYpXMUPQ0bHhDkTtycnYB+xZs6epLOXucHOAttLYqYfEK7WMiYr77umduftDCE9vHwBSxgY6hLCm15BCJqFUQSRglAFZQ3gEhx+6beiyZPgMgineOwFhLzDQnk21nl/4y6H/JnDmDKPtJr12BxePEpJoa2O/eI94CxLXTq2Z8E4U6FVPQh6NUBdYTs/cu/KSZxv9SgE4XVMNyIeFphBJKJklkLSuDv9Hj+7dw61uCes2uX4FTELd/AyO94K1A0EAsMnr1UNvtJa3+1/cjF/gU0CzTIZoBohSSd7Pu8kACkVx4cdmCFeAvmvQ28RJ6Bd3Hw9x+0JiZ69ene38B9XjDQaqSCHSlkkUtWkEHsbN7ZGH2zrk6zjnl0tSKsy4+d5O2L/fSsQEuxeKP2Fzo3XKTGmP8pi6P3Aw8inWJnxgTTYrn2e3WWeAvkjWoxWLVUaFQhE+Rh36ecOlFYfJGZruy20AZkI/5DXUAinVQEqSvzwd4NytR/b1Dq/LX7gayoTHNrITjjMYAaAVkQBqbkwTavHBXudDA9yCAtivT06mCWdFl16GrQehEaOYKwBlr7xHWizA9b1IPVLvBcjAnktmUgINGNKiFz7ymPWTRQ7I16l91r+dDzMANgJsHOxkDgD1pvpGmDyzadxHuo2lGGUsw19IHjlbMlIBnu8hg3pfvQItlei1nYrOR1OH+PV7RNYtMQMAfkkFpl15Zi/yBJFZEhUF/jr8GzKeg6x0BRwwrOlSvP0fR2jmvZ3N+4HjIOA4FmgEzWbJt8n4Fl80gvEgrOlOQGUFFG2KAi/xPrHEpHANryTc1V2FEfC4Z9GMQ+wUa8dixl7AhhHkyUGQEgWlw1AGNhjnTpRdc+ZAWJFhV+761CQiwZvDeMezA0AAaDSiiO3bI2zFyF4BWfaLfZ2X4EKqF3vE+taENhJEUgLMevN/Xe0rdSkvzkvNjPQfYDKkz169mocVpurFcnkwhJaQAlX6Brk78CiTHqfXN5vGeuDpmwOZTGEoG4+zCXY2C34eDdZEw0cfFUqigaYzyWC0F6FvkSPa17qGtndJXdMFLARtDMQqFAvfz8GNRLfkfelw+x+QdhbwmNbJGnv1tTozE6iDJBaftsPLTUppa3sOb38+5t573m/cXxkP8SubrU7x4OeUfuYrnEm7Mxo+3QS8w3r2ZBh9m4ACvJ6zb9Waa+iLtAHmGAhAbHLcdm0MXMt71T+WkQAjfgECe2ykpdcE11aRklkSlZmSnuaf9sk/xpGSyc3WiJoLvzu208KLOLmzQYT1uADw2rg0Gn0RaMw1LiQn8/W0RP/sNd0hdtpKbmXNKq+CkHqtVisOKEJqxuQ4aBGxL+PIydcbAEgHVk/j+uniujSooZaUqJTSYYA/e5hgVMmfazad212c8ClcYMix/zFQyEZ/oZB4p/+9TLFEq3WnE85HzumGbLjuqxlRsHjcuFvW1DWQ/HUbcbiMNgdUhhNDEXS5AeqX+WLAxFH/0FxYemjhq2PYu5pFWvePA9NzWgiNXFdFZjM5nTRoMcoyH51DHZHyx6/nehO9Fj6YccD/hkQi2t8gEnoMcPLKG63sLFLJ9J6QRxOPX8sgdVrTpyJrTh6kUsBzwAt96oV2cwDmAGIQd8XcdxzEcHoHwNK7T/ntqw/Yu5rkhwMoGG4IVNRWQSa0MCxdV8f/Yopxqz03Qb/zHekV/d4/7cUui0S4cqfVY9UXglaIxBncpbBuji9YSU2u8MVKXhSkrCEO3k1W0NY6XdslFrv+F4pMC4uk/3xwYMBpt5bt/+ApMLKQ1TBzZqfUC7mMIChNoSQzswWoDgJW9NxNSxoOGH7lAXBj2hJgI9eWIng5PmDOeBTIgF00QapozcDEkNQcnygSclwKKBDwdXY2Xi5GwtuK3kRVhNQU81X0P4MP4VUfC3CISGAvnD+bmFhPRUsoVIUSBcMMykfU7vi5V3H/oy+HCYNlRc2e7VwDDn9d1Stc4wEIOP4NvjI96D8rLj0DryQjEeGS7JvAw7wkWltb42jLAIw3VWYCKltV2oCiN00LtUUmYhNvDCiCZ3wF3XvZy6LZuWoMUEUmkYC0E+h3LnCE/gj/Zf3PkP6f/7Rc4wRIhnnDtVWEIjDPGT3aYbwYvSeA7wtaei0XPF4XifCqAXHqmj2tjNIiNqPvUphj6Coydz3YU/TyTDszjlQ/Grd69eppR51NXlCTXUtpbUpKSkpNnbyBgJp2T4XFe8CvGsFO/hMYmD6dYHjHch8gFAQ/n4HX20Oc3ds/ikbDe+uzuXMHSKQEuENrMCqS9TAOIAAwBmAOCMD0zwd7it/+MebZM5ZORvkjIO3p4QoYoJYgQhmWdjWtDvppwhakNhenLaSh+SuuLn+bRXZi6O0gmwUC2LnTp2b5wi2LgbqJxz71soIszwqv60YBXmv0LwHijPHRKtoq9YSzoajLDA5FG5wRUeToCFuGDEgDUofQGVzckEONvIrMyBDv9Eko67+5m3h4bE4x6V+5M9gx9ezINJbDTUmAkClLycaJ+NFwJXLeCM/64qM/A615rRnEiWAabHtIK+wH6K4PJAA8HVSd7lqtyvxs6jPK6i6qS4BnTxdeWb13/kmmOQ+QLklPBkMQpFAKdTqnk0P5FaIZ+qS0SJaRKjPFXADocUYIjX4I4lGr1aIdE3e3U68J9OLxmgREwDxQvgDGu6AYR5fCbAbckVGp4Izxy7Ai35Jbkc/szxg5SWryPSmQXUMQoaWZkIMyUMvu3UPBOzuFc4UXXF2XvD/vyVUYPZqAgGuHACe4GCZRo7Hu+z4diqGgFysCwzxfmh9uf7rHS7txP88V5P1vlUqLSmwTuhvd9YouZOHmiy+vql4KOPa/Eklqxuq954HD1dANVaEppAD+v4mA4vK8AdHpMLbHmS9HTFe+xM/OBAJfgADCUAGiXot9Oq1kGI0aGU1QS8GaVtc/+XoPBU0fVYLZ86ZDe2cnhCMzVtK8XrMYcDw0nCfhGWCiilaMuIeGQGRmKLBs2ZGw+Wt3PyAtIT9hujv3wVJ5AaZhacHP7Jdt1wugAa3INB4m8soachJyEZ2iqSQhs3VP31q0Nn+GCu121x6FQitTgdGZZzVxAM8O/fZB5Ft9z52upa6ihajQ0NKSyFDvZZOQnV3y/drdYzvOPub9ziSCPpRUfSh/o4IlzUsbYWv2AsFxlQQ1GrVFHfZtpPwMj+NURCUKVx3LI4EULy8vQMGeDJ2PHrFKhRAq9ZjDwXWnb67aPvAVdVob7K24p3G/Tk4QpERGRkaVYEM5Kf34iIRBa6E2YmAGOYxevdj+zmHhhKVsJQIBWiQStVoiYY69LBtBnjcp+2oBjsS1xqFlD4CDFvAUA0ZPrRZ6nrm1fTjE+pujI6CJFTM/FWc6WQJEZlIKRFY3NwQybXy/8kGQwdAW94nf/wyNACwZ3FsWICcEJ7DYW0MXv9mwzDCo/BWVy/XmCgAVuKSiX8n+NQV0u9xUab/qAvSKTk/3zkrAJiwg60nP3wlcBh6Bc0svUktKZkkUKaWl+4cum5SWTsB4D6B87HWYDtQd5cavfHtfGABbuSqAi0iQABNR17VeA7QwDo6BS2oyCmBPHC4ilacCvXRqLyjaZeiNxnIYov69OIulTC4FTgKt9BwmCIiiNDOSFvlBI/v3bwq+9utA7zzXclDU1ukHNjCaJRYYCI0giAcsWJCEHVv2z2gmsCcVb6rnUTsOyAZQJe9pBSP6cPR6mbsehV6BUMYs7oF8J4e4QmEbkJpH6XU6CQpNgcgSbCHBGNz9hbKak0uW/DsvNC9sem3kCACB5LAEOjqW+oETcDFMgsWC740Gwxw/1vRnXEIIIQmo8mpi44CX2GftHl8LCqOM8Er0ClBcMgmBo7TuG1tE5JO3gNV7hx0lEKOjvNnbFlVCaVQJcnyH7TznwQzm8+b6QV8yIU0yayo3fpVYBv4kukyjH4LjhIVJQAJN2JHytDoPlPjmHSG2sAC7L1zqw9GHd+qp1KMwojeCK72YHPjfE5p83kI+f/5ePBbN9IiWkZRUVQ3YSqLkaSzZGTQL4CRdn91ffOQb1v94F7DQIbJGAAjizRdRWbBcxMdEAo3rZ/Q/dgxSXJquL6aQQuDPFGs39ZXhikoterTh4TKQTe3979oPwTZErWZ9Gn8BpOYdvX2PdHlwcCgpUVFRAIGO0POwrAxwvZYIXTCAGyABRL0dS5kkIAAJGgtmeErez7yOi4eHL9Vr4AixsS8CQDegp1KhNVaqNusVnnpiH8R958VpuPgt6bhMPQngcIQ9GKAqMxOgZGWFAmPt/bsAS7a+yZEFqfm8C79i6QAYT2OywEyYRa2VSLTsiAyAn5UXgXl8pGvWLo4jjj1/fkam7IjLeH2l1jXc9b8y3B0wOXgSc4KJSOfa1K/whL9uMX9F6nnNPc5KwH6WhZQogE22c4lDoYzD88nr1fDpALi9RCgcDFboWIoAJGiwWEAD3YyGbh2WakQ6XAqIK0C7jDXSwm4U4So2F0rRC3s86ZEai+BzTi9aRJ6KMS5588VJC13jICGaIAgFSjNLSKnpJCNm4G4aAlgyoGHTDyOqLe/C/yp6e+/3WrEyZXiV4GeQqC0SCRIuGpmDDpdTJRJVERZSgYI1Cg5qYxkHFHdtFy4yKZAhFZoA3CAhISEh//6tX/BZNrB8+2G23SOHzExKKLGVQmaO8UjYLMpGRFP23bfjvl/hyzB0vAySgUIRx7HyjSChr29uQQ0/YVVCGTjzmSSJVmLZQ9cyCsn7zGj+Sq9ycG7XY2q/BLKuBXiddoZsfKXWFeMjE9Nwi/ZiDkm1KSlV1Sl2FBlkhOR2TCzm2R/1HDlwQPtyixPd3r8KzfbMXiTCCbQqjRokFg0aB6AXEFfHWKEmtrAgjpftBelPP8PVU6oXe0oBPRhlgwr+OJsAfF/1z29mZrn1In1U/IPzzIEbDGQCUZQQVbq/RbH71XMjO/Zrpq7vItVn6NW/cJvJ0F8RDt4YL1op7F0poC9IIFGHMQd0QFTb9UMofSikAMrtiT4+2i7gZq9er9ejQMbQf2p4CMljCf9n9JgxbumP7vm7L+K7lqDMEqCEKNg1tNabaZtVWza79d5567x1wTu4fz2dMiED7zfHY7X2YhXkEQYauxkmQCnMKeETmQwojo0thAJVMoD1luclKe6jQOGuUOjRGyPyxxzlXh7ZEL7i/lj1kvovLDzcMhFKo4CokpKoknUkVW2Suoxbove+8/6ci013/lf6acKwthm9QhByHKze/k5zkKC2d6Og6e5oegBfXCy6hKSE1IICiIuAWCxIMUIbnpeEJgcF4LhgNzjPnn+UEZyXwufCJQVsoWBDy651NojScZbmTro9n7b5DanOOHIqj4QJ0h2fDvX6qZle4DjHiWejoNGMBUnfcvjO4XEckGA8ijKJbq+4QqC8nMUJjNKHd8qyFJ7YaLehD6fwBKd7epwhdNXespxs3AZU/QTbAKqioihRKksA91CHsHa6/3jr8/Hg13A9kOYr3/DG0KEDBwP4NyAgQGuHAgDfXYO8BPL4aHxJN0cKYymkoCAiYjngDkag1+GWe/slKvWxC2YwRLXII3zsuFFzG0f21P5k6uwMPA8EZZZAFFHoWtINu6oCFtB4/+TkqrGs/PPHdkuqvXExlB0749nIDoFVFWb3gOTi6981NUEBecxLGD+e5d2tBS/aRrV5TJWpwGxs75zqIwNPvWfhoJPknZ92Ynee832sT/Ov04l7Hc3eZBIFJbrZKAF5KNcKbz7fVg9jwcsx/IkCb3iDd+29c5xESLCARUJYHKCcWAY6y6nEeeSTkbdmDXpFAVwfJzHeHdUm7IrtgnZoc6cXGpnd8w0iNC2Q8/tirvcZXGojClBCphTYNNt9IvDxKELxuHjq1NsTynzfgMNCRPtX7kcQ0Lcn+yQ8F/eAMhO4jks3cXEotMByEI6Cdn2AHr27UYFMIWToFufr+iMt+0LVQYH3zn8fYIJOZgJVUQ5ERaGDUnlNUvMtmDVLNusHqPdzvDKM7cwYCaMl9+/DfhCAxIJEIsEimfBYqQRuodPN4xRwBCigvBCIsjiAp8JdBdqsTlThSGXgMe78eUxg4yzObAsMhC3BkElVCqBERxLBhP7RyQfFG1b5+XGc4oS3N8OdOxUXLfQCIDBbAIsKCRY1j3nMGlEeRy1Nfc3nWAoioLwWGISD0dkdKiuhUKVHHwFDPO5/zNijcBTol4y7PUSWZNrXARvUYKtp3TD/lXE/A9M9tua+5A0Ws7Cjo9cbiP/VyWpnRiQSVK88fvzK44JeylLwjYbUDCm0epVTXgDVo6qHyzDJwlHoMXWiuOTOO9xTnS3mi5MmqMt7+MYvA/qqz1HUpoSgO3vWQRZYh0Nwd+RDHm2qa4xvp/XJXFTPJR3Qa8WfeJG3ACxoLBKJXTnbuViHJARIITb2cQ2xUICOqa6deiNUKtAqpAqFqUf4hBNnWcEqFtEpRevB7EOdjKNNmpKSEgRQUsJ0jC1t9xq2ojXcm0XdL+3380/CSMvghl5vf1Ezx71xyNFa/maFA7/xj9/kLbQpGVVIMUegkIhyIsrH6iwPerJU7jK9wh6l8OyFn//KU3WP4GgezL4u7TwZHuUVPO2T65GQkslsJQ42h+aknJbQhGlDp1/tGPjUvZOjc05iazf/5WyGXuFDjoNAzd/9JAs2IUSQoORhIbGwOA5QRdhP3wxyrlTEuoov6cNRKBRihDLnQY1z2DsDODobcHdGs4httCFNySwpUep0NjDQAo4pY17ryINO+PwZ6y50G/pG9BfZy+AWkFgsFtDo9oCQ60klQARHjhwpAFyJKC+G8XDpUhdtuKvC9einOjhgG7rl/MM+6aIK7JQeG7X3yLG+cBdlH6PtxeGDA3kJkfbaUjtU4WQB6MUKKwUaJEiQSCQW1GT0PO59he4oiC0vLITCwliACJeJynoJNptJq7A5u29WGN31bW1Gut9ZtGXZAZ/sR4vOanvmOtiecJstiEkBiFKiQ+yeA1VQtGjG7Z5YdwjP86SdOMICVl2Djf7x2OFosVgsSJCQtwfIdCl56LHYYABiCyjILod9vnB00C3wNLZPxUHf2alQIGuH7kAPbsHRo+7ui2Cmx8gj2y62SamFKFCiizQQCpvu/uR54MDw7Kvzfg6ClssXf1Pc9vZbLrTGN4h2IlAj+b/mYpxXL4Ve3XiUHEEeWwgFxL1COafLkIQ88AEHmQpnm8JTccnoeUkBwN5fFrHodCfcazU/3LLNo9+OIIL6FAsl8qTmYXiOXvPDDz/8QD61JxcxgCNhJ2Gr/dTvRnuJQ2LPa1leAFAYnacLQm6AxYspjPjbvpsOt7ARoL/pYCK8TchU4xxmLzo634WjR6FzNi0zt1RsSeg7DR5Fib1YZWgJpV9l9V9ubi/v0Ey2HZ0P74Ph9pT3EXp4CHci2GSxaEECFgvEAcTGlilZHCsHFxcofxwRQXEJSgng0G5SJY9iu3SzQirVy/h2EYvcMgB3d3c0mCuObQMzJlKgBB1KXUvatGFV1QGB+h3JTyu3HW494lmb8eTZJeDW1sBr11atKr0vQEKYxe4Ki7lvvt46DwoLIC8VIpKTgagSCLkZclPsoGi1TVXp29GDHjwewjCPxNZOngwZM5OMkWz7A6R9+hUdIe7uhIaaOz/nt49hLKExgOPzYQB+hw7BoQECkaVPw4OEPQlyYgvxVeqqcQC8CiN46SAsfwjg88Mo2rgE7u6gAE/eOXHmIdxDM6Rz0Wi5L9ItYGKYPZkqUaJU0rKyBS7uI+PzTzwT2r3Ce8xJZJy4mzKyAPCDLxCoJf+HhYA12JPIFJpiKYRCgKxk8mtByfTFPTc9wUHf2Ul4OO7t5Zx03nIb53bBiQe3YmIY6bCN26CvhZQSotChIxNI5I/U1NTU9jxaK7HtrX0yyef5tyFAo59fNgJAYgELaLUd/buRF1KY8DV5cTagrCyZ4UB1VII3mfXj7+Jg6kEMis2b9ULVr1C3jUXl227eTBhIUdHie1sYWXFxMXY46gBKSzPBgwwgNGE66a6rVxN+9Raw1b7qCwSbLH/rlfyh4nGLYymICMqDOGIplLiRDHDsYR66lMyfQlxtyLipUACe7QFDd8Zqk/Z9uOtGyHU5Q04CFbc5xo51tVI7P+rQ2WwlVQw3EhjITT7wCgvlZF0dUM1W8IPGSQLQ/B2n3iHBZTEF/8uPUgYRBwUMzM6+SzbUBuWBrg3a2009o4x6Y2+71F0VMrTG69QfnR81OUPcVE72odkcGURtqd0J4BCVCamMIePj/31CKLVJixFDCFuBrXyRLEDzgpxUJCq/w6WAjHElJfegEK3FksyfG5IhqBZAibunJ0Kc6ZS5X5JhdDUYLm/o5i5twHzwmvbe7ZF/UEpQUFWUEqW97lXK+xmsyOMCHzMA80Jn7J1x/GBrNgLUkr6ynxZ0taKOuL+5KFbFQVQvZWWX5xMEWD54AA6030TsGS5Er53zXwAXhsO9A5xktonqkbehDaDE/pGUuVVVIJMZjcRw4UIqgJhbf0PBHintTpAAyuuWl2IX+0TZtfBj15eyDmqHk2xvh1A9iLvSqVLPUT20q6RT3VWOBiCL4c654iFcmo8z0tuM7ERMZmYIoFMqlaGG2mFQnDBrVlHvW3k8KbNdWL4dbr/TVwElW2BnRvtCNJU8HfRKHDwMGocB+uQ9kohbEKSUfFRt8zGhB6HNUwzOnoUAjHLOpQ2mMh947zb8YXdBlD1H/tXkDVe/gC+uTkqDGYGbB73oMmxl61YaBXY0AjBBlQBoSfDoywg60KI6SEdyd21tbQn1IbccHC6JHWwODg49ev1UqZ1EehIBVswn5g3gyBZoq40iitlK0Olsw0ts5viOD/7gjyx91vSTZeakoQA00rgVaFwqAI3FYofjhMwtgse/lZOHxwurFLguuwvLg6ISUErafXqw2W463KRNphBDVxKwgU+BqVM5WfQqJrYtdocgOxKUgA5WX/SfPoY/jOdO8bI3NguBpxQ+zSylERqXIkCtfjHexH13ZMhZHgXLEcbycv2f2mUwHPLt+HKg0+bQrrKN6vE0GTGZjAA4OwOsZj5ucOw21ABRJTplnxWrdZ9FXyDhQPUswyqPoBkfpTGamrfvwlIaGyFS8LdwnHiCZYT9WfhdLTryDcwniy7Q0lF/MDq/JA8s3PKUthHe3tYpRdYmdSDnTFaWPje731+snn0SYNyoJaQCKaBEF6VUoqze9PBsv7wVAxm84RvC4Oo8+Ayq/Q6F4ufHofsvrmhM/PeB0qfnZWS/lpWAEhdhLzBey0GVFrIilpMAMAo83VVisVjfbsLYAz3D962HpDb2FqZy8jy7qCYjGDKJioISnQ5dqOenjCSh48ehtHKutjmIwEmmYL16qyHbAH5LB/d54cBtV3QNDWFgfQ3gt1lgFyvZqvobkB/0nd2ISw7OnthAAUJhLHfvrvo0kQTkl/IimD+zE6BfP3EfL+hAhw3+Pb3fmDErgNaBNEHQ1b93RB8vaDQwcd/oFRMHDZrDGiPNOkriDEAHySqSGU+H/cij5CYOU21T7ee+27klfcaGDRvu9jiBwQCwxX0aN98DMlNSSv7u8OnWEzQv6cdvo/GiNYjaSr22zb4jaaSRUoEIQLKiS7u8sbx84uuUzUNpn3By/d88qaW2ljxGTW3TO9BuG4XnJTE+rofst1f+Qoz9FSoYBZBSSxS6Phsabv1rXD3Tb/d7Ggs4B6UqPp80T8HWrVsBDh0SQIBawncrtGEBAQFnfP+hs+h05NnPeQ7EfkVnILlBQQQpQWGvtOBgA4cLwXeyto0Y7gxteXI5QOeL2m9QKFFKdEolSswXZnN21ZneNPdK/E6Wgn701bZ5t2lsbASWIrASZidHiUqligeL5NQUKJDb7zMezALoUJXX1lJbMkhvdLcJFQ42m629R/Hq+sJZw3UryQU5BwC3Ge6px45Ng+ZaqijRgc5Bie5i/PR//7vX1XFv1sP6496RtbUWJvUFKRqXslSwQ6PR9AUqldaM6H1BaqmOAvvkWQbUgzYCggCx0NnBQT9VipQ5J93lW8L4dPjBX9tg/skDB2oE9MtYMqrCflOmlLOg1Op0eDQC5Z7PFHzZOr05jcqqi6O1cQrsPpgwoY+aJGCxXBv7R9PyE13f5dGWABy0LOPgBuCNFYl9jN3TbrPZFPpLDvr3DwV/vuWTbGdn5794KIdLMW6RBEM1EOAdDDZdCco+yXDhX0xvx5MRiif/eTsola6pF3+rqfYDDjF4sECi0VhVfZEy7O6E13nwIMGOo2UAy7LBNtKF5UBUNQoH2k3Ybr5/qDy9KSHdKRecOAkrKHI0UUNfChkUEhqltEcp++9fOB5pf/9K2IsT3i/kAod4JrCosecQSFwmfqmm5x//SFU+7AY4yEHgIJBXnh9EECHO+h4HhYNn+/BDwQW/vypOT/shUYk4AZhKyPCSP/7Yxs1pbIrMjIp8MU7fzrzAiMuHPp2dm8bpk6GzCLPb8AWU4iSxIAoAi8Qiuay9DM6/seZ4yXVwOfi3uSufXlkOlJzB0+GmjV5clv0+f0kRgP2MHVxaAXUmtoWEACmZpGSCTvn/Tfmrz8vM3mW+C9OeuPW+++LPbBpxFFgkarUZQKLVotXCHuJIIEL44rGsGz8B+fn5+dy0tTOq10Eozvl2vtth2khPJzfRSWwvFyzZTsVt+41cyEQHOh26F4ux+qKzOu5QDulMT3/wghu3Avf/L0xhly079xVEqNC+0kvfZWvmzx9OPssBn15sNmccbiK6fnsUeb+ShhL6bBgSsthOTNSmUGpfAzs9TYfpe38ROubk2PjP+mH/uaC6+DdDT0CgsWhQo9FotCoI0yppLYQ8FWRv4OD/58h8SGiXiaVgw0f+Je+FxMznr8In5IITHGAqLIFqCEZOCSkqOxp1LObCvz/NgB9jv+2kKpWErxADIfLGxsbGpXsGC6yogT9UJ0AVJlGxxiW2HCiknL/90BE9bvny5cvzPPVccmiT0gscO8wKiB0wIBEQs+Lepb4jftRgCCUy09b3csMRYGyLYvTKoyv7H2HGiYFqpEwIxo+lLJ2wE8EOkBC3apcGrT2zpNVwJMGlgFj7falkODmwmFrID/Jkahvo2zppDBu5pPqAHfKJgKGAe8BNQiCsBxsQhfLFdjj7L4CGAVezaF4Q19FnWzIspbdhowA0Fs2EsH1yVBLJRa1TXDc8/q67gEIgC7I7TsKhIPLzAcUlRY8nngzdYrtNyEmAT+14iysacoDqUcBuVhIVRUlJX/ffn3r+vfvfjkfbe/utuvjGM1BhmsBcez9c6LFTsAm1BrYbTqBFG0b+uSNQns9jIg5mdXRkHVQNfOMNluYHjXMBySWb3tlB7OAZ8U4dgNhpAJD7F0DMPQgJghACUtYBUeh06GzAONjN7qDPjyyAd1cleQ3jKty1X+09BMMEaDRY/RZ880d+GCqN2S66jhz5ELKop2OZ1gKWIxDUDRabbv1U6OEMJ5YUDUlw+oEnzuD0F9yrJqYPC/ZifAlKOz829NXnPS2VSfN2kJNEAGBgK7B06bVr7wum/Ryxfd6CB7Y/lZssFis+tFYLz7U+BlV5OfX1L7m+dAMSDuXXwsSvexd1DOiZerdXtvPZwpNT8/oNUKN0S0x0GkdRSHU1EFJ0k02ZkZQ2OxClU75gx7V0PIhx3esdk3Ku+A31zNVHWuJ22AtVkXv5f3gxifc5j9E/AAAAAElFTkSuQmCC", "rRdaLjHppDXikG+v/znX3UuYWpLoADjlnyydu0yk/zPPPUjwq1NsYJrLuA+v0Fa6oiCnrDsvmUyfA1fnADa641rIT1T7pEf6qENSpifspjDswC25OzPt/zrCuJjVn0nG/1LQiWzBACOl/0HSrhaRoj/SmjaDX1zPqFBR40pgADHjvTVusI6Vryk3UVn4nzy1QDntMkvUaIbasAIj9V+MLk3rFUfmipLAkU5//z+tfHHYMT7prF1I/zKC72Jm+FSg/y2+0VvLqyR0qDRHdXvah4XYLjDhYXvemj2MnjmpoS6xlix2hVKc11+kvC0lOkH0kWGTLi3PpijDMT3guQiQMDfrrnSgxkm3OVHx1WTjqXlp/DxSl0uRCkDi8lSx/yie+XmW/0OXj4GptU+NgVuypizxW4rMuTuGfGPCAUXbxwBN1Vl8pUD3AEGjSkfxNDmijmOntSKIpELg0EGpvTake8f4arjZACa764SrPEDsqgcqTlH5VnPK/0i9pFL7PWHsJ1foAEbqqgU3nSeGrkV8ojnFkjxzC0rkpSrU+lR6tTB8wkGkT0zynGrF1VTfAEDkszGVrS9mTUz5TUj2ime1/S9mM0nFMjeyU1vfygIy/0nbsxTDqVNe8GquqEJh1XjDlVqbikaFACawpULrsAltWmTdpTn2nESoXW3gRkXzxTeYLjjlJS3nLkXowgEdgKTguQcxaHTOHzfmpUzzNjjrpyDobbS/nU23LjPXkmqfAUnkcKDyfXrmMjzSD1LkroW+NT/uFDrkjnq+qkpAirrUADnbNTyOnDKRMS+7qS9ZvRJBqT5wQ0DvfInyNUjtcX/O4UeHrGl7xTzGT0/2AU/nsQZKdXHEcpXfAC/IzUvKRU7zMDDHuz1bUVfspjPzuSOhUVP1kFeLvi2PmViqOzryqxwrgm3OACiS8z9ytCBjpUTzHVDnuBl5UWD5ul+wqh5KUnTwqmRctiKxX5e6Ikform9N/0DcnTqcqRU5cYff3oTZpTnwwjyzE1vomkKWuz+V"]}, "rose": {"144x168": [0, "data:image/png;base64,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"], "180x180": [0, "data:image/png;base64,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"], "200x228": [0, "data:image/png;base64,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"], "260x260": [0, "data:image/png;base64,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"]}, "sunburst": {"144x168": [1, "data:image/png;base64,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"], "180x180": [1, "data:image/png;base64,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"], "200x228": [1, "data:image/png;base64,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"], "260x260": [1, "data:image/png;base64,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KZPACFHCuMu9mZtbczaSaPKz1Nd5Nhet1KOzIL/a2O31QsUfgnBho6WWLYXePzSKnuKtNCvN6A3g5e1VjtfrctHK8VFvCLznSF9rJz58i9T1yKsnKAuFRbAt3lozs0aSuPx6BQRY/ThKMaN6tPIgbi76I5NgGELYMhm2+D2/drk3b61dzS4jcLXz8/vn6xLL8VGLGRUeEtutaYZlD59myAdeUK2zmpzB9F1KDSpaa/Uq5TKS5/X6/P55yerHRy0DwSryJxUdRKJgyxGoRy5nkNPHm5d7a+26ztOMuF6/fvn15Ty+flQzv67mHr/6tnOS4ffgtBm7ltUPXXvepNfl1w6X3P1q53m+ivH8/Pbts5UvX49ifl7NexXR40jP1v58/F359VjV/XZYjA1EUrgffl3n67MWvr7945dWvn49rJ1Xu67WvLnH58xAPuLUHgQ6C7ofE9zsoqXysbm/rtf37/Xb59//73X87ou113meAaF1BPenv/v8sv4wxP2VNz4DSWBo7t68Xefnt3/+/df/+eU3P9fz++frdV3XNSxxXx3Kuzjsv6qlviTwYzz9jUIO3lq7ztevf//fv/33v3399s9v31/n2a5RV+e1Hw+9b2o7C/djI/yLk/51bOberte3v/7vz3/526+vqzV59/l3j7r9vv2lszAbpNtf9sbhbGeO7VOpx09//Pk///QfP33EFuJfkantz3y4VctjOeaW6lx2jChEN6WUchxfvv72569/+dN//fFPf/jpy1GK0TC68ni0/FIL9nZmbY/FuRYenVWssYSo1+txHB9fvn6t3/725z/89Zff/+6nr1+OWTTMje29Ef6WoICQF16PjceBU+yaaq31qMfHR7XzH7/+9O/f/nl+/vKbL18+jlKtbN3XHcN7HNV4w3Ajfp3AxmBNLaWWWupxVDP//u318fvfn9/beX58fHwcR+m7W+Ot23KHwBsEPoy+HXeNTlKJUrmUUmstpL++f171t7/73l7erut1HMdRq5WtF/4wx93batmVfif/BsCKFSulViOh6/P1avb1p9+cfqq1j3bWetRayponMuSWBx/H5+xa2Nffjxttn26y2LaQhPw8z9P58fXrq+l096O266y1lmo3EFkZdzKmId6vzzwv1ZHU0mv563Wel7N+fP1+uV9y9+qtXaXGBFY6LcNTnwOJV3u7fAIwG4oWzZxi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"]}, "hammered": {"144x168": [1, "data:image/png;base64,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"], "180x180": [1, "data:image/png;base64,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"], "200x228": [1, "data:image/png;base64,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"], "260x260": [1, "data:image/png;base64,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"]}, "fume": {"144x168": [1, "data:image/png;base64,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"], "180x180": [1, "data:image/png;base64,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"], "200x228": [1, "data:image/png;base64,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"], "260x260": [1, "data:image/png;base64,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"]}, "enamel": {"144x168": [1, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABUCAAAAAAEki57AAAFiklEQVR42o2YSZbrOg5EI0DsvXaN+AM0JGXpZSk18LGTV4GGACj+jyDMzMyYd10gQECAIEjQdUXdoRAAOEFaXzSjXSABL5iQGHkzGAHAQdqyC0UjwYegC0MVRhAESHCaWZLWpQkEgcEgdUhSPDACFHIzW7bsUNXGAQdIkkxRHCrKrgIhvDFro0bSxQlJPDgpiAEBYfBErLV10dJJ6aLhmEIW2pwtBxDclq2VpBE1IKHNClNYiKKoZqQcAQjzZStBB6pB450QJcqCYoa8BJVdQLituWyttI5GEphYhSkAUxjVkLzLLgC+OT6aaOloScooJ4oAjMEHJGiAm5klZfkqn7MDJqmTJTJBAZhIBsBoNQiyTPPlCVrLVqVQGlbOCFoUCIABZGBAAMrZxfK1lvEAJQdhQFQ+AAAtMeVpAB3+5b7cfa1lCWLZE7kiSFoQ6mewAVF7/FDk7mtN7AUhqH5yLqlyAFBDOhSZJcZ92QkSFb3pVKVFBJS4kyS6TSIlx2qjZcw6MjKIpEgILA+XKJG0CX+lkU02ApKivW6iJUmJoQDCINK2ohK1Nz+Y6QgSgGSytI2iShQFNIWWPqqtRmPblopqc5qGQ4oalwMGiAaRbsziuNicDYIgg8qs/Ja6gkVaojzXrkUy63WGDYDCIp9mqtpLsn3NTs18jLmNCpJkln4SECwyVq2HnUItisqtZyK9DOJ5WW0qi128WZ2lAKOsNTl5QHD0tFo9PwEESOrpqFScbrFxHdoZmMWzAB+fSXbruQNx/+vP7z9XO/f5j3d8u7z/GwQ6Lo4gEdOpUf347QEPSV6boK78VAvri0ub6qdf0Iwcx7U5j2+nHd4GE4T3Rs+VQUnRZSRmcCix3cRfbPN5djB3KWonSFKEQhGn3WdIdEjytmJzKuAJilPWlyCA8BIUVMxumjKiiCjYBOKdQ9c2rQRpFzY1J7anzsCOdYS3oJgRzZQpgfTRaArptOyRAWMaSk4Ww67ZLenhqIevAcB3xFJONp4JQSmKDh10WXY4O6eoaYPaRVUTt3ik0rZwEx1Q2DQemWg4QYefnlsIT9OggCnKMNMJGlI56bMgeIU0atCnaQZaYU4JRwJob7gT55IQFhYWoIw6J2MdB44dtdesdElAWHAwNyitOwzb5uGsMK5gzkvBahpT+jWarirwvt28nhNsTrqaQh9C4q5KvXdvh8t3dgWneTyPMz9+ftZ1jaKapKodVee6DmoF3ZQLNoqy5G/QrtFT0Q7Oz04TPMg1mkTqBvXyTXnLRqWi5uSt3Rt75UlpzuVpSZ4nn43S2dj18vfLKWcH98ri8OyxF+KDA8mDko6Zp4ffB2ogr3rStGpjGXCip3s8muEnp0FBhQG3c3ai3J31k5PO3hPYxdJD1junQdmFVnrmMY499rnwxYk0LcAw1TRBvIvCx3DTpcH7fJpnMb5l7T8wALI3RDobDEMNWMd8+OynL5xqMSGXAsxD9JQPvI+Cb3K6ZckLU+eKx8B6rn0bHnI4mISsIbyOp++j4uu3asMiwgMAJQUs7GPY/BhDZ17phCxN2GeEvyE1ZOzL45wEbH/8Y7bec5g6s6+Rv8/Of2J6eBpVXj2wQfjrvNAPyk7eA9Qostgg+z84eyTIvN4+ypOQTEYZ/8TUSHAMPV52WeQAT5A1jf4D0/PAgNK0wy5QRopfZ6vjzV1s66QyLeXIciCx3XMvYTlIT92IQYUiwnXIkRGtZ95p8miWeLyr3R4Pj5TTDtLx0nfejh5vNvfMdIPkNfMNRv06czjEnkFqCIhTU94esBgQwTENPCw7B4Hne+gCKdoVp6cvywj9zktxJpNCjjoVsT1tff7Hl6K2bSeTlMesDpjsaRkfp229By4n/3qhVzm9X0m8KTpnwR04APgPmcxpfnHFKB8AAAAASUVORK5CYII="], "180x180": [1, "data:image/png;base64,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"], "200x228": [1, "data:image/png;base64,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"], "260x260": [1, "data:image/png;base64,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"]}, "textured": {"tile": [3, "data:image/png;base64,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"]}};
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
                // shadow (black, or sunburst's colour 3) -> main -> highlight
                var m = stops[0], hi = stops[1], sh = style === 3 ? stops[2] : [0, 0, 0];
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
        sunburst: ["Main colour", "Highlight colour", "Shadow colour"],
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

    // resetToDefaults: when the background has just been changed, start from its own colours
    var updatePictureColourItems = function(resetToDefaults) {
        var styleItem = config.getItemByMessageKey("BackgroundStyle");
        if (!styleItem) return;   // B&W watches have no pictures
        var info = BACKGROUND_STYLES[String(parseInt(styleItem.get(), 10))];
        var labels = info ? (PIC_LABELS[info.name] || PIC_LABELS.finish) : [];
        PIC_KEYS.forEach(function(key, i) {
            var item = config.getItemByMessageKey(key);
            if (!item) return;
            var show = i < labels.length;
            setVisible(item, show);
            if (!show) return;
            setItemLabel(item, labels[i]);
            if (resetToDefaults) {
                item.set(parseInt(info.defaults[i] || info.defaults[info.defaults.length - 1], 16));
            }
        });
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

        var bgStyle = config.getItemByMessageKey("BackgroundStyle");
        if (bgStyle) {
            bgStyle.on('change', function() { updatePictureColourItems(true); });
        }
        updatePictureColourItems(false);

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