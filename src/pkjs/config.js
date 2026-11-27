module.exports = [
  {
    "type": "heading",
    "defaultValue": "Tangent"
  },
  {
    "type": "text",
    "defaultValue": "<p>by astosia</p>"
  },
  {
    "type": "select",
    "messageKey": "PreviewPlatformOverride",
    "label": "Preview watch model<br>(if preview looks wrong)",
    //"description": "Only changes the preview on this page, not your watch.",
    "defaultValue": "auto",
    "options": [
      { "label": "Auto-detect", "value": "auto" },
      { "label": "Pebble / Steel", "value": "aplite" },
      { "label": "Time / Time Steel", "value": "basalt" },
      { "label": "Time Round", "value": "chalk" },
      { "label": "P2 HR/SE", "value": "diorite" },
      { "label": "Time 2", "value": "emery" },
      { "label": "P2 Duo", "value": "flint" },
      { "label": "Round 2", "value": "gabbro" }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "text",
        "id": "WATCH_PREVIEW",
        "defaultValue": ""
      },
      {
        "type": "heading",
        "defaultValue": "Features"
      },
      {
        "type": "toggle",
        "label": "Watchface Style: Rectangular or Round",
        "messageKey": "ForegroundShape",
        //"description": "Off = Rectangular, On = Round",
        "capabilities": [
          "RECT"
        ],
        "defaultValue": true
      },
      {
        "type": "toggle",
        "label": "Hour Ticks Only (no numbers)",
        "messageKey": "HourTicksOnly",
//        "description": "Replaces the numerals with plain tick marks at each hour",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "label": "Dial Digits: Numbers or Roman Numerals",
        "messageKey": "Roman",
//        "description": "Off = Numbers, On = Roman Numerals",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "label": "Show Date (at bottom of dial)",
        "messageKey": "EnableDate",
       // "description": "Replaces the 6 at the bottom of the dial. Select format:",
        "defaultValue": false
      },
      {
        "type": "select",
        "messageKey": "DateLanguage",
        "defaultValue": "auto",
        "label": "Date Language",
        "options": [
          { "label": "Automatic (match watch)", "value": "auto" },
          { "label": "English",  "value": "en_EN" },
          { "label": "Español",  "value": "es_ES" },
          { "label": "Français", "value": "fr_FR" },
          { "label": "Deutsch",  "value": "de_DE" },
          { "label": "Italiano", "value": "it_IT" },
          { "label": "Português","value": "pt_PT" },
          { "label": "Svenska",  "value": "sv_SE" },
          { "label": "Dansk",    "value": "da_DK" },
          { "label": "Norsk",    "value": "no_NO" },
          { "label": "Suomi",   "value": "fi_FI" },
          { "label": "Nederlands","value": "nl_NL" }
        ]
      },
      {
        "type": "radiogroup",
        "messageKey": "DateFormat",
        "defaultValue": "0",
        "options": [
          {
            "label": "DDD D (WED 9)", 
            "value": "0"
          },
          {
            "label": "MMM D (AUG 9)",
            "value": "1" 
          },
          {
             "label": "D MMM (9 AUG)", 
             "value": "2" 
          },
          {
             "label": "D (9), one digit day", 
             "value": "3" 
          },
          {
             "label": "DD (09), two digit day", 
             "value": "4" 
          },
          { "label": "Week number (WK 48)", "value": "5" },
          { "label": "DDD (WED), weekday only", "value": "6" },
          { "label": "MMM (AUG), month only", "value": "7" }
        ]
      },
      {
        "type": "text",
        "id": "WATCH_PREVIEW_2",
        "defaultValue": ""
      },
      {
        "type": "toggle",
        "capabilities": ["NOT_HEALTH"],
        "label": "Battery Value visible",
        "messageKey": "EnableBattery",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "label": "Battery Meter visible",
        "messageKey": "EnableBatteryLine",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "label": "Show Major Tickmarks",
        "messageKey": "showMajorTick",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "label": "Show Minor Tickmarks",
        "messageKey": "showMinorTick",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "label": "Bluetooth & Quiet Time Icons visible",
        "messageKey": "ShowBTQTIcons",
        "description": "Off hides both the Bluetooth-disconnected and Quiet Time icons whenever they'd otherwise appear",
        "defaultValue": true
      },
      {
        "type": "radiogroup",
        "messageKey": "VibeMode",
        "label": "Vibrate on Bluetooth Disconnect",
        "defaultValue": "0",
        "options": [
          {
            "label": "Respects Quiet Time", 
            "value": "0"
          },
          {
            "label": "Always Vibrate on BT disconnect",
            "value": "1" 
          },
          {
             "label": "Never Vibrate on BT disconnect", 
             "value": "2" 
          }
          ]
        },
        {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "toggle",
        "messageKey": "TimelinePins",
        "label": "Timeline pins for phone disconnections",
        "description": "Adds 'Phone disconnected' and 'Phone reconnected' pins to your timeline whenever the phone is out of reach, so you can see when and for how long. Pins are added when the phone reconnects",
        "defaultValue": false
        },
        {
        "type": "text",
        "id": "WATCH_PREVIEW_3",
        "defaultValue": ""
        },
        // Two copies: watches with a step counter also get the steps options (7, 8); aplite hasn't one
        {
        "type": "select",
        "messageKey": "SubDialChoice",
        "capabilities": ["HEALTH"],
        "defaultValue": 0,
        "label": "SUB DIAL OPTION",
        "description": "Choose what to show on the sub-dial. With it off, you can show two rows of text in its place (below)",
        "options": [
            { "label": "Off, don't show sub-dial", "value": 0 },
            { "label": "Seconds, Always On", "value": 1 },
            { "label": "Seconds, with Timeout", "value": 2 },
            { "label": "Month (12=Dec, 6=Jun)", "value": 3 },
            { "label": "Month always on + seconds with timeout", "value": 6 },
            { "label": "Battery level (12 o'clock = full, 9 = 75%, 6 = 50%, 3 = 25%)", "value": 4 },
            { "label": "Second Timezone", "value": 5 },
            { "label": "Steps vs your target (12 o'clock = target reached)", "value": 7 },
            { "label": "Steps vs your average day (marker = your usual steps by now)", "value": 8 }
          ]
      },
        {
        "type": "select",
        "messageKey": "SubDialChoice",
        "capabilities": ["NOT_HEALTH"],
        "defaultValue": 0,
        "label": "SUB DIAL OPTION",
        "description": "Choose what to show on the sub-dial. With it off, you can show two rows of text in its place (below)",
        "options": [
            { "label": "Off, don't show sub-dial", "value": 0 },
            { "label": "Seconds, Always On", "value": 1 },
            { "label": "Seconds, with Timeout", "value": 2 },
            { "label": "Month (12=Dec, 6=Jun)", "value": 3 },
            { "label": "Month always on + seconds with timeout", "value": 6 },
            { "label": "Battery level (12 o'clock = full, 9 = 75%, 6 = 50%, 3 = 25%)", "value": 4 },
            { "label": "Second Timezone", "value": 5 }
          ]
      },
      {
        "type": "slider",
        "messageKey": "StepTarget",
        "capabilities": ["HEALTH"],
        "label": "Daily step target",
        "description": "The hand reaches 12 o'clock when you've walked this many steps today",
        "defaultValue": 10000,
        "min": 1000,
        "max": 20000,
        "step": 1000
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "heading",
        "id": "TOP_SLOTS_HEADING",
        "defaultValue": "Top complications",
        "description": "Two slots at the top of the face. Pebble app complications 1-5 are the readings listed on the Pebble app's Plugins > Complications tab, in that order."
      },
      {
        "type": "select",
        "messageKey": "TopSlot1",
        "capabilities": ["HEALTH"],
        "label": "Top",
        "defaultValue": "3",
        "options": [
          { "label": "None", "value": "0" },
          { "label": "Date", "value": "12" },
          { "label": "Time (digital)", "value": "1" },
          { "label": "Sunrise", "value": "4" },
          { "label": "Sunset", "value": "5" },
          { "label": "Next sunrise or sunset", "value": "6" },
          { "label": "Steps today", "value": "2" },
          { "label": "Watch Battery", "value": "3" },
          { "label": "Phone battery", "value": "15" },
          { "label": "Current weather (icon & temperature)", "value": "13" },
          { "label": "Forecast high | low", "value": "14" },
          { "label": "UV index: now | today's max", "value": "7" },
          { "label": "Precipitation: chance | amount next hour", "value": "8" },
          { "label": "Timezone", "value": "9" },
          { "label": "Custom text", "value": "11" },
          { "label": "Pebble app complication 1", "value": "16" },
          { "label": "Pebble app complication 2", "value": "17" },
          { "label": "Pebble app complication 3", "value": "18" },
          { "label": "Pebble app complication 4", "value": "19" },
          { "label": "Pebble app complication 5", "value": "20" }
        ]
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "select",
        "messageKey": "TopDate1",
        "label": "Top date format",
        "defaultValue": "0",
        "options": [
          { "label": "WED 9", "value": "0" },
          { "label": "AUG 9", "value": "1" },
          { "label": "9 AUG", "value": "2" },
          { "label": "9", "value": "3" },
          { "label": "09", "value": "4" },
          { "label": "Week number (WK 48)", "value": "5" },
          { "label": "Weekday (WED)", "value": "6" },
          { "label": "Month (AUG)", "value": "7" }
        ]
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "input",
        "messageKey": "SlotText1",
        "label": "Top custom text",
        "description": "Shown in capitals; about 8 letters fit on the smaller watches",
        "defaultValue": "TANGENT",
        "attributes": { "maxlength": 11 }
      },
      {
        "type": "input",
        "messageKey": "SlotTZ1",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "label": "Top timezone",
        "description": "Start typing a city or region to search.",
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "SlotTZState1",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "SlotLabel1",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "label": "Top timezone label",
        "description": "Up to 3 letters shown before the time, e.g. NYC (blank: time only)",
        "defaultValue": "",
        "attributes": { "maxlength": 3 }
      },
      {
        "type": "select",
        "messageKey": "TopSlot2",
        "capabilities": ["HEALTH"],
        "label": "Top, second row",
        "description": "Between the rain and heat alert icons, so only allows shorter items: long text will be cut off",
        "defaultValue": "14",
        "options": [
          { "label": "None", "value": "0" },
          { "label": "Steps today", "value": "2" },
          { "label": "Watch Battery", "value": "3" },
          { "label": "Phone battery", "value": "15" },
          { "label": "Current weather (icon & temperature)", "value": "13" },
          { "label": "Forecast high | low", "value": "14" },
          { "label": "UV index: now | today's max", "value": "7" },
          { "label": "Pebble app complication 1", "value": "16" },
          { "label": "Pebble app complication 2", "value": "17" },
          { "label": "Pebble app complication 3", "value": "18" },
          { "label": "Pebble app complication 4", "value": "19" },
          { "label": "Pebble app complication 5", "value": "20" }
        ]
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "heading",
        "id": "TEXT_ROWS_HEADING",
        "defaultValue": "Bottom complications",
        "description": "Two rows of text above the date, shown while the sub-dial is off. Pebble app complications 1-5 are the readings listed on the Pebble app's Plugins > Complications tab, in that order."
      },
      {
        "type": "select",
        "messageKey": "TextRow1",
        "capabilities": ["HEALTH"],
        "label": "Top row",
        "defaultValue": "0",
        "options": [
          { "label": "None", "value": "0" },
          { "label": "Date", "value": "12" },
          { "label": "Time (digital)", "value": "1" },
          { "label": "Sunrise", "value": "4" },
          { "label": "Sunset", "value": "5" },
          { "label": "Next sunrise or sunset", "value": "6" },
          { "label": "Steps today", "value": "2" },
          { "label": "Watch Battery", "value": "3" },
          { "label": "Phone battery", "value": "15" },
          { "label": "Current weather (icon & temperature)", "value": "13" },
          { "label": "Forecast high | low", "value": "14" },
          { "label": "UV index: now | today's max", "value": "7" },
          { "label": "Precipitation: chance | amount next hour", "value": "8" },
          { "label": "Timezone", "value": "9" },
          { "label": "Custom text", "value": "11" },
          { "label": "Pebble app complication 1", "value": "16" },
          { "label": "Pebble app complication 2", "value": "17" },
          { "label": "Pebble app complication 3", "value": "18" },
          { "label": "Pebble app complication 4", "value": "19" },
          { "label": "Pebble app complication 5", "value": "20" }
        ]
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "select",
        "messageKey": "TextRowDate1",
        "label": "Top row date format",
        "defaultValue": "0",
        "options": [
          { "label": "WED 9", "value": "0" },
          { "label": "AUG 9", "value": "1" },
          { "label": "9 AUG", "value": "2" },
          { "label": "9", "value": "3" },
          { "label": "09", "value": "4" },
          { "label": "Week number (WK 48)", "value": "5" },
          { "label": "Weekday (WED)", "value": "6" },
          { "label": "Month (AUG)", "value": "7" }
        ]
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "input",
        "messageKey": "SlotText3",
        "label": "Top row custom text",
        "description": "Shown in capitals; about 8 letters fit on the smaller watches",
        "defaultValue": "TANGENT",
        "attributes": { "maxlength": 11 }
      },
      {
        "type": "input",
        "messageKey": "SlotTZ3",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "label": "Top row timezone",
        "description": "Start typing a city or region to search.",
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "SlotTZState3",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "SlotLabel3",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "label": "Top row timezone label",
        "description": "Up to 3 letters shown before the time, e.g. NYC (blank: time only)",
        "defaultValue": "",
        "attributes": { "maxlength": 3 }
      },
      {
        "type": "select",
        "messageKey": "TextRow2",
        "capabilities": ["HEALTH"],
        "label": "Bottom row",
        "defaultValue": "0",
        "options": [
          { "label": "None", "value": "0" },
          { "label": "Date", "value": "12" },
          { "label": "Time (digital)", "value": "1" },
          { "label": "Sunrise", "value": "4" },
          { "label": "Sunset", "value": "5" },
          { "label": "Next sunrise or sunset", "value": "6" },
          { "label": "Steps today", "value": "2" },
          { "label": "Watch Battery", "value": "3" },
          { "label": "Phone battery", "value": "15" },
          { "label": "Current weather (icon & temperature)", "value": "13" },
          { "label": "Forecast high | low", "value": "14" },
          { "label": "UV index: now | today's max", "value": "7" },
          { "label": "Precipitation: chance | amount next hour", "value": "8" },
          { "label": "Timezone", "value": "9" },
          { "label": "Custom text", "value": "11" },
          { "label": "Pebble app complication 1", "value": "16" },
          { "label": "Pebble app complication 2", "value": "17" },
          { "label": "Pebble app complication 3", "value": "18" },
          { "label": "Pebble app complication 4", "value": "19" },
          { "label": "Pebble app complication 5", "value": "20" }
        ]
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "select",
        "messageKey": "TextRowDate2",
        "label": "Bottom row date format",
        "defaultValue": "0",
        "options": [
          { "label": "WED 9", "value": "0" },
          { "label": "AUG 9", "value": "1" },
          { "label": "9 AUG", "value": "2" },
          { "label": "9", "value": "3" },
          { "label": "09", "value": "4" },
          { "label": "Week number (WK 48)", "value": "5" },
          { "label": "Weekday (WED)", "value": "6" },
          { "label": "Month (AUG)", "value": "7" }
        ]
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "input",
        "messageKey": "SlotText4",
        "label": "Bottom row custom text",
        "description": "Shown in capitals; about 8 letters fit on the smaller watches",
        "defaultValue": "TANGENT",
        "attributes": { "maxlength": 11 }
      },
      {
        "type": "input",
        "messageKey": "SlotTZ4",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "label": "Bottom row timezone",
        "description": "Start typing a city or region to search.",
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "SlotTZState4",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "SlotLabel4",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "label": "Bottom row timezone label",
        "description": "Up to 3 letters shown before the time, e.g. NYC (blank: time only)",
        "defaultValue": "",
        "attributes": { "maxlength": 3 }
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "toggle",
        "messageKey": "ShowAMPM",
        "label": "Show AM/PM",
        "description": "The time follows your watch's 12/24-hour setting; this adds AM or PM in 12-hour mode",
        "defaultValue": false
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "toggle",
        "messageKey": "LeadingZero12",
        "label": "Leading zero in 12-hour times",
        "description": "09:08 instead of 9:08 (the time, sunrise/sunset and time zones)",
        "defaultValue": false
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "toggle",
        "messageKey": "LeadingZero24",
        "label": "Leading zero in 24-hour times",
        "description": "09:08 instead of 9:08 (the time, sunrise/sunset and time zones)",
        "defaultValue": true
      },
      {
        "type": "select",
        "messageKey": "StepSeparator",
        "capabilities": ["HEALTH", "NOT_PLATFORM_APLITE"],
        "label": "Steps thousands separator",
        "defaultValue": "0",
        "options": [
          { "label": "Automatic (from the date language)", "value": "0" },
          { "label": "Comma (8,432)", "value": "1" },
          { "label": "Dot (8.432)", "value": "2" },
          { "label": "None (8432)", "value": "3" }
        ]
      },
      {
        "type": "select",
        "messageKey": "PrecipInches",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "label": "Precipitation amount in",
        "defaultValue": "0",
        "options": [
          { "label": "Millimetres (1.2MM)", "value": "0" },
          { "label": "Inches (0.05IN)", "value": "1" }
        ]
      },
      {
        "type": "toggle",
        "messageKey": "ShakeToParkHands",
        "label": "Shake to Move Hands Aside",
        "description": "Shake to swing the hands into a flat line (hour hand to 9, minute hand to 3) for a few seconds, so they don't cover the complications",
        "defaultValue": false
      },
      {
        "type": "slider",
        "messageKey": "ParkHandsSeconds",
        "label": "Hands aside for (seconds)",
        "defaultValue": 5,
        "min": 2,
        "max": 20,
        "step": 1
      },
      {
        "type": "heading",
        "id": "SECONDS_HEADING",
        "defaultValue": "Second hand options",
        "description": "Use when second hand is selected on sub-dial"
      },
      {
        "type": "slider",
        "messageKey": "SecondsVisibleTime",
        "defaultValue": 15,
        "label": "Seconds hand visibility",
        "description": "When Seconds with Timeout is on the sub-dial, shake to show the seconds hand for selected duration",
        "min": 15,
        "max": 120,
        "step": 15
      },
      {
        "type": "toggle",
        "label": "Show sub-dial when Seconds timeout",
        "messageKey": "AlwaysShowSubDial",
        "description": "Keeps the sub-dial visible when the seconds hand times out (it freezes in place instead of disappearing). Seconds hand will jump to 12 position at the next minute, then back to correct time on the next wrist shake",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "label": "Sweep Second Hand",
        "messageKey": "SmoothSweep",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "description": "Moves the second hand several times per second for a smoother movement (see Sweep speed) - uses more battery than ticking once a second",
        "defaultValue": false
      },
      {
        "type": "select",
        "messageKey": "SweepRate",
        "label": "Sweep speed",
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "description": "How many times per second the swept second hand moves. Higher = smoother, but uses more battery",
        "defaultValue": "5",
        "options": [
          { "label": "5 per second (smoothest)", "value": "5" },
          { "label": "4 per second", "value": "4" },
          { "label": "3 per second", "value": "3" },
          { "label": "2 per second (saves battery)", "value": "2" }
        ]
      },
      {
        "type": "heading",
        "id": "TZ_HEADING",
        "defaultValue": "Timezone options",
        "description": "For the 2nd timezone on the sub-dial"
      },
      {
        "type": "toggle",
        "messageKey": "showremoteAMPM",
        "label": "Show AM PM mark for 2nd timezone",
        "description": "Shows extra circle on the sub-dial hour hand when 2nd Timezone is PM",
        "defaultValue": true
      },
      {
        "type": "input",
        "messageKey": "TZ_ID",
        "label": "2nd Timezone",
        "description": "Data provided by timeapi.io. Start typing a city or region to search.",
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "TZ_ID_STATE",
        "defaultValue": ""
      },
      {
        "type": "button",
        "id": "TZ_BUTTON",
        "primary": true,
        "defaultValue": "Fetch Timezones",
        "description": "Tap to reload the list"
      },
      {
        "type": "text",
        "id": "TZ_DEBUG",
        "defaultValue": ""
      },
      // Phone-only: the custom colours as you last set them yourself, for "My previous custom
      // colours" in "Load colours from a preset" (modifications.js). Kept per watch, never sent
      // to the watch (index.js). In this section because it's on every watch's page.
      {
        "type": "input",
        "messageKey": "CustomColourMemory",
        "defaultValue": ""
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save"
  },
  {
    "type": "section",
    "items": [
    {
        "type": "heading",
        "id": "WEATHER_HEADING",
        "defaultValue": "Weather"
    },
    {
        "type": "toggle",
        "messageKey": "UseWeather",
        "label": "Show Weather",
        "description": "Weather for the complications (current weather, forecast, sunrise/sunset, UV, precipitation). Also shows alerts for rain in next hour, and current very high wet bulb globe temperatures",
        "defaultValue": false
    },
    {
        "type": "toggle",
        "capabilities": ["NOT_HEALTH"],
        "messageKey": "ShowCurrent",
        "label": "Show Current Icon & Temperature",
        "defaultValue": true
    },
    {
        "type": "toggle",
        "capabilities": ["NOT_HEALTH"],
        "messageKey": "ShowForecast",
        "label": "Show Forecast High & Low Temp",
        "defaultValue": true
    },
    {
        "type": "toggle",
        "messageKey": "ShowAlert",
        "label": "Show Rain in next hour &<br>WBGT (heat stress) alert icons",
//        "description": "current and forecast high | low temperatures & condition icons replace battery value. Also shows alerts for rain in next hour, and current very high wet bulb globe temperatures",
        "defaultValue": true
    },
    {
        "type": "text",
        "id": "WATCH_PREVIEW_4",
        "defaultValue": ""
    },
    {
        "type": "toggle",
        "messageKey": "WeatherUnit",
        "label": "Temperature in °C (off) or °F (on)",
        "defaultValue": false
    },
    {
        "type": "select",
        "messageKey": "WeatherProv",
        "defaultValue": "ds",
        "label": "Weather Provider",
        "options": [
          {
            "label": "Open-Meteo",
            "value": "ds"
          },
          {
            "label": "OpenWeatherMap (One Call 3.0)",
            "value": "owm"
          },
          {
            "label": "OpenWeatherMap (One Call 4.0)",
            "value": "owm4"
          }
        ]
      },
      {
        "type": "input",
        "messageKey": "LocationQuery",
        "label": "Location: you may have to wait a few seconds for list to appear",
        "description": "Start typing a city, place name or postcode/zipcode... Leave blank to use GPS location. Location search data uses ©OpenStreetMap.",
        "attributes": {
          "placeholder": "e.g. London, UK (leave empty to use GPS)"
        }
      },
      {
        "type": "input",
        "messageKey": "Lat",
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "Long",
        "defaultValue": ""
      },
      {
        "type": "text",
        "id": "LOCATION_DEBUG",
        "defaultValue": ""
      },
      {
        "type": "input",
        "messageKey": "APIKEY_User",
        "defaultValue": "",
        "label": "OWM API Key",
        "description": "Weather data uses Open-Meteo by default which does not require an API key.  If you prefer OpenWeatherMap, you can <a href =https://home.openweathermap.org/users/sign_up/>register for a free personal API key here</a>. There is a free tier. One Call 3.0 and One Call 4.0 each need their own (free tier) subscription on your OpenWeatherMap account; 4.0 uses three calls per weather update.",
        "attributes": {
          "placeholder": "Paste OpenWeatherMap API Key here, leave blank for Open-Meteo"
        }
      },
      {
        "type": "slider",
        "messageKey": "UpSlider",
        "defaultValue": 30,
        "label": "Weather update frequency (minutes)",
        "description": "More frequent requests will drain your phone battery more quickly",
        "min": 15,
        "max": 120,
        "step": 15
      },
      {
        "type": "toggle",
        "messageKey": "RefreshWeatherOnLaunch",
        "label": "Refresh Weather on Relaunch",
        "description": "Request fresh weather every time the watchface loads. Off = only when the last reading is older than the update frequency above",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "messageKey": "ShakeToRefreshWeather",
        "label": "Shake to Refresh Weather",
        "description": "Request fresh weather on demand<br>(limited to one attempt per minute). If Shake to Move Hands Aside (Complications) is also on, shake twice within 2 seconds to refresh",
        "defaultValue": true
      },
      {
        "type": "submit",
        "id": "WEATHER_SAVE",
        "defaultValue": "Save"
      }
    ]
  },
  {
    "type": "section",
    "capabilities": [ "COLOR" ],
    "items": [
      {
        "type": "heading",
        "defaultValue": "Colours"
      },
      {
        "type": "text",
        "id": "WATCH_PREVIEW_5",
        "defaultValue": ""
      },
      {
        "type": "toggle",
       "label": "Hand Shadow On",
       "messageKey": "ShadowOn",
       "defaultValue": true
      },
      {
        "type": "select",
        "messageKey": "BackgroundStyle",
        "label": "Background",
       // "description": "A picture behind the face instead of a flat colour",
        "defaultValue": "0",
        "options": [
          { "label": "Flat colour", "value": "0" },
          { "label": "Painted Rainbow", "value": "1" },
          { "label": "Rose", "value": "2" },
          { "label": "Sunburst", "value": "3" },
          { "label": "Hammered", "value": "4" },
          { "label": "Fumé", "value": "6" },
          { "label": "Enamel", "value": "7" },
          { "label": "Textured", "value": "9" }
        ]
      },
      // Background picture colours. Which of these show, and what they're called, depends on
      // the background picked (modifications.js): painted rainbow 7, rose 4, sunburst 2 (main, shadow),
      // fume 1, the others 2.
      // Picking a background resets them to that background's own colours.
      {
        "type": "color",
        "messageKey": "PicColor1",
        "label": "Background colour 1",
        "defaultValue": "FFFF00"
      },
      {
        "type": "color",
        "messageKey": "PicColor2",
        "label": "Background colour 2",
        "defaultValue": "00FFFF"
      },
      {
        "type": "color",
        "messageKey": "PicColor3",
        "label": "Background colour 3",
        "defaultValue": "FF00FF"
      },
      {
        "type": "color",
        "messageKey": "PicColor4",
        "label": "Background colour 4",
        "defaultValue": "0000FF"
      },
      {
        "type": "color",
        "messageKey": "PicColor5",
        "label": "Background colour 5",
        "defaultValue": "0055FF"
      },
      {
        "type": "color",
        "messageKey": "PicColor6",
        "label": "Background colour 6",
        "defaultValue": "0000AA"
      },
      {
        "type": "color",
        "messageKey": "PicColor7",
        "label": "Background colour 7",
        "defaultValue": "FF00AA"
      },
      {
        "type": "button",
        "id": "PIC_COLOURS_RESET",
        "defaultValue": "Reset background colours"
      },
      // Phone-only: the colours last used with each background, so going back to a background
      // brings its colours back (modifications.js). Never sent to the watch (index.js).
      {
        "type": "input",
        "messageKey": "PicColorMemory",
        "defaultValue": ""
      },
      {
        "type": "radiogroup",
        "messageKey": "ThemeSelect",
        "defaultValue": "bu",
        "label": "COLOUR THEME SELECT",
        "options": [
          {
            "label": "White",
            "value": "wh"
          },
          {
            "label": "Black",
            "value": "bl"
          },
          {
              "label": "Blue",
              "value": "bu"
          },
          {
              "label": "Purple",
              "value": "pl"
          },
          {
              "label": "Black & Green",
              "value": "gr"
          },
          {
            "label": "Custom Colours",
            "value": "cu"
          }
        ]
      },
      {
           "type": "heading",
           "id": "CUSTOM_COLOURS_HEADING",
           "defaultValue": "Custom Colours"
      },
      {
        "type": "select",
        "id": "LOAD_PRESET",
        "label": "Load colours from a preset (then change them here)",
        "defaultValue": "",
        "options": [
          { "label": "Choose a preset...", "value": "" },
          { "label": "My previous custom colours", "value": "mine" },
          { "label": "White", "value": "wh" },
          { "label": "Black", "value": "bl" },
          { "label": "Blue", "value": "bu" },
          { "label": "Purple", "value": "pl" },
          { "label": "Black & Green", "value": "gr" }
        ]
      },
      {
        "type": "text",
        "id": "WATCH_PREVIEW_6",
        "defaultValue": ""
      },
      {
        "type": "color",
        "label": "Background Colour",
        "messageKey": "BackgroundColor1",
        "defaultValue": "FFFFFF"
      },
      {
        "type": "color",
        "label": "Hand Shadow Colour",
        "messageKey": "MinuteHandShadowColor",
        "defaultValue": "AAAAAA"
      },
      {
        "type": "color",
        "label": "Major Tickmark Colour",
        "messageKey": "MajorTickColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Minor Tickmark Colour",
        "messageKey": "MinorTickColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Hours Digits Colour",
        "messageKey": "HourDigitsColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Minute Hand Colour",
        "messageKey": "MinutesHandColor",
        "defaultValue": "FF5500"
      },
      {
        "type": "color",
        "label": "Hour Hand Colour",
        "messageKey": "HourHandColor",
        "defaultValue": "FF5500"
      },
      {
        "type": "color",
        "label": "Sub-dial Hand 1:<br>Seconds or 2nd timezone minutes",
        "messageKey": "SecondsHandColor",
        "defaultValue": "FF5500"
      },
      {
        "type": "color",
        "label": "Sub-dial Hand 2:<br>Month, battery or 2nd timezone hour",
        "messageKey": "MonthHandColor",
        "defaultValue": "FF5500"
      },
      {
        "type": "color",
        "label": "Sub-dial Background Colour",
        "messageKey": "SubDialColor",
        "defaultValue": "FFFF55"
      },
      {
        "type": "color",
        "label": "Date Colour",
        "messageKey": "DateColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Top complications colour",
        "messageKey": "BatteryWeatherColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Bottom complications colour",
        "messageKey": "BottomColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Battery Line Colour",
        "messageKey": "BatteryLineColor",
        "defaultValue": "FF5500"
      },
      {
        "type": "color",
        "label": "Quiet Time and Bluetooth Icon Colour",
        "messageKey": "BTQTColor",
        "defaultValue": "000000"
      }
    ]
  },
  {
    "type": "section",
    "capabilities": [ "BW" ],
    "items": [
      {
        "type": "heading",
        "defaultValue": "Colours"
      },
      {
        "type": "text",
        "id": "WATCH_PREVIEW_5",
        "defaultValue": ""
      },
      {
        "type": "toggle",
       "label": "Hand Shadow On",
       "messageKey": "BWShadowOn",
       "defaultValue": true
      },
       {
         "type": "radiogroup",
         "messageKey": "BWThemeSelect",
         "defaultValue": "bl",
         "label": "COLOUR THEME SELECT",
         "options": [
           {
             "label": "White Background",
             "value": "wh"
           },
           {
             "label": "Black Background",
             "value": "bl"
           },
           {
             "label": "Custom Colours",
             "value": "cu"
           }
         ]
      },
      {
            "type": "heading",
            "id": "CUSTOM_COLOURS_HEADING",
            "defaultValue": "Custom Colours"
      },
      {
        "type": "select",
        "id": "BW_LOAD_PRESET",
        "label": "Load colours from a preset (then change them here)",
        "defaultValue": "",
        "options": [
          { "label": "Choose a preset...", "value": "" },
          { "label": "My previous custom colours", "value": "mine" },
          { "label": "White Background", "value": "wh" },
          { "label": "Black Background", "value": "bl" }
        ]
      },
      {
        "type": "text",
        "id": "WATCH_PREVIEW_6",
        "defaultValue": ""
      },
      {
        "type": "color",
        "label": "Background Colour",
        "messageKey": "BWBackgroundColor1",
        "defaultValue": "FFFFFF",
        "allowGray": true
      },
      {
        "type": "color",
        "label": "Hand Shadow Colour",
        "messageKey": "BWMinuteHandShadowColor",
        "defaultValue": "AAAAAA",
        "allowGray": true
      },
      {
        "type": "color",
        "label": "Tickmark Colour",
        "messageKey": "BWMajorTickColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Minute Hand & Battery Line Colour",
        "messageKey": "BWMinHandBatLineColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Hour Hand Colour",
        "messageKey": "BWHourHandColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Seconds Hand Colour",
        "messageKey": "BWSecondsHandColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Month Hand Colour",
        "messageKey": "BWMonthHandColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Sub-dial Background Colour",
        "messageKey": "BWSubDialColor",
        "defaultValue": "FFFFFF",
        "allowGray": true
      },
      {
        "type": "color",
        "label": "Hours Digits Colour",
        "messageKey": "BWHourDigitsColor",
        "defaultValue": "000000",
        "allowGray": true
      },
      {
        "type": "color",
        "label": "Date Colour",
        "messageKey": "BWDateColor",
        "defaultValue": "000000",
        "allowGray": true
      },
      {
        "type": "color",
        "label": "Top complications colour",
        "messageKey": "BWBatteryWeatherColor",
        "defaultValue": "000000",
        "allowGray": true
      },
      {
        "capabilities": ["NOT_PLATFORM_APLITE"],
        "type": "color",
        "label": "Bottom complications colour",
        "messageKey": "BWBottomColor",
        "defaultValue": "000000",
        "allowGray": true
      },
      {
        "type": "color",
        "label": "Quiet Time and Bluetooth Icon Colour",
        "messageKey": "BWBTQTColor",
        "defaultValue": "000000",
        "allowGray": true
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save"
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Analogue Hand Style"
      },
      {
        "type": "slider",
        "label": "Minute & Sub-dial Hand Thickness: Default = 2",
        "messageKey": "MinuteHandThickness",
//        "description": "Default = 2",
        "defaultValue": 2,
        "min": 1,
        "max": 5,
        "step": 1
      },
      {
        "type": "slider",
        "label": "Hour Hand Thickness: Default = 2",
        "messageKey": "HourHandThickness",
//        "description": "Default = 2",
        "defaultValue": 2,
        "min": 1,
        "max": 7,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "label": "Minute Hand Centre Radius: Default = 4",
        "messageKey": "MinuteCentreSize",
        "defaultValue": 4,
//        "description": "Default = 4",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "label": "Hour Hand Centre Radius: Default = 6",
        "messageKey": "HourCentreSize",
        "defaultValue": 6,
//        "description": "Default = 6",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_EMERY"],
        "label": "Minute Hand Centre Radius: Default = 7",
        "messageKey": "MinuteCentreSize",
        "defaultValue": 7,
//        "description": "Default = 7",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_GABBRO"],
        "label": "Minute Hand Centre Radius: Default = 5",
        "messageKey": "MinuteCentreSize",
        "defaultValue": 5,
//        "description": "Default = 5",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_EMERY"],
        "label": "Hour Hand Centre Radius: Default = 9",
        "messageKey": "HourCentreSize",
        "defaultValue": 9,
//        "description": "Default = 9",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_GABBRO"],
        "label": "Hour Hand Centre Radius: Default = 7",
        "messageKey": "HourCentreSize",
        "defaultValue": 7,
//        "description": "Default = 7",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "text",
        "id": "WATCH_PREVIEW_7",
        "defaultValue": ""
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "label": "Inner Radius: Default = 2",
        "messageKey": "InnerCentreSize",
        "defaultValue": 2,
//        "description": "Default = 2",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_GABBRO"],
        "label": "Inner Radius: Default = 2",
        "messageKey": "InnerCentreSize",
        "defaultValue": 2,
//        "description": "Default = 2",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_EMERY"],
        "label": "Inner Radius: Default = 3",
        "messageKey": "InnerCentreSize",
        "defaultValue": 3,
//        "description": "Default = 3",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "label": "End Radius: Default = 0",
        "messageKey": "BackSize",
        "defaultValue": 0,
//        "description": "Default = 0",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "label": "End Length: Default = 0",
        "messageKey": "BackLen",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
        "defaultValue": 0,
//        "description": "Default = 0",
        "min": 0,
        "max": 40,
        "step": 2
      },
      {
        "type": "slider",
        "label": "End Length: Default = 0",
        "messageKey": "BackLen",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "defaultValue": 0,
//        "description": "Default = 0",
        "min": 0,
        "max": 30,
        "step": 2
      }
      // },
      // {
      //   "type": "text",
      //   "id": "WATCH_PREVIEW_8",
      //   "defaultValue": ""
      // }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save"
  },
];