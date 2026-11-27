#pragma once
#include <pebble.h>

#define SETTINGS_KEY 152 // bumped: added ParkHandsSeconds

typedef struct ClaySettings {
  int SecondsVisibleTime;
  bool EnableDate;
  bool EnableBattery;
  bool EnableBatteryLine;
  char VibeMode[4];
  char DateFormat[4];
  bool showMinorTick;
  bool showMajorTick;
  int MinuteCentreSize;
  int HourCentreSize;
  int InnerCentreSize;
  int SecondOuterCentreSize;
  int SecondInnerCentreSize;
  int MinuteHandThickness;
  int HourHandThickness;
  int BackSize;
  int BackLen;
  char BWThemeSelect[4];
  char ThemeSelect[4];
  GColor BackgroundColor1;
  GColor MinuteHandShadowColor;
  GColor MinorTickColor;
  GColor MajorTickColor;
  GColor DateColor;
  GColor BWDateColor;
  GColor BatteryWeatherColor;   // battery value + weather text/icons (date keeps DateColor)
  GColor BWBatteryWeatherColor;
  GColor HourDigitsColor;
  GColor MinutesHandColor;
  GColor MonthHandColor;
  GColor BWMonthHandColor;
  GColor SecondsHandColor;
  GColor BWSecondsHandColor;
  GColor BatteryLineColor;
  GColor BWBackgroundColor1;
  GColor BWMinuteHandShadowColor;
  GColor BWMinHandBatLineColor;
  GColor BWHourDigitsColor;
  GColor BWMajorTickColor;
  GColor BTQTColor;
  GColor BWBTQTColor;
  GColor SubDialColor;
  GColor BWSubDialColor;
  bool BWShadowOn;
  bool ShadowOn;
  bool ForegroundShape;
  bool UseWeather;
  int UpSlider;
  //int WeatherUnit;
  char tempstring[6];
  char temphistring[12];
  char iconnowstring[4];
  bool RainSoon;
  int WBGTLevel; // 0 = none, 1 = Yellow, 2 = Red, 3 = Black
  bool AlwaysShowSubDial;
  bool Roman;
  bool showremoteAMPM;
  int RemoteTimeOffsetMinutes;
  //bool tz_mode;
  //int tz_id;
  int tz_offset;
  //char tz_code[7];
  int SubDialChoice;
  bool SmoothSweep;
  char DateLanguage[6];
  bool RefreshWeatherOnLaunch;
  bool ShowBTQTIcons;
  bool ShowForecast;
  bool ShowCurrent;
  bool ShowAlert;
  int RainAmount; // 0-10, index into the rain-amount icon set (see Weather.c)
  bool HourTicksOnly;
  bool ShakeToRefreshWeather;
  bool ShakeToParkHands; // shake swings the hour hand to 9 and minute hand to 3 for a few seconds
  int ParkHandsSeconds;  // ...for this many seconds
  int BackgroundStyle; // colour platforms only: 0 = flat BackgroundColor1, 1 painted rainbow,
                       // 2 rose rainbow, 3-9 finishes (see prv_picture_resource). Only the flat fill in bg_update_proc is replaced;
                       // BackgroundColor1 is still used everywhere else.
  // Added in 4.3 at the end, so settings saved by older versions still load (see
  // prv_load_settings, which starts these at the minute hand's colour for those).
  GColor HourHandColor;
  GColor BWHourHandColor;
  // Background picture colours (colour watches): painted rainbow 7 stops, rose 4, sunburst
  // main/shadow, fume 1, the other finishes main/highlight. Added after the hour hand colours (see above).
  GColor PicColor1;
  GColor PicColor2;
  GColor PicColor3;
  GColor PicColor4;
  GColor PicColor5;   // painted rainbow stops 5-7
  GColor PicColor6;
  GColor PicColor7;
  // Sweep Second Hand updates per second (1-5); added after the picture colours (see prv_load_settings)
  uint8_t SweepRate;
  // Phone disconnect/reconnect timeline pins (see "Phone-connection timeline log" in nomos.c)
  bool TimelinePins;
  // Steps sub-dial (SubDialChoice 7) target, in thousands of steps (1-20)
  uint8_t StepTarget;
  // Text rows shown above the date while the sub-dial is off: TEXT_ROW_NONE / _TIME / _STEPS
  uint8_t TextRow1;
  uint8_t TextRow2;
  bool ShowAMPM;          // the time row in 12-hour mode: "10:08 PM" rather than "10:08"
  uint8_t StepSeparator;  // the steps row's thousands separator: 0 from the language, 1 ",", 2 ".", 3 none
  // Unused: test builds kept the custom text and timezone labels here before each complication
  // slot had its own (SlotData, below). Left in place so settings saved since keep their layout.
  char ReservedText[12];
  char ReservedLabel2[4];
  char ReservedLabel3[4];
  int32_t reserved_offset3;
  uint8_t TextRowDate1;   // each row's date format, as DateFormat (DATE_FMT_*)
  uint8_t TextRowDate2;
  bool PrecipInches;      // the precipitation row in inches rather than mm
  // From the weather (-1 = not known yet)
  int16_t SunriseMin;     // minutes after midnight
  int16_t SunsetMin;
  int8_t UVNow;
  int8_t UVMax;           // today's maximum
  int8_t PrecipChance;    // % chance of precipitation in the next hour
  int16_t PrecipTenthMm;  // the next hour's precipitation (rain and snow), tenths of a mm
  // The two complication slots at the top (TEXT_ROW_* kinds): where the battery value / current
  // weather and the forecast were. Before these, EnableBattery, ShowCurrent and ShowForecast
  // chose those (see prv_load_settings).
  uint8_t TopSlot1;
  uint8_t TopSlot2;
  uint8_t TopDate1;       // their date formats, as TextRowDate1/2
  uint8_t TopDate2;
  GColor BottomColor;     // the bottom complications (text rows); presets: as BatteryWeatherColor
  GColor BWBottomColor;
  bool LeadingZero12;     // "09:08" rather than "9:08" in 12-hour digital times
  bool LeadingZero24;     // and in 24-hour ones
} __attribute__((__packed__)) ClaySettings;

// Each complication slot's own custom text and time zone (SLOT_TOP1, SLOT_TOP2, SLOT_ROW1,
// SLOT_ROW2), kept under their own key: with them ClaySettings would pass the 256-byte limit.
#define SLOT_DATA_KEY 153
#define SLOT_COUNT 4
typedef struct SlotData {
  char Text[SLOT_COUNT][12];   // TEXT_ROW_CUSTOM, shown in capitals
  char Label[SLOT_COUNT][4];   // TEXT_ROW_TZ2: a short label before the time, e.g. "NYC"
  int32_t Offset[SLOT_COUNT];  // TEXT_ROW_TZ2: offset from UTC in seconds (-1 = unknown)
} __attribute__((__packed__)) SlotData;