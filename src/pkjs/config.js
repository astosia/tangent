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
        "type": "toggle",
        "label": "Month hand visible",
        "messageKey": "EnableMonth",
        "description": "Shows on sub-dial, 12 position = December, 6 = June",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "label": "Seconds hand visible",
        "messageKey": "EnableSecondsHand",
        "description": "Shows on sub-dial",
        "defaultValue": true
      },
      {
        "type": "slider",
        "messageKey": "SecondsVisibleTime",
        "defaultValue": 135,
        "label": "Seconds hand visibility",
        "description": "Visibility of seconds hand, in seconds. Timer starts after a tap, shake, or watchface launch. Setting to max value will keep the seconds hand permanently on",
        "min": 15,
        "max": 135,
        "step": 15
      },
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
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save"
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
        "defaultValue": "FFFFFF"
      },
      {
        "type": "color",
        "label": "Minute & Hour Hand Colour",
        "messageKey": "MinutesHandColor",
        "defaultValue": "FFFFFF"
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
        "label": "Date, Battery & Logo Text Colour",
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
        "label": "Hours Digits Colour",
        "messageKey": "BWHourDigitsColor",
        "defaultValue": "000000"
      },
      {
        "type": "color",
        "label": "Date, Battery Value & Logo Text Colour",
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
        "max": 5,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
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
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
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
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
        "label": "Minute Hand Centre Radius",
        "messageKey": "MinuteCentreSize",
        "defaultValue": 7,
        "description": "Default = 7 on PT2, 9 on PR2",
        "min": 1,
        "max": 15,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
        "label": "Hour Hand Centre Radius",
        "messageKey": "HourCentreSize",
        "defaultValue": 9,
        "description": "Default = 9 on PT2, 11 on PR2",
        "min": 1,
        "max": 15,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "label": "Hands Centre Inner Radius",
        "messageKey": "InnerCentreSize",
        "defaultValue": 1,
        "description": "Default = 1",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
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
        "label": "Hands End Radius",
        "messageKey": "BackSize",
        "defaultValue": 4,
        "description": "Default = 4",
        "min": 0,
        "max": 9,
        "step": 1
      },
      {
        "type": "slider",
        "label": "Hands End Length",
        "messageKey": "BackLen",
        "capabilities": ["NOT_PLATFORM_APLITE", "NOT_PLATFORM_BASALT", "NOT_PLATFORM_CHALK", "NOT_PLATFORM_DIORITE", "NOT_PLATFORM_FLINT"],
        "defaultValue": 28,
        "description": "Default = 28",
        "min": 0,
        "max": 40,
        "step": 2
      },
      {
        "type": "slider",
        "label": "Hands End Length",
        "messageKey": "BackLen",
        "capabilities": ["NOT_PLATFORM_GABBRO", "NOT_PLATFORM_EMERY"],
        "defaultValue": 22,
        "description": "Default = 22",
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