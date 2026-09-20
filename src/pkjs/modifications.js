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

    // Creates the suggestion <ul> once, positioned directly under the input.
    var getOrCreateSuggestionBox = function(inputElement) {
        if (suggestionBox) return suggestionBox;

        var parent = inputElement.parentNode;
        parent.style.position = 'relative';

        suggestionBox = document.createElement('ul');
        suggestionBox.className = 'tz-suggestions';
        suggestionBox.style.position = 'absolute';
        suggestionBox.style.top = '100%';
        suggestionBox.style.left = '0';
        suggestionBox.style.right = '0';
        suggestionBox.style.zIndex = '1000';
        suggestionBox.style.listStyle = 'none';
        suggestionBox.style.margin = '0';
        suggestionBox.style.padding = '0';
        suggestionBox.style.background = '#fff';
        suggestionBox.style.color = '#222';
        suggestionBox.style.border = '1px solid #ccc';
        suggestionBox.style.maxHeight = '200px';
        suggestionBox.style.overflowY = 'auto';
        suggestionBox.style.display = 'none';

        parent.insertBefore(suggestionBox, inputElement.nextSibling);

        return suggestionBox;
    };

    var hideSuggestions = function() {
        if (suggestionBox) suggestionBox.style.display = 'none';
    };

    var showSuggestions = function(matches, inputElement, item, idstate) {
        var box = getOrCreateSuggestionBox(inputElement);
        box.innerHTML = '';

        if (!matches.length) {
            box.style.display = 'none';
            return;
        }

        for (var i = 0; i < matches.length; i++) {
            (function(tz) {
                var li = document.createElement('li');
                li.textContent = tz;
                li.style.padding = '6px 8px';
                li.style.cursor = 'pointer';
                li.style.color = '#222';
                li.style.background = '#fff';

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
                    inputElement.value = tz;
                    item.set(tz);
                    idstate.set(tz);
                    hideSuggestions();
                });

                box.appendChild(li);
            })(matches[i]);
        }

        box.style.display = 'block';
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

    var getOrCreateLocationSuggestionBox = function(inputElement) {
        if (locationSuggestionBox) return locationSuggestionBox;

        var parent = inputElement.parentNode;
        parent.style.position = 'relative';

        locationSuggestionBox = document.createElement('ul');
        locationSuggestionBox.className = 'location-suggestions';
        locationSuggestionBox.style.position = 'absolute';
        locationSuggestionBox.style.top = '100%';
        locationSuggestionBox.style.left = '0';
        locationSuggestionBox.style.right = '0';
        locationSuggestionBox.style.zIndex = '1000';
        locationSuggestionBox.style.listStyle = 'none';
        locationSuggestionBox.style.margin = '0';
        locationSuggestionBox.style.padding = '0';
        locationSuggestionBox.style.background = '#fff';
        locationSuggestionBox.style.color = '#222';
        locationSuggestionBox.style.border = '1px solid #ccc';
        locationSuggestionBox.style.maxHeight = '200px';
        locationSuggestionBox.style.overflowY = 'auto';
        locationSuggestionBox.style.display = 'none';

        parent.insertBefore(locationSuggestionBox, inputElement.nextSibling);

        return locationSuggestionBox;
    };

    var hideLocationSuggestions = function() {
        if (locationSuggestionBox) locationSuggestionBox.style.display = 'none';
    };

    // matches: array of { display, lat, lon }
    var showLocationSuggestions = function(matches, inputElement, item, latItem, longItem) {
        var box = getOrCreateLocationSuggestionBox(inputElement);
        box.innerHTML = '';

        if (!matches.length) {
            box.style.display = 'none';
            return;
        }

        for (var i = 0; i < matches.length; i++) {
            (function(match) {
                var li = document.createElement('li');
                li.textContent = match.display;
                li.style.padding = '6px 8px';
                li.style.cursor = 'pointer';
                li.style.color = '#222';
                li.style.background = '#fff';

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
                    inputElement.value = match.display;
                    item.set(match.display);
                    latItem.set(String(match.lat));
                    longItem.set(String(match.lon));
                    selectedLocationDisplay = match.display;
                    hideLocationSuggestions();
                });

                box.appendChild(li);
            })(matches[i]);
        }

        box.style.display = 'block';
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

    // Shows the rest of the weather options only when the "Show Weather" toggle is on
    var updateWeatherSectionVisibility = function() {
        var useWeather = config.getItemByMessageKey("UseWeather");
        if (!useWeather) return;

        var isWeatherOn = !!useWeather.get();

        var keysToToggle = ["RefreshWeatherOnLaunch", "WeatherProv", "LocationQuery", "APIKEY_User", "UpSlider", "WeatherUnit"];

        for (var i = 0; i < keysToToggle.length; i++) {
            var item = config.getItemByMessageKey(keysToToggle[i]);
            if (item) {
                if (isWeatherOn) { item.show(); } else { item.hide(); }
            }
        }
    };

    var TZ_SUBDIAL_VALUE = 5; // matches "Second Timezone" option in SubDialChoice
    var SECONDS_SUBDIAL_VALUES_A = [2]; // "Seconds, with Timeout" 
    var SECONDS_SUBDIAL_VALUES_B = [2,6]; // "Month hand + seconds on shake" 
    var SECONDS_SWEEP_VALUE = [1,2,6]; //Seconds always on, or with timeout, to show sweep option

    // Shows the timezone-related fields only when SubDialChoice == 5.
    var updateTimezoneSectionVisibility = function() {
        var subdial = config.getItemByMessageKey("SubDialChoice");
        if (!subdial) return;

        var isTimezoneMode = parseInt(subdial.get(), 10) === TZ_SUBDIAL_VALUE;

        var idsToToggle = ["TZ_HEADING", "TZ_BUTTON", "TZ_DEBUG"];
        var keysToToggle = ["showremoteAMPM", "TZ_ID"];

        var i, item;
        for (i = 0; i < idsToToggle.length; i++) {
            item = config.getItemById(idsToToggle[i]);
            if (item) {
                if (isTimezoneMode) { item.show(); } else { item.hide(); }
            }
        }
        for (i = 0; i < keysToToggle.length; i++) {
            item = config.getItemByMessageKey(keysToToggle[i]);
            if (item) {
                if (isTimezoneMode) { item.show(); } else { item.hide(); }
            }
        }
    };

    // Shows the seconds-hand-related fields only when SubDialChoice is one of the temporary seconds-hand modes (2 or 6)
    var updateSecondsSectionVisibilityA = function() {
        var subdial = config.getItemByMessageKey("SubDialChoice");
        if (!subdial) return;

        var currentValue = parseInt(subdial.get(), 10);
        var isSecondsMode = false;
        for (var i = 0; i < SECONDS_SUBDIAL_VALUES_A.length; i++) {
            if (SECONDS_SUBDIAL_VALUES_A[i] === currentValue) {
                isSecondsMode = true;
                break;
            }
        }

        var idsToToggle = ["SECONDS_HEADING"];
        var keysToToggle = ["AlwaysShowSubDial"];

        var j, item;
        for (j = 0; j < idsToToggle.length; j++) {
            item = config.getItemById(idsToToggle[j]);
            if (item) {
                if (isSecondsMode) { item.show(); } else { item.hide(); }
            }
        }
        for (j = 0; j < keysToToggle.length; j++) {
            item = config.getItemByMessageKey(keysToToggle[j]);
            if (item) {
                if (isSecondsMode) { item.show(); } else { item.hide(); }
            }
        }
    };

    var updateSecondsSectionVisibilityB = function() {
        var subdial = config.getItemByMessageKey("SubDialChoice");
        if (!subdial) return;

        var currentValue = parseInt(subdial.get(), 10);
        var isSecondsMode = false;
        for (var i = 0; i < SECONDS_SUBDIAL_VALUES_B.length; i++) {
            if (SECONDS_SUBDIAL_VALUES_B[i] === currentValue) {
                isSecondsMode = true;
                break;
            }
        }

        var idsToToggle = ["SECONDS_HEADING"];
        var keysToToggle = ["SecondsVisibleTime","BacklightInteraction"];

        var j, item;
        for (j = 0; j < idsToToggle.length; j++) {
            item = config.getItemById(idsToToggle[j]);
            if (item) {
                if (isSecondsMode) { item.show(); } else { item.hide(); }
            }
        }
        for (j = 0; j < keysToToggle.length; j++) {
            item = config.getItemByMessageKey(keysToToggle[j]);
            if (item) {
                if (isSecondsMode) { item.show(); } else { item.hide(); }
            }
        }
    };

    var updateSweepVisibility = function() {
        var subdial = config.getItemByMessageKey("SubDialChoice");
        if (!subdial) return;

        var currentValue = parseInt(subdial.get(), 10);
        var isSecondsMode = false;
        for (var i = 0; i < SECONDS_SWEEP_VALUE.length; i++) {
            if (SECONDS_SWEEP_VALUE[i] === currentValue) {
                isSecondsMode = true;
                break;
            }
        }

        var idsToToggle = ["SECONDS_HEADING"];
        var keysToToggle = ["SmoothSweep"];

        var j, item;
        for (j = 0; j < idsToToggle.length; j++) {
            item = config.getItemById(idsToToggle[j]);
            if (item) {
                if (isSecondsMode) { item.show(); } else { item.hide(); }
            }
        }
        for (j = 0; j < keysToToggle.length; j++) {
            item = config.getItemByMessageKey(keysToToggle[j]);
            if (item) {
                if (isSecondsMode) { item.show(); } else { item.hide(); }
            }
        }
    };

    var maybeAutoFetchTimezones = function() {
    var subdial = config.getItemByMessageKey("SubDialChoice");
    if (!subdial) return;

    var currentValue = parseInt(subdial.get(), 10);
    if (currentValue !== TZ_SUBDIAL_VALUE) return;

    if (timezonesJSON !== 0 && timezonesJSON !== null) return; // already have a good list

    getTimezones();
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
            subdial.on('change', updateTimezoneSectionVisibility);
            subdial.on('change', updateSecondsSectionVisibilityA);
            subdial.on('change', updateSecondsSectionVisibilityB);
            subdial.on('change', updateSweepVisibility);
            subdial.on('change', maybeAutoFetchTimezones);
        }
        updateTimezoneSectionVisibility();
        updateSecondsSectionVisibilityA();
        updateSecondsSectionVisibilityB();
        updateSweepVisibility();
        maybeAutoFetchTimezones();

        var useWeather = config.getItemByMessageKey("UseWeather");
        if (useWeather) {
            useWeather.on('change', updateWeatherSectionVisibility);
        }
        updateWeatherSectionVisibility();
    });

    
};