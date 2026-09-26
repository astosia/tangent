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

    // Fills `box` with one row per item and shows it (or hides it if there are none).
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
    var WEATHER_KEYS = ["WeatherProv", "LocationQuery", "APIKEY_User", "UpSlider", "RefreshWeatherOnLaunch", "WeatherUnit", "ShowCurrent", "ShowForecast", "ShowAlert"];

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

    // The "Custom Colours" group (heading, preview and every colour picker) only shows when the
    // custom theme is picked. Colour watches use ThemeSelect and B&W watches BWThemeSelect; a
    // watch only ever has one of the two.
    var CUSTOM_COLOUR_IDS = ["CUSTOM_COLOURS_HEADING", "WATCH_PREVIEW_6"];
    var CUSTOM_COLOUR_KEYS = [
        "BackgroundColor1", "MinuteHandShadowColor", "MajorTickColor", "MinorTickColor",
        "HourDigitsColor", "MinutesHandColor", "SecondsHandColor", "MonthHandColor",
        "SubDialColor", "DateColor", "BatteryLineColor", "BTQTColor",
        "BWBackgroundColor1", "BWMinuteHandShadowColor", "BWMajorTickColor", "BWMinHandBatLineColor",
        "BWSecondsHandColor", "BWMonthHandColor", "BWSubDialColor", "BWHourDigitsColor",
        "BWDateColor", "BWBTQTColor"
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
    var TANGENT_WOFF2_B64 = "d09GMgABAAAAAA+UAA0AAAAAHxgAAA9CAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGxAcGgZgAIEsEQgKtBSnBAE2AiQDgwALgUIABCAFBgcgG+EWo6KMs6II/pmQDRnaG66arqyCYTopU5p2cXepXBfDl8bKK4/YGv8bIcnsFLlVDY6IMJAHEJQhmTeIcZWQgsIGlPWMCcW4Ud09N9dpvt1LObj7nzcHNyS3cqlkCEhFoBewz7rjSdzyH9jb8m7yS4qEZxeIevoD3fuZWCAGAUkAK+V6p1QqmNUKXngV8P9/c6X9KRG4CgNkfG2fv/zkzeyfZIGTnQOmOWC1ddUVEiUBy8raan6+wooTVlc3EbFW2h0Gr85rlAF8GJ6Tz+ihzgcwACCAkU0m+KIsHJjPj+8vePWZsBExeySC1EgGALt/T1MQwF+xRBweOxZBiRA4MMED2Z9vT2oC/02oXa2foUIwrbAqwP5cbAAiscCnlkDMZWF+Z0OmSIS5EOx49nSrlAmLqFKvTZeYPgNeswj+u7wM6dpceTTbV2vUoWfWZ+BI4X7/J/+TD//9z3/6w+9/99vf/OrebZyC8VaCWacZW6l9Bi9NSvqbQEiDAcfSEmE+BmJ/8VMmwDZ2Ari7ehy2RwRcpILsktyb8AEQtlw1/1VJVfSbv6EQAQ/h8TAMQTCZUFgIMbKEJCobppIEEIRPJCSTefhkmMCHIZiIo5Hxj5dh4OmEFXgygUknEiD+9WzUJCaLB9MhiAjxGTCJSKVIWckkBoRPxidC75AEVENsEZ4K8eBdCsFJMPRGSVdNEkymwniogyQEFUJMHI6cyIbISWQZbxNPqrqJWWOp4roGSsJKefLSrHvfO8s+VDFpzwuUz7IB7/D56beLwKKgf22CCgqtkLQ4pGclk6Q1nPU0w1FOQHgAAwRpohMyCHYhzNwkpOPudxMtt6hjznpK+rF4nrB4RkTuedcOB3VQXZNz385d2rcPUT0kDcDAP+UNYgFNHk/Y/Xj36d27Exo6QHLZJHeQojO67MdDbjyhziUdY+1AeGVXuyYFQjYxVScssMPY5hCwyC65D2TXhUTUvV0Vk3bBXLKJqRQXWVUqn0BFKNXAdzcJ6dK6UPyxiBTQ/d795YeqOWvKicjrSn0eJJ0njWrv3pOkT+8GZ2Vs9RAB6zxsHgGeJ412YIY4WtIDjAoeWfzQAfnk0RrO/Wr1wytg1Fkii8251JbqUanhYsqXFGTzQuhGPQREnKXBCZuOuGpOcPSoWVCntC6QxZ8xIVBOQP3Oi/F+77FGw8Kd0SjXJosTFtusp+dWeIINuuyEpBEr3a3KcDKAySk1RSVZQj4CcSBX+MFBZ4zRZnFVNThhldV0yBTSh7ZNSJ63SBTAadJfMUaqMi9k489FAcV+jbAp3YvSghrdE1R7e52Nv7MOIqocc6gQwp5nomEfSbTAoGUbITe2ERJ7BH4Th1VXc/Sz4/fMKPqVPvzD8wM/E1NX4jeqMI7b7S9KZiZNjKSecFII9r/sAMaC4MwsV9TRMqC9Ma+O6tqld/eG6yNO62U+ymo+Fh8DtSH7IoZjhWc8SlSty5cEvuX2Rc64IBJ6s9MjAYgerQgxUsiusFNGNgMlFNPXUcRmoGr9fwgMIVMORHWJgOxrIvr4sho8YvMELt/sEnJ5Skksp+B1E5f3wDM2Hc+kECCdJ/Ae8OtNAjHFU8+J08Y64FkeHVzTM+WfSfcTsGhqkdUnlnNPxs1yvrP50ltn+4Z7etZGTc9c6QWokAI11vMyZiiWQvn0oW2U9EKpzLuTwNrMpM6tx0RnzRY/k05QKf/XcWkoDj2DqgAMET7CIxF8huxSkvvejBf5e8Wke+A5NhEbygCy7ArPMvJef0T1yXwYk34K7yl1kN/bo610KXvnB3gZXH3sIm+JCt5ZzE19eVdripdBtif/d24/EpIae3F8jINtZxrhFx5zGcLkgKH80FiSd/SqHrK8IFYr7R69e7HXGNX9q7dyfWscQb+WdBX2zpAFhnm86qLYyQOZeSuzV9RiYWqL//xVEBAVl5unQnnYePGQaYLceJbdU4FNLjzduZWT6x0OZ72u2am/kpyb7JW3ljeaGzjzXpP5U+nqCtP6Yc7m9nu2NWk/P7qNJJXT8f50w2Vd9XUnto6l/9l6s2rU2t9uA+ASzeByG2h6t6tWy2Dns3fj3M8U3CdR+czZMLCgz6Ut1OpeZwKky9pDX5V+9bj2cfP44HQymoTQ0cyN/sFi8MGOD2QfgGasL+4DhOfuGJ2BuU1GC8HLBI/q7gulQkGe6L4oT7DeKBhF2iTwZ7Cs+h5Mi6y2lv1S5mSTs7Z2raW+KEzmK+w/wunt6fCPFrt93IbD/KokzVy4bembE05tGR3bXwFBx+sGZ597zadeZSwo84f9SoWfDEvaJSSyzeJ9zOy1R7PkeFxz7jtaR9hidoU15C50jjqShUf5gqPg139iOGIv5/evGiRw+CtNVeStsBiWRCSwOAyDS88uCQkCrojsGeSXS+G50/DONLnHoVkyWX1Wi91vpJDS29JhimhZuQz42Yc6p3+fxadnkiStEpgpuMhP46MLpHsihcmlX9I5KyxmV8Wi9iH3jCA1O+WhT4VeAftLSZIOCfzm3P2XYWl5gd59wFgCiive1NsDVosjoH8zN1N7SxWNLOAWItHVpzO15f9+l39XeZf/ruiy+jL8WgOLtcNGZ4fkaQ2iDHkxuDCNF5OVFyV49CyaWnZ456ihdx/e4Aiarc5y/QOdM2A1uIJaGpzemg7TBJQ0PgqauT6fb5/P7wMRJMTctpe5rRzvQ+ugwJrhnAyYPQFOQ8+JXhCquRrBcwm218UvSTR5arXKNIvO2rVq80HbvBG2fTIKju5/xvuUUa8zz44Kd8xOjO3yTgjnhWqVUKUWvAxOz5OVKsWjCpXSNIlO2hwmDXkM8BA8irU9y+m2due8DFqQtSje9nJqj7UHKCnkf30a2j8m1DqNtv3jE54JlVatEvIFqWrzu1bDQaBBwh0DHWE0XD1QHQb9CD8bSLcaxTLVfGh+/IAYxJDa58fGQ2go9GRF9L1GlV9q7eGXwbeI/2oH5nSd1VVjxZzuuOpD+x5prWkdAGEk9IwJ9Fw46UQb95tB0yLOBYj7RWN5Y+fjLo6KlENKkWoILKHbJHk5SprKsfOLEDoZcBusW2xyJb8KyJJkk4XF07nt5B6kfQZkeASXrcrVvJDywqQUxbcTQKKiRcH+SrK0IYweCHo0joMVprT0x0qIk7nYlWWZsmwl+NfuDvFLokDU85PupazY1kmXTqXf5x/TK1RlPdmB8ai7ZupGfqfWqHFNbn0huGAaAh8iob8abXm2JnBi/6HQobHJqTE9CqBSKcFxJJa0BV2H7FP+aaG94rgaAu8jTZkMnmxD/hytsxn3J7qhcBvzIvt82Wi4aI6+KBDmezaAViSaYlOf7epSn05xrHv0hVhnRPYpbT3Vr/hufbwd/ImEa0bf21D6nmA3ukP5cfmj74FCZLXl712/mDK1f+z7E5iaKwsqAYNiUTM+ktVHKkTGL4ZfX7elqJhfzxsyD8eGR2LPFdocf2sZMzK1tCQX/Dawm72K9whvgFfDWxVVG1KY+2317TvL9CWyb457wJc1e4tLCor31p/catsa3zwUjynUSsXmgS/efru4oAS0IW6+RC7xyXLlEmZpOyttRuj1yr3gT6T6aU1Jgay6o95wg84z9HZus7xfyjbzimSl/2xhS9MC7Ai3JlUKxIjnCjeYshK550E9Z2QK6VdloPNDT597Z2EPUCChLYVFLtT1/ZaE4AQRtCPxmcD7FM8Sh8lKZz6wtyVhSaAH3rBBRsMp1ScgdagFiLFNrnKDKaug/0XDehm9xCD9uxSQhgb6tmv1CtlAmV6h3f5xXy9vhzLOi/N6UUEfWIz1p/bwpIt7F6UF7Z97jxpktC3W+vYdMtEaxVOgkeIN6yXsz+XUzfZnuKvF4JNeA/KjnmKXXaw+J1Eq1MUa8zZl1BJlnWMXSU3IN9qL5sKHzwuyNGu0hYbhtqi1knWWUwi+NpY8yVMvy18Uy8WfeD7xyr0vpl/IIII3yJ76sCePSn2S1Fsmc4JGcrToc/nnVYawbeUR3RGX7EjJERsAcd2XvJwXzQ32QPZN5s+sz/OwzpYq2LBeRwabSzQfasD/9Tss+i6racxi6trFCwXLQysv5ARBhJthjkk87pyfrT0OiTtu3zxbf7rzcde6nkiPfXh2A7jblCv9eFE2vZIXQrk5E7L3c9IeBmUwaIIfp3SUlp7I2f/ZVm/c+1qfJ+6R+gyvfyd6v2VaJJ5p+eDYSr1hZa5BD44juO3bkOWdtdqe48SssZyXEkeImT4COLrnGe8zRp3GMjsqHJ+dGJvwTgjnhGplPvxYuktkDoEEMwRGfXkG4HNxKLA+m9Jt685+2X3PNT9bBzjcJBSDWhy/59wym8fFjXvOI8HF+hA0HpqNAF4KXoAt2dwyeu2NSZ6457U+b9wLNnNDaOiEn0Xnv/MfcG6ZrQf93DAaHpKEUBuq2p8SFoR9q+rWq544x/PIVEeaNW3jlLVMn65ilKxUKTlGqzHHnhqEU0LPGEHP+TL5eTiTsulVvAqUmzshez83rRzlZgF4Wqh1GG1T48LxKZvDeFgjVA4pheohoINcc3O1IBlbrbMbbNPbTdvshkXtjtgvIefWuTpANMQodQB3nBqti0Vi9qG5Dek9mGoHHY/JY3m8ivRDxQizqOJiagAw459hSno/JbISjS+rvVWr07iVK57k2qL8+d5vfluhGqx8PvbtpRwVODV9MHxwfGp6XJ9TrVKCAsg5P1cLjsE9eXNMiFnlOUEQik5OtYorKciSqUOhQ7rWiRmFcUz6JzfbJpD/OC7E378tvGlwarZoHbu+DKGhCc2ze24afVavNsLbJIxrJALn5o3MCEW+hCdC8Ozvq0f1vw9x6u+3Pn5sa05Rwj0A8LDMTaDHci2AfUFwChHq26LKo0aPg3Sv0f8Lq/fj+fbJ9uJVh2gepyb4qiQVA1eL1AZ7Lvny3cKSawSzNG3bUtVoeZGmNejlA2YZZ2EUsSb/nJ4jcuWDBpDRRZfh2upRVU9Wov0+eQNqfviKlm9Xg1Lnlo52J3XtgqZdy90tMu6MNXQuB1KFgOL35Qegu7FhOkScCd0cYccko66ZEpCzYzgKuEkBga163vLtftyVtplvQJsTyY3uP+X9XXDtSYqXj8oD9AqWz8gHDK/tpINgz+0YuZ880kG3KGqdCAKFdsc1/kl1VLMaqZrdcxHdkjVoiVlbqVDiYTHeluIkONjyXgUAAA==";
    var WEATHER_ICONS_WOFF2_B64 = "d09GMgABAAAAAAUAAAwAAAAAChQAAASyAAEZmQAAAAAAAAAAAAAAAAAAAAAAAAAAGhYGYABEEQgKjziNMgE2AiQDGAsOAAQgBQYHIBsrCCDG58Hz/ZvWSfGstI8e1c1tJyD5fCfdXGjy9wA+J+0AdF/q/F9OuyhcC9u2SAJPZO2BCyzrBbYtWvatw3tRujngMLoXSMRnAabW2xhbtQyNKFqtNS8GAoAKgrgIBAhIy2J5R2Lt1S+RFktqAbgqW1SLqgkAKQg9Yw9zL7QNqAMfZHf/vwsoLonqABCgQAo+OGUxgAjBSiSSBIURBRTmgYA68EXgQzDYcO9Wan/VLtdGTxYiQBjkoAUAyCCVdDogugiIHRDskuBIJEQI5FBKJBptaAilVmlD1BPiVDyaGaMt1jituiEOp5ZoF41WK1VyNmc/RVkamQaS5JomKQjm/d21YDIH8KZ9S+xlS5ZxL04Xl61jTmLvPiUKggDm+ZU+n5kRVvkJ1gcpfhHbjIBGgGngmoglhMKQHYvmSTGZDf2qTfkUfOPSHpI7f9+H04zY7je/nEGwZyjLKUB4LAhGQRAiAeYkycX5yIs8fzNiYE+2zyQDwzhJck8ET3Kmfd9tcrk9wxHVl1nOgW91irK02X8gLk7OD7AeLanWvgEXD2JDxNF9uzaZ/RRlMTb7zcIOX/4LFfdowFnfh57mrGuxPx0kgBnAkyzJgQVjo1jKYvYviIoyJm7ADn1bpG0hI1jyG5iaTCwhZc9zZyFhwffhlyzMdy1+dJX1m5Vs/5iEleyZl+SKh7JA1aSzE8rNWyMomIgMfg8x6KHJaNTlkJzdh6E9kGG5I6TGFAZ/t4Oz1gmxft+xjDu01CChhSOMhadoi9exUK8roPVeh6NtcbtiDtLXtAVB6cccXodel6bTL2qtnPa4zQYkmJm1A61Wc+1MuzUYtObCH2YLHrR579yrvHfP67532+u5ezv0gl/XQacv0fH6ToZOesi73aGN3Y30HbqtoW2GMIievzBDX+NxeLq7Pn1yOBYfzpzv8B5L13WiM10ex7X0jJ8DnQ0eV/otenz3cfQtGqJg5Lhngz/L2pIUVZB6NTHpVmqBV6bte/Wz1Vxln3bDh/nSV0BJJVxMKr671LJh9LTsdnmbcDc+I23OnFExYQqFSh4+dOLp14YTfYY5t/UZlnbjza5IRQyRGBuZ0Cdd2baXZmp/Y8ccsTh0bvzAYVPLNQklK1avEQVm6BceLpblNG7e/uj4lMpRyqOOVRe/7TtOJqNKDh6Z37lmQtK8v/9bdWbZoQXIjWoR7TiGG7E9VuvGL8d1m+29d9vtmTpt2oxJiIuOxGfURwpRY1f0WN5tw//2meZaq7V24BRMm5T3XypWy2sWp3com+3ZfG/rllnjOhmi2kZB/Z4c3+eA8EyQHSO7dzBgesOpVf6JDGG3b4pMj2W0yZgOv5Brt6GsZtmbmb3SmO9/ZNgfWEiGBAVgyZsa69q//lpr3cBE1/11fIOtoenj9wnrx47fMzD/we8xi0u7dCgv7dqhdHHMizpz/ujd6I7qVwj7AQX6jd0vAOcardaSHdUaQiqMUte4fl5qdtdY1/xhPXqP0Lb8TZGsAAA0/hm4DAAv7m/vD/xvU05SUAAUEA18jeLSf8WAcjEAKCeBALXLRO/QUXH37twDQm6FrDNHORPgyvATyJEEgCODGMqC36AKAAA=";
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
        aplite:  { w: 144, h: 168, round: false, bw: true,  geom: "bw",      aplite: true },
        basalt:  { w: 144, h: 168, round: false, bw: false, geom: "default" },
        chalk:   { w: 180, h: 180, round: true,  bw: false, geom: "round" },
        diorite: { w: 144, h: 168, round: false, bw: true,  geom: "bw" },
        emery:   { w: 200, h: 228, round: false, bw: false, geom: "emery",   weather: true },
        flint:   { w: 144, h: 168, round: false, bw: true,  geom: "bw" },
        gabbro:  { w: 260, h: 260, round: true,  bw: false, geom: "gabbro",  weather: true }
    };

    // Generated from the UIConfig blocks in nomos.c. Rects are [x, y, w, h].
    var PREVIEW_GEOMETRY = {
        emery: { DateBottomYPosition: 60, yOffset: -8, yOffsetFctx: 3, yWeekdayDateOffset: 27, BatteryYOffset: 53, BatteryLineYOffset: 78, font_size_digits: 40, digit_inset: 14, font_size_battery: 20, font_size_date: 28, battery_pos_z: 0, battery_pos_y: 6, battery_line: 63, analogue_hand_a: 1, analogue_hand_c: 1, hands_shadow: 2, corner_radius_minutehand: 20, corner_radius_hourhand: 10, corner_radius_majortickrect: 20, corner_radius_minortickrect: 20, majortickrect_w: 94, majortickrect_h: 108, minortickrect_w: 96, minortickrect_h: 110, outertickinset: 6, innertickinset: 12, majorticklength: 6, majorticklengthinner: 30, tick_inset_outer: -10, tick_inset_inner: 30, HourCentreOuterRadius: 7, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 5, SecondHandCentreInnerRadius: 2, hour_hand_p2x: 50, hour_hand_p2y: 50, min_hand_p2x: 12, min_hand_p2y: 12, second_hand_a: 26, second_hand_b: 0, seconds_circle_radius: 28, seconds_circle_centre_x: 100, seconds_circle_centre_y: 154, romanadjust: 2, BTIconRect: [53, 21, 44, 20], QTIconRect: [106, 20, 44, 20], IconNowRect: [0, 48, 98, 22], IconNowRect2: [0, 52, 98, 22], RainIconRect: [48, 81, 40, 22], WarningIconRect: [132, 83, 40, 22] },
        gabbro: { DateBottomYPosition: 67, yOffset: -8, yOffsetFctx: 3, yWeekdayDateOffset: 29, BatteryYOffset: 64, BatteryLineYOffset: 87, font_size_digits: 48, digit_inset: 31, font_size_battery: 20, font_size_date: 32, battery_pos_z: -2, battery_pos_y: 4, battery_line: 63, analogue_hand_a: 11, analogue_hand_c: 1, hands_shadow: 2, corner_radius_minutehand: 0, corner_radius_hourhand: 0, corner_radius_majortickrect: 0, corner_radius_minortickrect: 0, majortickrect_w: 0, majortickrect_h: 0, minortickrect_w: 0, minortickrect_h: 0, outertickinset: 6, innertickinset: 12, majorticklength: 6, majorticklengthinner: 36, tick_inset_outer: 0, tick_inset_inner: 0, HourCentreOuterRadius: 9, HourCentreInnerRadius: 3, SecondHandCentreOuterRadius: 5, SecondHandCentreInnerRadius: 2, hour_hand_p2x: 0, hour_hand_p2y: 0, min_hand_p2x: 0, min_hand_p2y: 0, second_hand_a: 29, second_hand_b: 0, seconds_circle_radius: 31, seconds_circle_centre_x: 130, seconds_circle_centre_y: 175, romanadjust: 0, BTIconRect: [78, 23, 44, 20], QTIconRect: [140, 22, 44, 20], IconNowRect: [0, 60, 128, 22], IconNowRect2: [0, 64, 128, 22], RainIconRect: [75, 90, 40, 22], WarningIconRect: [165, 91, 40, 22] },
        bw: { DateBottomYPosition: 40, yOffset: -7, yOffsetFctx: 2, yWeekdayDateOffset: 16, BatteryYOffset: 36, BatteryLineYOffset: 55, font_size_digits: 30, digit_inset: 10, font_size_battery: 16, font_size_date: 20, battery_pos_z: 0, battery_pos_y: 4, battery_line: 51, analogue_hand_a: 1, analogue_hand_c: 1, hands_shadow: 1, corner_radius_minutehand: 15, corner_radius_hourhand: 6, corner_radius_majortickrect: 15, corner_radius_minortickrect: 15, majortickrect_w: 70, majortickrect_h: 80, minortickrect_w: 70, minortickrect_h: 80, outertickinset: 6, innertickinset: 10, majorticklength: 6, majorticklengthinner: 14, tick_inset_outer: -10, tick_inset_inner: 20, HourCentreOuterRadius: 6, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 4, SecondHandCentreInnerRadius: 1, hour_hand_p2x: 36, hour_hand_p2y: 36, min_hand_p2x: 8, min_hand_p2y: 8, second_hand_a: 17, second_hand_b: 0, seconds_circle_radius: 18, seconds_circle_centre_x: 72, seconds_circle_centre_y: 114, romanadjust: 1, BTIconRect: [36, 16, 36, 20], QTIconRect: [75, 16, 36, 20] },
        round: { DateBottomYPosition: 48, yOffset: -7, yOffsetFctx: 2, yWeekdayDateOffset: 21, BatteryYOffset: 36, BatteryLineYOffset: 55, font_size_digits: 32, digit_inset: 23, font_size_battery: 16, font_size_date: 22, battery_pos_z: 0, battery_pos_y: 4, battery_line: 51, analogue_hand_a: 10, analogue_hand_c: 0, hands_shadow: 2, corner_radius_minutehand: 0, corner_radius_hourhand: 0, corner_radius_majortickrect: 0, corner_radius_minortickrect: 0, majortickrect_w: 0, majortickrect_h: 0, minortickrect_w: 0, minortickrect_h: 0, outertickinset: 6, innertickinset: 11, majorticklength: 6, majorticklengthinner: 22, tick_inset_outer: 0, tick_inset_inner: 0, HourCentreOuterRadius: 6, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 4, SecondHandCentreInnerRadius: 1, hour_hand_p2x: 0, hour_hand_p2y: 0, min_hand_p2x: 0, min_hand_p2y: 0, second_hand_a: 20, second_hand_b: 0, seconds_circle_radius: 21, seconds_circle_centre_x: 90, seconds_circle_centre_y: 121, romanadjust: 0, BTIconRect: [54, 17, 32, 20], QTIconRect: [97, 16, 32, 20] },
        default: { DateBottomYPosition: 40, yOffset: -7, yOffsetFctx: 2, yWeekdayDateOffset: 16, BatteryYOffset: 36, BatteryLineYOffset: 55, font_size_digits: 28, digit_inset: 10, font_size_battery: 16, font_size_date: 20, battery_pos_z: 0, battery_pos_y: 4, battery_line: 51, analogue_hand_a: 1, analogue_hand_c: 1, hands_shadow: 2, corner_radius_minutehand: 15, corner_radius_hourhand: 6, corner_radius_majortickrect: 15, corner_radius_minortickrect: 15, majortickrect_w: 70, majortickrect_h: 80, minortickrect_w: 70, minortickrect_h: 80, outertickinset: 6, innertickinset: 10, majorticklength: 6, majorticklengthinner: 14, tick_inset_outer: -10, tick_inset_inner: 20, HourCentreOuterRadius: 6, HourCentreInnerRadius: 2, SecondHandCentreOuterRadius: 4, SecondHandCentreInnerRadius: 1, hour_hand_p2x: 36, hour_hand_p2y: 36, min_hand_p2x: 8, min_hand_p2y: 8, second_hand_a: 16, second_hand_b: 0, seconds_circle_radius: 18, seconds_circle_centre_x: 72, seconds_circle_centre_y: 114, romanadjust: 1, BTIconRect: [36, 16, 36, 20], QTIconRect: [75, 16, 36, 20] }
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
                    minorTick: fg, majorTick: fg, hourDigits: fg, date: fg,
                    hands: fg, seconds: fg, month: fg, batteryLine: fg, btqt: fg
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
                    hands: handsColour,
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
                    minorTick: theme.minor, majorTick: theme.text, hourDigits: theme.text, date: theme.text,
                    hands: theme.hands, seconds: theme.accent, month: theme.accent,
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
                    hands: getColourVal("MinutesHandColor", "#FF5500"),
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
            c: resolvePreviewColours(screen.bw)
        };
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
        var boxText = function(text, x, y, px, colour) {
            ctx.save();
            ctx.font = px + "px " + PREVIEW_TEXT_FAMILY;
            ctx.fillStyle = colour;
            ctx.textAlign = 'center';
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
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, w, h);

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

                // Aplite skips the inner ticks at 12 and 6 (it draws those digits instead);
                // everything else draws them at the odd hours.
                if (m.aplite ? (i % 6 === 0) : (i % 2 === 0)) continue;
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

        if (m.aplite) {
            // Aplite only draws 12 (and 6 if the date is off), using a plain bitmap-style font
            boxText(m.roman ? "XII" : "12", 1 + idiv(w, 2), 6, 30, c.hourDigits);
            if (!m.enableDate) {
                boxText(m.roman ? "VI" : "6", 1 + idiv(w, 2), h - 28 - 11, 30, c.hourDigits);
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
                boxText(dateText, idiv(w, 2), g.DateBottomYPosition + g.yOffset + g.yWeekdayDateOffset + 88, 18, c.date);
            } else {
                fctxText(dateText, idiv(w, 2), h - g.DateBottomYPosition + g.yOffset + g.yOffsetFctx + g.yWeekdayDateOffset,
                         g.font_size_date, c.date, 'center', 'top', 0);
            }
        }

        // Weather's current-icon-and-temperature replaces the battery value (nomos.c draws the
        // battery value whenever weather is off, or weather is on but "Show Current" is off)
        if (m.enableBattery && !(m.useWeather && m.showCurrent)) {
            if (m.aplite) {
                boxText(String(batteryLevel), idiv(w, 2), g.BatteryYOffset + (m.enableBatteryLine ? 0 : 4), 16, c.date);
            } else {
                fctxText(String(batteryLevel),
                         m.enableBatteryLine ? cx + 1 : cx,
                         g.BatteryYOffset + g.yOffsetFctx + (m.enableBatteryLine ? g.battery_pos_z : g.battery_pos_y),
                         g.font_size_battery, c.date, 'center', 'top', 0);
            }
        }

        // ---- Weather (emery / gabbro): sample values ----
        // Sample alert state: a rain warning and the most severe WBGT (heat stress) level, so
        // both alert icons are visible together for the user to check their colours against.
        var SAMPLE_RAIN_SOON = true;
        var SAMPLE_WBGT_LEVEL = 3; // 0 = none, 1 = yellow, 2 = red, 3 = black

        if (m.useWeather) {
            var weatherIcon = function(glyph, size, rect, align) {
                ctx.save();
                ctx.font = size + "px '" + PREVIEW_FONT_WEATHER + "', sans-serif";
                ctx.fillStyle = c.date;
                ctx.textAlign = align;
                ctx.textBaseline = 'alphabetic';
                var x = align === 'right' ? rect[0] + rect[2] : rect[0];
                ctx.fillText(glyph, x, rect[1] + PREVIEW_WEATHER_ASCENT * size);
                ctx.restore();
            };

            if (m.showCurrent) {
                // Clear-sky glyph (weather icon 101), right-aligned in the icon rect
                var iconRect = m.enableBatteryLine ? g.IconNowRect : g.IconNowRect2;
                weatherIcon("\uF00D", 20, iconRect, 'right');

                var tempY = g.BatteryYOffset + g.yOffsetFctx + (m.enableBatteryLine ? g.battery_pos_z : g.battery_pos_y) - 3;
                var tempText = previewTemp(PREVIEW_WEATHER_C.temp, m.fahrenheit) + "\u00B0";
                fctxText(tempText, cx + 2, tempY, g.font_size_battery + 6, c.date, 'left', 'top', 0);
            }

            if (m.showAlert) {
                if (SAMPLE_RAIN_SOON) {
                    // "Rain in the next hour" glyph
                    weatherIcon("\uF084", 20, g.RainIconRect, 'left');
                }
                if (SAMPLE_WBGT_LEVEL > 0) {
                    // One glyph per severity: F0EC (yellow), F0ED (red), F0EE (black, level 3+)
                    var warnGlyph = SAMPLE_WBGT_LEVEL === 1 ? "\uF0EC" : SAMPLE_WBGT_LEVEL === 2 ? "\uF0ED" : "\uF0EE";
                    weatherIcon(warnGlyph, 20, g.WarningIconRect, 'left');
                }
            }

            if (m.showForecast) {
                var foreText = previewTemp(PREVIEW_WEATHER_C.high, m.fahrenheit) + " | " +
                               previewTemp(PREVIEW_WEATHER_C.low, m.fahrenheit) + "\u00B0";
                fctxText(foreText, cx + 1, g.BatteryYOffset + g.yOffsetFctx + g.battery_pos_z + 28,
                         g.font_size_battery + 2, c.date, 'center', 'top', 0);
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

            line(p1, p2, m.hourThickness, handColour, 'round');
            disc(p1, m.backSize, handColour);
            disc(origin, m.hourCentre, handColour);
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
        "SubDialChoice", "showremoteAMPM", "UseWeather", "WeatherUnit", "ShowCurrent", "ShowForecast", "ShowAlert",
        "MinuteHandThickness", "HourHandThickness", "MinuteCentreSize", "HourCentreSize",
        "InnerCentreSize", "BackSize", "BackLen",
        "ShadowOn", "ThemeSelect", "BackgroundColor1", "MinuteHandShadowColor", "MajorTickColor",
        "MinorTickColor", "HourDigitsColor", "MinutesHandColor", "SecondsHandColor", "MonthHandColor",
        "SubDialColor", "DateColor", "BatteryLineColor", "BTQTColor",
        "BWShadowOn", "BWThemeSelect", "BWBackgroundColor1", "BWMinuteHandShadowColor", "BWMajorTickColor",
        "BWMinHandBatLineColor", "BWSecondsHandColor", "BWMonthHandColor", "BWSubDialColor",
        "BWHourDigitsColor", "BWDateColor", "BWBTQTColor"
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
        }
        updateWeatherSectionVisibility();

        var enableDate = config.getItemByMessageKey("EnableDate");
        if (enableDate) {
            enableDate.on('change', updateDateOptionsVisibility);
        }
        updateDateOptionsVisibility();

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