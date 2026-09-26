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
        "label": "Dial Digits: Numbers or Roman Numerals",
        "messageKey": "Roman",
//        "description": "Off = Numbers, On = Roman Numerals",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "label": "Date visible",
        "messageKey": "EnableDate",
       // "description": "Replaces the 6 at the bottom of the dial. Select format:",
        "defaultValue": false
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
          }
        ]
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
        "type": "text",
        "id": "WATCH_PREVIEW_2",
        "defaultValue": ""
      },
      {
        "type": "toggle",
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
        "type": "text",
        "id": "WATCH_PREVIEW_3",
        "defaultValue": ""
        },
        {
        "type": "select",
        "messageKey": "SubDialChoice",
        "defaultValue": 0,
        "label": "SUB DIAL OPTION",
        "description": "Choose what to show on the sub-dial",
        "options": [
            { 
              "label": "Off, don't show sub-dial", 
              "value": 0 
            },
            { 
              "label": "Seconds, Always On",
              "value": 1 
            },
            { 
              "label": "Seconds, with Timeout",
              "value": 2 
            },
            { 
              "label": "Month (12=Dec, 6=Jun)",
              "value": 3 
            },
            { 
              "label": "Month always on + seconds with timeout",
              "value": 6
            },
            // { 
            //   "label": "Battery Percentage",
            //   "value": 4 
            // },
            { 
              "label": "Second Timezone",
              "value": 5
            }
          ]
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
        "description": "Updates the second hand 5 times per second to give a smoother movement - will reduce battery life!",
        "defaultValue": false
      },
      {
        "type": "heading",
        "id": "TZ_HEADING",
        "defaultValue": "Timezone options",
        "description": "Use when 2nd Timezone is selected on sub-dial"
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
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save"
  },
  {
    "type": "section",
    "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
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
        "description": "current condition icon & temperature replaces battery value. Also shows alerts for rain in next hour, and current very high wet bulb globe temperatures",
        "defaultValue": false
    },
    {
        "type": "toggle",
        "messageKey": "ShowCurrent",
        "label": "Show Current Icon & Temperature",
//        "description": "current and forecast high | low temperatures & condition icons replace battery value. Also shows alerts for rain in next hour, and current very high wet bulb globe temperatures",
        "defaultValue": true
    },
    {
        "type": "toggle",
        "messageKey": "ShowForecast",
        "label": "Show Forcast High & Low Temp",
//        "description": "current and forecast high | low temperatures & condition icons replace battery value. Also shows alerts for rain in next hour, and current very high wet bulb globe temperatures",
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
            "label": "OpenWeatherMap",
            "value": "owm"
          }
        ]
      },
      {
        "type": "input",
        "messageKey": "LocationQuery",
        "label": "Location",
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
        "description": "Weather data uses Open-Meteo by default which does not require an API key.  If you prefer OpenWeatherMap, you can <a href =https://home.openweathermap.org/users/sign_up/>register for a free personal API key here</a>. There is a free tier",
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
        "label": "Also Refresh Weather on Relaunch",
        "description": "In addition to the update interval above, also request fresh weather every time watchface loads. Off = keeps last known reading between relaunches",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "messageKey": "WeatherUnit",
        "label": "Temperature in °C (off) or °F (on)",
        "defaultValue": false
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
        "label": "Minute & Hour Hand Colour",
        "messageKey": "MinutesHandColor",
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
        "label": "Sub-dial Hand 2:<br>Month or 2nd timezone hour",
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
        "label": "Date & Battery/Weather Text Colour",
        "messageKey": "DateColor",
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
        "label": "Hands & Battery Line Colour",
        "messageKey": "BWMinHandBatLineColor",
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
        "label": "Date, Battery Value & Weather Text Colour",
        "messageKey": "BWDateColor",
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