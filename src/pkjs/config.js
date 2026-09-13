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
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Features"
      },
      {
        "type": "toggle",
        "label": "Watchface Style",
        "messageKey": "ForegroundShape",
        "description": "Off = Rectangular, On = Round",
        "capabilities": [
          "RECT"
        ],
        "defaultValue": true
      },
      {
        "type": "toggle",
        "label": "Digit Style",
        "messageKey": "Roman",
        "description": "Off = Numbers, On = Roman Numerals",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "label": "Date visible",
        "messageKey": "EnableDate",
        "description": "Replaces the 6 at the bottom of the dial. Select format:",
        "defaultValue": true
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
        // {
        // "type": "toggle",
        // "label": "Show Larger Sub-dial",
        // "messageKey": "BigSub",
        // "defaultValue": false
        // },
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
      // {
      //   "type": "toggle",
      //   "label": "Month hand visible",
      //   "messageKey": "EnableMonth",
      //   "description": "Shows on sub-dial, 12 position = December, 6 = June",
      //   "defaultValue": false
      // },
      // {
      //   "type": "toggle",
      //   "label": "Seconds hand visible",
      //   "messageKey": "EnableSecondsHand",
      //   "description": "Shows on sub-dial",
      //   "defaultValue": true
      // },
      {
        "type": "heading",
        "id": "SECONDS_HEADING",
        "defaultValue": "Second hand options",
        "description": "Use when second hand is selected on sub-dial"
      },
      // {
      //   "type": "toggle",
      //   "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
      //   "messageKey": "BacklightInteraction",
      //   "label": "Use Backlight to trigger seconds instead of shake",
      //   "description": "When Seconds with Timeout is on the sub-dial, shake to show the seconds hand for selected duration",
      //   "defaultValue":false
      // },
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
      // {
      //   "type": "toggle",
      //   "messageKey": "TZ_MODE",
      //   "label": "Show 2nd Timezone",
      //   "description": "OFF = Don't show, ON = Show",
      //   "defaultValue": false
      // },
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
      // {
      //   "type": "select",
      //   "messageKey": "TZ_ID",
      //   "label": "2nd Timezone",
      //   "description": "Data provided by timeapi.io",
      //   "options": [
      //     { "label": "Select a Zone", "value": "" }
      //     ]
      // },
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
      // {
      //   "type": "select",
      //   "messageKey": "SecondsVisibleTime",
      //   "defaultValue": 135,
      //   "label": "Seconds hand visibility",
      //   "description": "Visibility of seconds hand, in seconds. Timer starts after a tap, shake, or watchface launch. Setting to max value will keep the seconds hand permanently on",
      //   "options": [
      //       { 
      //         "label": "Off", 
      //         "value": 0 
      //       },
      //       { 
      //         "label": "15 seconds",
      //         "value": 15 
      //       },
      //       { 
      //         "label": "30 seconds",
      //         "value": 30 
      //       },
      //       { 
      //         "label": "45 seconds",
      //         "value": 30 
      //       },
      //       { 
      //         "label": "1 minute",
      //         "value": 60 
      //       },
      //       { 
      //         "label": "90 seconds",
      //         "value": 90
      //       },
      //       { 
      //         "label": "2 minutes",
      //         "value": 120
      //       },
      //       { 
      //         "label": "Always on",
      //         "value": 135
      //       }
      //     ]
      // },
      // {
      //   "type": "toggle",
      //   "label": "Logo visible",
      //   "messageKey": "EnableLogo",
      //   "defaultValue": false
      // },
      // {
      //    "type": "input",
      //    "messageKey": "LogoText",
      //    "defaultValue": "tangent",
      //    "label": "Custom Logo Text",
      //    "attributes": {
      //      "placeholder": "tangent"
      //    }
      // },

  
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
        "defaultValue": "Weather"
    },
    {
        "type": "toggle",
        "messageKey": "UseWeather",
        "label": "Show Weather",
        "description": "current & forecast temp & condition icon replaces battery value",
        "defaultValue": false
    },
    {
        "type": "toggle",
        "messageKey": "RefreshWeatherOnLaunch",
        "label": "Refresh Weather on Relaunch",
        "description": "In addition to update interval below, also request fresh weather every time watchface loads. Off = only refresh on the regular interval, keeping last known reading between relaunches",
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
            "label": "OpenWeatherMap",
            "value": "owm"
          }
        ]
      },
      {
        "type": "input",
        "messageKey": "Lat",
        "label": "Manual Location - Latitude",
        "attributes": {
          "placeholder": "eg: 51.4769 (leave blank to use GPS)"
        }
      },
      {
        "type": "input",
        "messageKey": "Long",
        "label": "Manual Location - Longitude",
        "description": "Leave both blank to use GPS location for sunrise & sunset times and weather. You can use <a href =https://www.google.com/maps>Google Maps</a> or <a href =https://www.openstreetmap.org/>OpenStreetMap</a> to find latitude & longitude.",
        "attributes": {
          "placeholder": "eg: -0.0005 (leave blank to use GPS)"
        }
      },
      {
        "type": "input",
        "messageKey": "APIKEY_User",
        "defaultValue": "",
        "label": "OWM API Key",
        "description": "Weather data uses Open-Meteo by default which does not require an API key.  If you prefer OpenWeatherMap, you can <a href =https://home.openweathermap.org/users/sign_up/>register for a free personal API key here</a>.",
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
        "messageKey": "WeatherUnit",
        "label": "Temperature in °C (off) or °F (on)",
        "defaultValue": false
      },
      {
        "type": "submit",
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
            "label": "White Background",
            "value": "wh"
          },
          {
            "label": "Black Background",
            "value": "bl"
          },
          {
              "label": "Blue Background",
              "value": "bu"
          },
          {
              "label": "Purple Background",
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
           "defaultValue": "Custom Colours"
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
        "label": "Seconds Hand Colour",
        "messageKey": "SecondsHandColor",
        "defaultValue": "FF5500"
      },
      {
        "type": "color",
        "label": "Month Hand Colour",
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
        "label": "Date, Battery & Weather Text Colour",
        "messageKey": "DateColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Battery Meter Colour",
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
            "defaultValue": "Custom Colours"
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
        "label": "Hour & Minute Hand & Battery Meter Colour",
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
        "defaultValue": "FFFFFF"
      },
      {
        "type": "color",
        "label": "Hours Digits Colour",
        "messageKey": "BWHourDigitsColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Date, Battery Value & Weather Text Colour",
        "messageKey": "BWDateColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Quiet Time and Bluetooth Icon Colour",
        "messageKey": "BWBTQTColor",
        "defaultValue": "000000"
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
        "label": "Minute Hand & Second/Month Hand Thickness",
        "messageKey": "MinuteHandThickness",
        "description": "Default = 2",
        "defaultValue": 2,
        "min": 1,
        "max": 5,
        "step": 1
      },
      {
        "type": "slider",
        "label": "Hour Hand Thickness",
        "messageKey": "HourHandThickness",
        "description": "Default = 2",
        "defaultValue": 2,
        "min": 1,
        "max": 7,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "label": "Minute Hand Centre Radius",
        "messageKey": "MinuteCentreSize",
        "defaultValue": 4,
        "description": "Default = 4",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "label": "Hour Hand Centre Radius",
        "messageKey": "HourCentreSize",
        "defaultValue": 6,
        "description": "Default = 6",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_EMERY"],
        "label": "Minute Hand Centre Radius",
        "messageKey": "MinuteCentreSize",
        "defaultValue": 7,
        "description": "Default = 7",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_GABBRO"],
        "label": "Minute Hand Centre Radius",
        "messageKey": "MinuteCentreSize",
        "defaultValue": 5,
        "description": "Default = 5",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_EMERY"],
        "label": "Hour Hand Centre Radius",
        "messageKey": "HourCentreSize",
        "defaultValue": 9,
        "description": "Default = 9",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_GABBRO"],
        "label": "Hour Hand Centre Radius",
        "messageKey": "HourCentreSize",
        "defaultValue": 7,
        "description": "Default = 7",
        "min": 1,
        "max": 11,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "label": "Hands Centre Inner Radius",
        "messageKey": "InnerCentreSize",
        "defaultValue": 2,
        "description": "Default = 2",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_GABBRO"],
        "label": "Hands Centre Inner Radius",
        "messageKey": "InnerCentreSize",
        "defaultValue": 2,
        "description": "Default = 2",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT", "NOT_PLATFORM_EMERY"],
        "label": "Hands Centre Inner Radius",
        "messageKey": "InnerCentreSize",
        "defaultValue": 3,
        "description": "Default = 3",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "label": "Hands End Radius",
        "messageKey": "BackSize",
        "defaultValue": 0,
        "description": "Default = 0",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "label": "Hands End Length",
        "messageKey": "BackLen",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
        "defaultValue": 0,
        "description": "Default = 0",
        "min": 0,
        "max": 40,
        "step": 2
      },
      {
        "type": "slider",
        "label": "Hands End Length",
        "messageKey": "BackLen",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "defaultValue": 0,
        "description": "Default = 0",
        "min": 0,
        "max": 30,
        "step": 2
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save"
  },
];