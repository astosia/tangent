#include <pebble.h>
#include <stddef.h>
#include "nomos.h"
#include "utils/weekday.h"
#include "utils/month.h"
#include "utils/MathUtils.h"
#include "utils/Weather.h"
// fctx is kept in src/c/fctx (pebble-fctx 1.6.5, changed so its anti-aliasing can be drawn in bands
// of the screen where there isn't memory for all of it: see prv_fill_text and src/c/fctx/README.md)
#include "fctx/fctx.h"
#include "fctx/fpath.h"
#include "fctx/ffont.h"

// Weather (and the extra layers/fonts/settings it needs) is built for every watch. The HAS_WEATHER
// blocks are kept so it's easy to leave a platform out again (e.g. if aplite runs short of memory).
#define HAS_WEATHER

#ifndef ARRAY_LENGTH
  #define ARRAY_LENGTH(a) (sizeof(a) / sizeof((a)[0]))
#endif

////remember to comment out before publishing!!!!
//#define BACKLIGHTON   ///Use this for ShareX screencapture GIFs
//#define DEBUG         ///Use this for debugging and showing max size of complications
////remember to comment out before publishing!!!!
#define SECONDS_TICK_INTERVAL_MS 1000
#define SWEEP_RATE_DEFAULT 5   // Sweep Second Hand: second-hand updates per second (settings.SweepRate)

// Sub-dial options (settings.SubDialChoice) added with the steps meter; 0-6 are as before
#define SUBDIAL_STEPS_TARGET 7    // today's steps vs your target (settings.StepTarget)
#define SUBDIAL_STEPS_AVERAGE 8   // today's steps vs your average day, with a marker for your usual pace
#define STEP_TARGET_DEFAULT 10    // thousands of steps
#define STEPS_MARKER_HALF_DEG 12  // half the width of the sub-dial's "usual by now" marker

// aplite has only 24KB for everything, so it keeps the original fixed top layout (the battery
// value or current weather, and the forecast: EnableBattery, ShowCurrent, ShowForecast) and has no
// complication slots, text rows, phone battery, Pebble app complications or timeline pins.
#ifndef PBL_PLATFORM_APLITE
#define HAS_COMPLICATIONS
#define HAS_TIMELINE_PINS
#endif
#ifdef HAS_COMPLICATIONS
#define SHOW_TOP_BATTERY() (settings.TopSlot1 == TEXT_ROW_BATTERY)
#define SHOW_TOP_WEATHER() (settings.TopSlot1 == TEXT_ROW_WEATHER)
#define SHOW_TOP_FORECAST() (settings.TopSlot2 == TEXT_ROW_FORECAST)
#else
#define SHOW_TOP_BATTERY() (settings.EnableBattery && !(settings.UseWeather && settings.ShowCurrent))
#define SHOW_TOP_WEATHER() (settings.ShowCurrent)
#define SHOW_TOP_FORECAST() (settings.ShowForecast)
#endif

// What a complication slot shows: the two at the top (settings.TopSlot1/2) and the two text rows
// above the date (settings.TextRow1/2, while the sub-dial is off)
#define TEXT_ROW_NONE 0
#define TEXT_ROW_TIME 1
#define TEXT_ROW_STEPS 2
#define TEXT_ROW_BATTERY 3      // "80%"
#define TEXT_ROW_SUNRISE 4      // the weather's sunrise, with its icon
#define TEXT_ROW_SUNSET 5
#define TEXT_ROW_SUN_NEXT 6     // whichever of sunrise or sunset comes next
#define TEXT_ROW_UV 7           // "UV 3 | 6": now | today's maximum
#define TEXT_ROW_PRECIP 8       // "30% | 1.2MM": chance | amount in the next hour
#define TEXT_ROW_TZ2 9          // the slot's own time zone, "NYC 05:08"
#define TEXT_ROW_TZ3 10         // (test builds' 3rd timezone: now the same as TEXT_ROW_TZ2)
#define TEXT_ROW_CUSTOM 11      // the slot's own text
#define TEXT_ROW_DATE 12        // in the slot's own date format
#define TEXT_ROW_WEATHER 13     // the current weather's icon and temperature
#define TEXT_ROW_FORECAST 14    // today's high | low
#define TEXT_ROW_PHONE_BATTERY 15  // the phone's battery, from the Pebble app's phone plugin (index.js)
#define TEXT_ROW_APP_FIRST 16   // 16-20: the 1st-5th reading on the Pebble app's Complications list,
#define TEXT_ROW_APP_LAST 20    // whatever plugin gives it (index.js sends it as text)
#define TEXT_ROW_LAST TEXT_ROW_APP_LAST
// The slots, as indexes into SlotData
#define SLOT_TOP1 0
#define SLOT_TOP2 1             // between the alert icons: short items only (custom text up to 5)
#define SLOT_ROW1 2
#define SLOT_ROW2 3
#define SLOT_TOP2_TEXT_MAX 5

// Date formats (settings.DateFormat for the date at the bottom, TextRowDate1/2 for the rows)
#define DATE_FMT_WEEKDAY_DAY 0  // WED 30
#define DATE_FMT_MONTH_DAY 1    // AUG 30
#define DATE_FMT_DAY_MONTH 2    // 30 AUG
#define DATE_FMT_DAY 3          // 9
#define DATE_FMT_DAY2 4         // 09
#define DATE_FMT_WEEK 5         // WK 48, KW 48, V 48... (ISO week: weeks start on Monday, week 1 holds the first Thursday)
#define DATE_FMT_WEEKDAY 6      // WED
#define DATE_FMT_MONTH 7        // AUG
#define DATE_FMT_LAST DATE_FMT_MONTH
#define CUSTOM_TEXT_DEFAULT "TANGENT"
#define TEXT_ROW_EM_PCT 75    // their size, of the date's
#define TEXT_ROW_CAP_PCT 80   // Tangent's capitals are 0.8 em tall (cap-height in the ffonts)
#define TEXT_ROW_GAP_PCT 45   // the gap between the rows, of the capitals' height
#define TOP_SLOT_CAP_MIDDLE_PCT 45 // the top slots: the capitals' middle, this % of the em below fctx's "top" anchor
#define TEXT_ROW_ICON_TOP_PCT 69 // an icon's box top sits this % of its pixel size above the text's cap middle:
                                // as gabbro's current weather icon sits against its temperature
#if defined(PBL_PLATFORM_EMERY) || defined(PBL_PLATFORM_GABBRO)
#define WEATHER_ICON_PX 20     // FONT_WEATHERICONS_20
#define SUN_ICON_PX 16         // FONT_SUNICONS_16
#define PHONE_ICON_PX 16       // FONT_PHONEICON_16
#else
#define WEATHER_ICON_PX 16     // FONT_WEATHERICONS_16
#define SUN_ICON_PX 12         // FONT_SUNICONS_12
#define PHONE_ICON_PX 12       // FONT_PHONEICON_12
#endif
// The phone icon (dripicons' device-mobile, a full em tall from the baseline): its box top this %
// of its size above the text's cap middle, which centres it on the capitals as the sun icons are
#define PHONE_ICON_TOP_PCT 54
#define PHONE_ICON "$"

// A setting sent as a number or as text ("1"): Clay sends select values as text, sliders as numbers
static int prv_tuple_int(const Tuple *t) {
  return t->type == TUPLE_CSTRING ? atoi(t->value->cstring) : (int)t->value->int32;
}


// Main window and layers
static Window *s_window;
static Layer *s_canvas_layer;
static Layer *s_bg_layer;
static Layer *s_dial_layer;
static Layer *s_date_battery_logo_layer;
static Layer *s_canvas_second_hand;
static Layer *s_canvas_month_hand;
static Layer *s_canvas_tz;
static Layer *s_canvas_comp_bg;
static Layer *s_canvas_bt_icon;
static Layer *s_canvas_qt_icon;
static Layer *s_canvas_battery;
#ifdef HAS_WEATHER
static Layer *s_canvas_weather;
#endif

// ---- Saved face (battery saver for the seconds hand) -------------------------
// Pebble redraws every layer whenever any one of them changes, so with the seconds hand on the
// whole face - background picture, ticks, anti-aliased digits and date, weather - was redrawn
// every second (5 times a second with Sweep). Now the face minus the hands is saved whenever
// something other than a hand changes, and each seconds frame just copies it back and draws the
// seconds hand and hour/minute hands on top (see bg_update_proc and face_capture_update_proc).
// Aplite hasn't the memory to spare, so it draws everything every time as before.
#ifndef PBL_PLATFORM_APLITE
#define FACE_CACHE
#define FACE_CACHE_HEAP_MARGIN 2048   // leave at least this much heap free when keeping the saved face
static Layer *s_face_capture_layer;
static uint8_t *s_face_cache;          // the screen's bytes, row after row
static bool s_face_cache_valid;        // false as soon as anything but a hand needs redrawing
static bool s_face_cache_seconds;      // showSeconds when it was saved (the sub-dial depends on it)
static GRect s_face_cache_unobstructed;// Quick View state when it was saved
static bool s_fast_frame;              // this frame only redraws the hands
#define SKIP_ON_FAST_FRAME() do { if (s_fast_frame) { return; } } while (0)

// Every layer_mark_dirty / layer_set_hidden in this file goes through these (see the #defines),
// so any change other than to the hands throws the saved face away.
static void prv_mark_dirty(Layer *layer) {
  if (layer != s_canvas_second_hand && layer != s_canvas_layer) {
    s_face_cache_valid = false;
  }
  layer_mark_dirty(layer);
}
static void prv_set_hidden(Layer *layer, bool hidden) {
  if (layer_get_hidden(layer) != hidden) {
    s_face_cache_valid = false;
  }
  layer_set_hidden(layer, hidden);
}
#define layer_mark_dirty(layer) prv_mark_dirty(layer)
#define layer_set_hidden(layer, hidden) prv_set_hidden(layer, hidden)
#else
#define SKIP_ON_FAST_FRAME() do { } while (0)
#endif

struct tm g_local_time;
struct tm g_remote_time; //second timezone settings

// Fonts
static GFont
    #ifdef PBL_PLATFORM_APLITE
    FontDate,
    FontBattery,
    FontLogo,
    FontHour,
    #endif
    FontBTQTIcons;

#ifdef HAS_COMPLICATIONS
static GFont FontPhoneIcon;   // the phone battery complication's icon

// The phone's battery (0-100), as the phone last sent it; -1 until it does (not kept: the phone
// sends it again whenever the watchface starts)
static int8_t s_phone_battery = -1;

// The Pebble app's complications (TEXT_ROW_APP_*), as text the phone last sent: kept, so they
// still show after a restart while the phone is away (an estimate like Muninn's stays useful)
#define APP_TEXT_KEY 154
#define APP_TEXT_COUNT 5
static char s_app_text[APP_TEXT_COUNT][16];
#endif

#ifdef HAS_WEATHER
static GFont
    FontWeatherIcons,
    FontSunIcons;   // the text rows' sunrise/sunset icons: 16px on emery/gabbro, 12px (in step with the smaller text) elsewhere
#endif

FFont* FCTX_Font;
// Time and date variables
static struct tm *prv_tick_time;
static time_t g_current_epoch;
static int current_date;
static int s_weekday;
static int minutes;
static int hours;   //12h modulo
static int s_hours; //24h version
static int s_month;
static int seconds;
static bool showSeconds;
#ifdef HAS_WEATHER
// Weather schedule: due once UpSlider minutes have passed since the last weather that actually
// arrived (s_last_weather_fetch, saved across relaunches). Being anchored to the last success
// rather than a countdown means relaunching the face, a reconnect or a settings save can't push
// the next update back. A request that gets no reply is retried after WEATHER_RETRY_SEC.
static time_t s_last_weather_request = 0;   // when the watch last asked (any reason); 0 = not yet
#define WEATHER_RETRY_SEC (5 * 60)
static time_t s_last_weather_fetch = 0;
// Stored separately from ClaySettings/SETTINGS_KEY since it's local
#define WEATHER_FETCH_EPOCH_KEY 248
#define WEATHER_STALE_ICON "\U0000F03E"       // shown when the data is old and no refresh is in flight
#define WEATHER_REFRESHING_ICON "\U0000F04C"  // shown while a refresh is in flight
// s_weather_refreshing is true (and WEATHER_REFRESHING_ICON shows) while EITHER of these is true,
// so a refresh always shows for at least the minimum time even if the reply is instant, and never
// shows for longer than the timeout even if the phone never replies at all.
static bool s_weather_refreshing = false;
static bool s_weather_min_display_active = false;   // minimum display time hasn't elapsed yet
static bool s_weather_awaiting_response = false;    // no reply yet, and haven't given up yet
static AppTimer *s_weather_min_display_timer = NULL;
static AppTimer *s_weather_response_timeout_timer = NULL;
#define WEATHER_REFRESH_MIN_DISPLAY_MS 1000  // always show "refreshing" for at least this long
#define WEATHER_REFRESH_TIMEOUT_MS 15000     // give up waiting for a reply after this long
static AppTimer *s_weather_reconnect_timer = NULL;
#define WEATHER_RECONNECT_DELAY_MS 3000      // give the phone's companion app time to come back
                                              // up before asking it for weather (see comment on
                                              // bluetooth_connection_handler below)
static time_t s_last_manual_weather_request = 0;
#define WEATHER_MANUAL_REFRESH_COOLDOWN_SEC 60  // don't let repeated shakes spam the phone/API
// With Shake to Move Hands Aside on too, one shake moves the hands and a second shake within
// 2 seconds refreshes the weather. Taps closer together than the minimum gap are treated as
// the same shake (one flick of the wrist can register more than once).
#define WEATHER_DOUBLE_SHAKE_WINDOW_MS 2000
#define WEATHER_DOUBLE_SHAKE_MIN_GAP_MS 400
static int64_t s_last_shake_ms = 0;   // 0 = no first shake waiting for its second
// Shake to move the hands aside (ShakeToParkHands): while s_hands_parked is true the hour hand
// points to 9 and the minute hand to 3 - a flat bar across the dial - so they don't cover the
// weather, for settings.ParkHandsSeconds. Another shake while parked restarts the time.
static bool s_hands_parked = false;
static AppTimer *s_park_hands_timer = NULL;
#define PARK_HANDS_MIN_SECONDS 1
#define PARK_HANDS_MAX_SECONDS 60
#endif
static ClaySettings settings;
#ifdef HAS_COMPLICATIONS
static SlotData s_slots;
#endif


// Date position struct for different platforms
typedef struct {
  int DateBottomYPosition;
  int yOffset;
  int yOffsetFctx;
  int yWeekdayDateOffset;
  int WeekdayDateHeight;
  int BatteryYOffset;
  int BatteryLineYOffset;
  int font_size_digits;
  int font_size_battery;
  int font_size_date;
  int battery_pos_z;
  int battery_pos_y;
  int battery_line;
  int analogue_hand_a;
  int analogue_hand_b;
  int analogue_hand_c;
  int hands_shadow;
  int corner_radius_minutehand;
  int corner_radius_hourhand;
  int corner_radius_majortickrect;
  int corner_radius_minortickrect;
  int majortickrect_w;
  int majortickrect_h;
  int minortickrect_w;
  int minortickrect_h;
  int majorticklength;
  int majorticklengthinner;
  int outertickinset;
  int innertickinset;
  int tick_inset_outer;
  int tick_inset_inner;
  int HourCentreOuterRadius;
  int HourCentreInnerRadius;
  int hour_hand_p2x;
  int hour_hand_p2y;
  int min_hand_p2x;
  int min_hand_p2y;
  int digit_inset;
  int second_hand_a;
  int second_hand_b;
  int seconds_circle_radius;
  int seconds_circle_centre_x;
  int seconds_circle_centre_y;
  int SecondHandCentreOuterRadius;
  int SecondHandCentreInnerRadius;
  //GRect battery_arc_bounds[1];
  int romanadjust;
  GRect IconNowRect[1];
  GRect IconNowRect2[1];
  GRect RainIconRect[1];
  GRect WarningIconRect[1];
  GRect BTIconRect[1];
  GRect QTIconRect[1];
  int forecast_offset;     // weather: forecast text this far below the battery text (fctx)
  int weather_temp_grow;   // weather: current temperature is this much bigger than the battery text
} UIConfig;

#ifdef PBL_PLATFORM_EMERY
static const UIConfig config = {
.DateBottomYPosition = 60, //was 168
.yOffset = -8,
.yOffsetFctx = 3,
.yWeekdayDateOffset = 1 + 30- 4,
.WeekdayDateHeight = 13,
.BatteryYOffset = 53-4 +3-1-2 + 2 +2,
.BatteryLineYOffset = 66 + 6 + 4 + 2,
.font_size_digits = 40,
.digit_inset = 14,
.font_size_battery = 20,
.font_size_date = 24 + 4,
.battery_pos_z = -2+2,
.battery_pos_y = 4+2,
.battery_line = 63, //sized to the width of the default logo 
.analogue_hand_a = 1,  //was 20
.analogue_hand_b = 0,  //was28
.analogue_hand_c = 1,
.hands_shadow = 2,
.corner_radius_minutehand = 20,
.corner_radius_hourhand = 10,
.corner_radius_majortickrect = 20,
.corner_radius_minortickrect = 20,
.majortickrect_w = 86 + 4 + 4,
.majortickrect_h = 100 + 4 + 4,
.minortickrect_w = 90 + 4 + 2,
.minortickrect_h = 104 + 4 + 2,
.outertickinset = 6,
.innertickinset = 12,
.majorticklength = 6,
.majorticklengthinner = 30,
.tick_inset_outer = -10,
.tick_inset_inner = 30,
.HourCentreOuterRadius = 7,
.HourCentreInnerRadius = 2,
.SecondHandCentreOuterRadius = 5,
.SecondHandCentreInnerRadius = 2,
.hour_hand_p2x = 50,
.hour_hand_p2y = 50,
.min_hand_p2x = 12,
.min_hand_p2y = 12,
.second_hand_a = 22 + 3+ 1,
.second_hand_b = 0,
.seconds_circle_radius = 24+3+1,
.seconds_circle_centre_x = 100,
.seconds_circle_centre_y = 163-2-8+1,
//  .battery_arc_bounds = {{{51,98},{37,37}}},        //UV arc, right of centre, middle row
.romanadjust = 2,
.IconNowRect = {{{0,48},{98,22}}},
.IconNowRect2 = {{{0,52},{98,22}}},
.RainIconRect = {{{48,81},{40,22}}},
.WarningIconRect = {{{132,83},{40,22}}},
.BTIconRect = {{{53,21},{44,20}}},
.QTIconRect = {{{106,20},{44,20}}},
.forecast_offset = 28,
.weather_temp_grow = 6
};
#elif defined(PBL_PLATFORM_GABBRO)
static const UIConfig config = {
.DateBottomYPosition = 67, //168+22+3,
.yOffset = -8,
.yOffsetFctx = 3,
.yWeekdayDateOffset = 1 + 32 - 4,
.WeekdayDateHeight = 13,
.BatteryYOffset = 53-4 +3-1 + 11 - 2 + 2 + 2,
.BatteryLineYOffset = 66 + 6 + 11 + 4 ,
.font_size_digits = 48,
.digit_inset = 31,
.font_size_battery = 20,
.font_size_date = 28 + 4,
.battery_pos_z = -2,
.battery_pos_y = 4,
.battery_line = 63,
.analogue_hand_a = 3+8,
.analogue_hand_b = 0,  //was 32
.hands_shadow = 2,
.analogue_hand_c = 1,
.outertickinset = 6,
.innertickinset = 12,
.majorticklength = 6,
.majorticklengthinner = 36,
.HourCentreOuterRadius = 9,
.HourCentreInnerRadius = 3,
.SecondHandCentreOuterRadius = 5,
.SecondHandCentreInnerRadius = 2,
.hour_hand_p2x = 0,
.hour_hand_p2y = 0,
.min_hand_p2x = 0,
.min_hand_p2y = 0,
.second_hand_a = 28 + 2-1,
.second_hand_b = 0,
.seconds_circle_radius = 30 + 1,
.seconds_circle_centre_x = 130,
.seconds_circle_centre_y = 189-6-6-1-1,
//  .battery_arc_bounds = {{{80,112},{37,37}}},        //UV arc, right of centre, middle row
.romanadjust = 0,
.IconNowRect = {{{0,60},{128,22}}},
.IconNowRect2 = {{{0,64},{128,22}}},
.RainIconRect = {{{75,90},{40,22}}},
.WarningIconRect = {{{165,91},{40,22}}},
.BTIconRect = {{{78,23},{44,20}}},
.QTIconRect = {{{140,22},{44,20}}},
.forecast_offset = 28,
.weather_temp_grow = 6
};
#elif defined(PBL_BW)
static const UIConfig config = {
.DateBottomYPosition = 40, //126-3+5,
.yOffset = -7,
.yOffsetFctx = 2,
.yWeekdayDateOffset = 18 - 2,
.WeekdayDateHeight = 11,
.BatteryYOffset = 40-4 +4 -3,
.BatteryLineYOffset = 49 + 6 +4 -3,
.font_size_digits = 28,   // same as basalt
.digit_inset = 10,
.font_size_battery = 16,
.font_size_date = 18 + 2,
.battery_pos_z = 0,
.battery_pos_y = 4,
.battery_line = 51,
.analogue_hand_a = 1,
.analogue_hand_b = 0,  //was22
.analogue_hand_c = 1,
.hands_shadow = 1,
.corner_radius_minutehand = 15,
.corner_radius_hourhand = 6,
.corner_radius_majortickrect = 15,
.corner_radius_minortickrect = 15,
.majortickrect_w = 62 + 8,
.majortickrect_h = 72 + 8,
.minortickrect_w = 66 + 4,
.minortickrect_h = 76 + 4,
.outertickinset = 6,
.innertickinset = 10,
.majorticklength = 6,
.majorticklengthinner = 14,
.tick_inset_outer = -10,
.tick_inset_inner = 20,
.HourCentreOuterRadius = 6,
.HourCentreInnerRadius = 2,
.SecondHandCentreOuterRadius = 4,
.SecondHandCentreInnerRadius = 1,
.hour_hand_p2x = 36,
.hour_hand_p2y = 36,
.min_hand_p2x = 8,
.min_hand_p2y = 8,
.second_hand_a = 17,
.second_hand_b = 0,
.seconds_circle_radius = 18,
.seconds_circle_centre_x = 72,
.seconds_circle_centre_y = 117-3,
//  .battery_arc_bounds = {{{76,48},{24,24}}},        //UV arc, right of centre, middle row
.romanadjust = 1,
.BTIconRect = {{{36,16},{36,20}}},
.QTIconRect = {{{75,16},{36,20}}},
// Weather, scaled from emery's layout around the battery position; 16px weather icons.
// aplite draws its temperatures with graphics_draw_text instead of fctx - see weather_update_proc.
.IconNowRect = {{{0,32},{70,18}}},
.IconNowRect2 = {{{0,36},{70,18}}},
.RainIconRect = {{{30,56},{30,18}}},
.WarningIconRect = {{{97,57},{30,18}}},
.forecast_offset = 23 -2,
.weather_temp_grow = 4

};
#elif defined(PBL_ROUND)
static const UIConfig config = {
.DateBottomYPosition = 48, //132,
.yOffset = -7,
.yOffsetFctx = 2,
.yWeekdayDateOffset = 1 + 24 - 4,
.WeekdayDateHeight = 11,
.BatteryYOffset = 40-4 +4 +2,
.BatteryLineYOffset = 49 + 6 +4 +2,
.font_size_digits = 32,
.digit_inset = 23,
.font_size_battery = 16,
.font_size_date = 18 + 4,
.battery_pos_z = 0,
.battery_pos_y = 4,
.battery_line = 51,
.analogue_hand_a = 10,
.analogue_hand_b = 0, //was22
.hands_shadow = 2,
.analogue_hand_c = 0,
.outertickinset = 6,
.innertickinset = 11,
.majorticklength = 6,
.majorticklengthinner = 22,
.HourCentreOuterRadius = 6,
.HourCentreInnerRadius = 2,
.SecondHandCentreOuterRadius = 4,
.SecondHandCentreInnerRadius = 1,
.hour_hand_p2x = 0,
.hour_hand_p2y = 0,
.min_hand_p2x = 0,
.min_hand_p2y = 0,
.second_hand_a = 20,
.second_hand_b = 0,
.seconds_circle_radius = 21,
.seconds_circle_centre_x = 90,
.seconds_circle_centre_y = 128-2-5,
  //  .battery_arc_bounds = {{{55,79},{24,24}}},        //UV arc, right of centre, middle row
.romanadjust = 0,
.BTIconRect = {{{54,17},{32,20}}},
.QTIconRect = {{{97,16},{32,20}}},
// Weather, scaled from emery's layout around the battery position; 16px weather icons.
.IconNowRect = {{{0,37},{88,18}}},
.IconNowRect2 = {{{0,41},{88,18}}},
.RainIconRect = {{{48,61},{30,18}}},
.WarningIconRect = {{{115,62},{30,18}}},
.forecast_offset = 23 -2,   // BatteryYOffset is 2 lower here, so the forecast stays put
.weather_temp_grow = 4
};
#else // Default for other platforms
static const UIConfig config = {
.DateBottomYPosition = 40, //126-3+5,
.yOffset = -7,
.yOffsetFctx = 2,
.yWeekdayDateOffset = 18 - 2,
.WeekdayDateHeight = 11,
.BatteryYOffset = 40-4 +4 -3,
.BatteryLineYOffset = 49 + 6 +4 -3,
.font_size_digits = 28,
.digit_inset = 10,
.font_size_battery = 16,
.font_size_date = 18 + 2,
.battery_pos_z = 0,
.battery_pos_y = 4,
.battery_line = 51,
.analogue_hand_a = 1,
.analogue_hand_b = 0, //was  22
.analogue_hand_c = 1,
.hands_shadow = 2,
.corner_radius_minutehand = 15,
.corner_radius_hourhand = 6,
.corner_radius_majortickrect = 15,
.corner_radius_minortickrect = 15,
.majortickrect_w = 62 + 8,
.majortickrect_h = 72 + 8,
.minortickrect_w = 66 + 4,
.minortickrect_h = 76 + 4,
.outertickinset = 6,
.innertickinset = 10,
.majorticklength = 6,
.majorticklengthinner = 14,
.tick_inset_outer = -10,
.tick_inset_inner = 20,
.HourCentreOuterRadius = 6,
.HourCentreInnerRadius = 2,
.SecondHandCentreOuterRadius = 4,
.SecondHandCentreInnerRadius = 1,
.hour_hand_p2x = 36,
.hour_hand_p2y = 36,
.min_hand_p2x = 8,
.min_hand_p2y = 8,
.second_hand_a = 16,
.second_hand_b = 0,
.seconds_circle_radius = 18,
.seconds_circle_centre_x = 72,
.seconds_circle_centre_y = 117-3,
  //  .battery_arc_bounds = {{{37,75},{24,24}}},        //UV arc, right of centre, middle row
.romanadjust = 1,
.BTIconRect = {{{36,16},{36,20}}},
.QTIconRect = {{{75,16},{36,20}}},
// Weather, scaled from emery's layout around the battery position; 16px weather icons.
.IconNowRect = {{{0,32},{70,18}}},
.IconNowRect2 = {{{0,36},{70,18}}},
.RainIconRect = {{{30,56},{30,18}}},
.WarningIconRect = {{{97,57},{30,18}}},
.forecast_offset = 23 -2,
.weather_temp_grow = 4
};
#endif

bool connected = true;
bool ignore_next_tap = false;

//function prototypes

static inline FPoint clockToCartesian(FPoint center, fixed_t radius, int32_t angle) {
    FPoint pt;
    int32_t c = cos_lookup(angle);
    int32_t s = sin_lookup(angle);
    pt.x = center.x + s * radius / TRIG_MAX_RATIO;
    pt.y = center.y - c * radius / TRIG_MAX_RATIO;
    return pt;
}


static void prv_save_settings(void);
static void prv_default_settings(void);
static void prv_load_settings(void);
static void prv_inbox_received_handler(DictionaryIterator *iter, void *context);
static void tick_handler(struct tm *tick_time, TimeUnits units_changed);
static void update_time_state(struct tm *tick_time);
static void refresh_current_time(void);
static void bg_update_proc(Layer *layer, GContext *ctx);
#ifdef HAS_WEATHER
static void weather_update_proc(Layer *layer, GContext *ctx);
static void prv_request_weather_update(void);
static void prv_weather_min_display_callback(void *data);
static void prv_weather_refresh_timeout_callback(void *data);
#endif
static void update_logo_date_battery_fctx_layer(Layer *layer, GContext * ctx);
static void layer_update_proc_battery_line(Layer *layer, GContext * ctx);
static void layer_update_proc_seconds_hand(Layer *layer, GContext * ctx);
static void hour_min_hands_canvas_update_proc(Layer *layer, GContext *ctx);
static void layer_update_proc_qt(Layer *layer, GContext *ctx);
static void layer_update_proc_bt(Layer *layer, GContext *ctx);
static void draw_minute_hand(GContext *ctx, int angle, int length, int back_length, int rect_length_x, int rect_length_y, int corner_radius, GColor color);
static void draw_hour_hand(GContext *ctx, int angle, int length, int back_length, int rect_length_x, int rect_length_y, int corner_radius, GColor color);
static void draw_seconds_month_background(GContext *ctx);
static void draw_month_hand(GContext *ctx, int angle, int length, int back_length, GColor color);
static void draw_second_hand(GContext *ctx, int angle, int length, int back_length, GColor color);
static void draw_seconds_center(GContext *ctx, GColor minutes_color, GColor seconds_color);
static void draw_hand_center(GContext *ctx, GColor outer_color, GColor inner_color);
static void prv_window_load(Window *window);
static void prv_window_unload(Window *window);
static void prv_init(void);
static void prv_deinit(void);
#ifdef PBL_COLOR
static void prv_set_picture_default_colours(int style);
#endif

// Save settings to persistent storage
static void prv_save_settings(void) {
  persist_write_data(SETTINGS_KEY, &settings, sizeof(settings));
  #ifdef HAS_COMPLICATIONS
  persist_write_data(SLOT_DATA_KEY, &s_slots, sizeof(s_slots));
  #endif
}


// Set default settings
// The settings added with the extra text-row options, as for a fresh install
static void prv_default_row_settings(void) {
  settings.ReservedText[0] = settings.ReservedLabel2[0] = settings.ReservedLabel3[0] = 0;
  settings.reserved_offset3 = 0;
  settings.TextRowDate1 = settings.TextRowDate2 = DATE_FMT_WEEKDAY_DAY;
  settings.PrecipInches = false;
  settings.SunriseMin = settings.SunsetMin = -1;
  settings.UVNow = settings.UVMax = settings.PrecipChance = -1;
  settings.PrecipTenthMm = -1;
}

#ifdef HAS_COMPLICATIONS
// Each slot's custom text and time zone, as for a fresh install
static void prv_default_slot_data(void) {
  for (int i = 0; i < SLOT_COUNT; i++) {
    snprintf(s_slots.Text[i], sizeof(s_slots.Text[i]), "%s", CUSTOM_TEXT_DEFAULT);
    s_slots.Label[i][0] = 0;
    s_slots.Offset[i] = 0;
  }
  s_slots.Text[SLOT_TOP2][SLOT_TOP2_TEXT_MAX] = 0;
}
#endif

static void prv_default_settings(void) {
  settings.AlwaysShowSubDial = false;
  settings.SecondsVisibleTime = 15;
  settings.EnableDate = false;
  settings.EnableBattery = true;
  settings.EnableBatteryLine = true;
  settings.BackgroundColor1 = GColorOxfordBlue;
  settings.SubDialColor = GColorOxfordBlue;
  settings.MinuteHandShadowColor = GColorBlack;
  settings.MinorTickColor = GColorPictonBlue;
  settings.DateColor = GColorYellow;
  settings.BatteryWeatherColor = GColorYellow;
  settings.HourDigitsColor = GColorYellow;
  settings.MinutesHandColor = GColorWhite;
  settings.HourHandColor = GColorWhite;
  settings.MajorTickColor = GColorYellow;
  settings.SecondsHandColor = GColorRed;
  settings.MonthHandColor = GColorRed;
  settings.BWSecondsHandColor = GColorWhite;
  settings.BWMonthHandColor = GColorWhite;
  settings.BatteryLineColor = GColorOrange;
  settings.BWDateColor = GColorWhite;
  settings.BWBatteryWeatherColor = GColorWhite;
  settings.BottomColor = settings.BatteryWeatherColor;
  settings.BWBottomColor = settings.BWBatteryWeatherColor;
  settings.LeadingZero12 = false;
  settings.LeadingZero24 = true;
  settings.BWBackgroundColor1 = GColorBlack;
  settings.BWSubDialColor = GColorBlack;
  settings.BWMinuteHandShadowColor = GColorDarkGray;
  settings.BWMinHandBatLineColor = GColorWhite;
  settings.BWHourHandColor = GColorWhite;
  settings.BWHourDigitsColor = GColorWhite;
  settings.BWMajorTickColor = GColorWhite;
  settings.BTQTColor = GColorPictonBlue;
  settings.BWBTQTColor = GColorWhite;
  settings.showMajorTick = true;
  settings.showMinorTick = true;
  snprintf(settings.BWThemeSelect, sizeof(settings.BWThemeSelect), "%s", "bl");
  snprintf(settings.ThemeSelect, sizeof(settings.ThemeSelect), "%s", "bu");
  settings.BWShadowOn = true;
  settings.ShadowOn = true;
  snprintf(settings.VibeMode, sizeof(settings.VibeMode), "%s", "0");
  snprintf(settings.DateFormat, sizeof(settings.DateFormat), "%s", "0");
  settings.ForegroundShape = true;  //true = round, false = rect
  settings.MinuteCentreSize = config.HourCentreOuterRadius - 2;
  settings.HourCentreSize = config.HourCentreOuterRadius;
  settings.InnerCentreSize = config.HourCentreInnerRadius;
  settings.SecondOuterCentreSize = config.SecondHandCentreOuterRadius;
  settings.SecondInnerCentreSize = config.SecondHandCentreInnerRadius;
  settings.MinuteHandThickness = 2;
  settings.HourHandThickness = 2;
  settings.BackSize = 4;
  settings.BackLen = config.analogue_hand_b;
  settings.Roman = false;
  settings.HourTicksOnly = false;
  settings.SubDialChoice = 0;
  settings.tz_offset = 0;
  settings.showremoteAMPM = true;
  settings.SmoothSweep = false;
  settings.SweepRate = SWEEP_RATE_DEFAULT;
  settings.TimelinePins = false;
  settings.StepTarget = STEP_TARGET_DEFAULT;
  settings.TextRow1 = TEXT_ROW_NONE;
  settings.TextRow2 = TEXT_ROW_NONE;
  settings.ShowAMPM = false;
  settings.StepSeparator = 0;
  prv_default_row_settings();
  settings.TopSlot1 = TEXT_ROW_BATTERY;
  settings.TopSlot2 = TEXT_ROW_FORECAST;
  settings.TopDate1 = settings.TopDate2 = DATE_FMT_WEEKDAY_DAY;
  #ifdef HAS_COMPLICATIONS
  prv_default_slot_data();
  #endif
  snprintf(settings.DateLanguage, sizeof(settings.DateLanguage), "%s", "auto");
  settings.ShowBTQTIcons = true;
  #ifdef PBL_COLOR
  settings.BackgroundStyle = 0;
  #ifdef PBL_COLOR
  prv_set_picture_default_colours(0);
  #endif
  #endif

  #ifdef HAS_WEATHER

  settings.UseWeather = false;
  settings.UpSlider = 30;
  settings.RainSoon = false;
  settings.RainAmount = 0;
  settings.WBGTLevel = 0;
  settings.RefreshWeatherOnLaunch = false;
  settings.ShakeToRefreshWeather = true;
  settings.ShakeToParkHands = false;
  settings.ParkHandsSeconds = 5;
  settings.ShowForecast = true;
  settings.ShowCurrent = true;
  settings.ShowAlert = true;

  #endif


  
}



static int REMOTE_TIME_OFFSET_HOURS = 0;
static int REMOTE_TIME_OFFSET_MINUTES = 0;

static void update_offset_vars(int32_t total_seconds) {
  
    int32_t abs_seconds = (total_seconds < 0) ? -total_seconds : total_seconds;

    REMOTE_TIME_OFFSET_HOURS = abs_seconds / 3600;
    REMOTE_TIME_OFFSET_MINUTES = (abs_seconds % 3600) / 60;
    
    // Keep signage for hours if negative:
    if (total_seconds < 0) {
        REMOTE_TIME_OFFSET_HOURS = -REMOTE_TIME_OFFSET_HOURS;
    }
}

// Quiet time icon handler
static void quiet_time_icon () {
    #ifdef BACKLIGHTON
    layer_set_hidden(s_canvas_qt_icon, quiet_time_is_active());
    #else
    layer_set_hidden(s_canvas_qt_icon, !settings.ShowBTQTIcons || !quiet_time_is_active());
    #endif
}

static AppTimer *s_timeout_timer;
static AppTimer *s_smooth_sweep_timer;


static bool second_hand_is_active(void) {
  return (showSeconds) &&  //|| settings.AlwaysShowSubDial) &&
         (settings.SubDialChoice == 1 || settings.SubDialChoice == 2 || settings.SubDialChoice == 6);
}


// How often Sweep moves the second hand (aplite: once a second, as without Sweep).
static int prv_sweep_interval_ms(void) {
  #ifdef PBL_PLATFORM_APLITE
  return 1000;
  #else
  int rate = settings.SweepRate;
  if (rate < 1 || rate > 5) { rate = SWEEP_RATE_DEFAULT; }
  return 1000 / rate;
  #endif
}

static void smooth_sweep_timer_handler(void *context) {
  s_smooth_sweep_timer = NULL;

  if (settings.SmoothSweep && second_hand_is_active()) {
    layer_mark_dirty(s_canvas_second_hand);

    // Register fixed interval directly
    s_smooth_sweep_timer = app_timer_register(prv_sweep_interval_ms(), smooth_sweep_timer_handler, NULL);
  }
}

static void start_smooth_sweep_timer(void) {
  if (settings.SmoothSweep && second_hand_is_active() && !s_smooth_sweep_timer) {
    time_t now_sec;
    uint16_t now_ms;
    time_ms(&now_sec, &now_ms);

    // Initial phase sync: align ONLY the first tick to the nearest ms interval boundary
    int interval = prv_sweep_interval_ms();
    int initial_delay = interval - (now_ms % interval);
    if (initial_delay < 50) {
      initial_delay += interval;
    }

    s_smooth_sweep_timer = app_timer_register(initial_delay, smooth_sweep_timer_handler, NULL);
  }
}

static void stop_smooth_sweep_timer(void) {
  if (s_smooth_sweep_timer) {
    app_timer_cancel(s_smooth_sweep_timer);
    s_smooth_sweep_timer = NULL;
  }
}

// Second ticks are only needed to move the seconds hand without Sweep: with Sweep its own
// timer redraws the hand (from the clock), so second ticks would just wake the watch for nothing.
static void prv_subscribe_ticks(void) {
  bool second_ticks = showSeconds && !settings.SmoothSweep;
  tick_timer_service_subscribe(second_ticks ? SECOND_UNIT : MINUTE_UNIT, tick_handler);
}

static void timeout_handler(void *context) {
  showSeconds = false;

  stop_smooth_sweep_timer();

  // Unsubscribe from second ticks to save power
    tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);

  layer_mark_dirty(s_canvas_second_hand);
  if (settings.AlwaysShowSubDial) {
    layer_mark_dirty(s_canvas_comp_bg);   
  }
  s_timeout_timer = NULL; // Set the handle to NULL after the timer expires

  //APP_LOG(APP_LOG_LEVEL_DEBUG, "timeout event");

}

#ifdef HAS_WEATHER
static void prv_unpark_hands_callback(void *data) {
  s_park_hands_timer = NULL;
  s_hands_parked = false;
  layer_mark_dirty(s_canvas_layer);
}
#endif

static void accel_tap_handler(AccelAxisType axis, int32_t direction) {
   if (ignore_next_tap) {
       ignore_next_tap = false; // Reset the flag for the next tap
       return;
     }

  #ifdef HAS_WEATHER
  // Enables manual "refresh weather now" - useful right after regaining signal, without needing to open settings or wait for the next scheduled refresh. 
  //Cooldown-limited (once per minute) so arm movement can't repeatedly call the weather API.
  bool refresh_on_this_shake = true;
  if (settings.UseWeather && settings.ShakeToRefreshWeather && settings.ShakeToParkHands) {
    time_t shake_sec;
    uint16_t shake_ms;
    time_ms(&shake_sec, &shake_ms);
    int64_t now_ms = (int64_t)shake_sec * 1000 + shake_ms;
    int64_t gap = now_ms - s_last_shake_ms;
    if (s_last_shake_ms != 0 && gap < WEATHER_DOUBLE_SHAKE_MIN_GAP_MS) {
      refresh_on_this_shake = false;            // same shake registering twice: ignore
    } else if (s_last_shake_ms != 0 && gap <= WEATHER_DOUBLE_SHAKE_WINDOW_MS) {
      s_last_shake_ms = 0;                      // the second shake: refresh, and start over
    } else {
      s_last_shake_ms = now_ms;                 // a first shake: just move the hands
      refresh_on_this_shake = false;
    }
  }
  if (settings.UseWeather && settings.ShakeToRefreshWeather && refresh_on_this_shake) {
    time_t now = time(NULL);
    if (s_last_manual_weather_request == 0 || (now - s_last_manual_weather_request) >= WEATHER_MANUAL_REFRESH_COOLDOWN_SEC) {
      s_last_manual_weather_request = now;
      prv_request_weather_update();
    }
  }

  // Move the hands aside for ParkHandsSeconds so the complications can be read
  if (settings.ShakeToParkHands) {
    int park_seconds = settings.ParkHandsSeconds;
    if (park_seconds < PARK_HANDS_MIN_SECONDS || park_seconds > PARK_HANDS_MAX_SECONDS) { park_seconds = 5; }
    s_hands_parked = true;
    if (s_park_hands_timer) { app_timer_cancel(s_park_hands_timer); }
    s_park_hands_timer = app_timer_register(park_seconds * 1000, prv_unpark_hands_callback, NULL);
    layer_mark_dirty(s_canvas_layer);
  }
  #endif

  // Only handle if the seconds hand setting is enabled and not already always on
  if ((settings.SubDialChoice == 2 || settings.SubDialChoice ==6)){ // && settings.SecondsVisibleTime < 135) {
      // If a timer is already running, cancel it
      if (s_timeout_timer) {
        app_timer_cancel(s_timeout_timer);
        s_timeout_timer = NULL;
      }

      showSeconds = true;
      prv_subscribe_ticks();
      start_smooth_sweep_timer();
      
      // Register a new timer to hide the seconds hand
      s_timeout_timer = app_timer_register(SECONDS_TICK_INTERVAL_MS * settings.SecondsVisibleTime, timeout_handler, NULL);
      layer_mark_dirty(s_canvas_comp_bg);
      layer_mark_dirty(s_canvas_month_hand);
      layer_mark_dirty(s_canvas_second_hand);
  }
}

// accel_tap_service only supports one subscriber at a time, and two features use it (seconds-hand reveal-on-shake (SubDialChoice 2/6) and shake-to-refresh-weather)
// Call this after processing a settings change (or at startup) to (re)subscribe or unsubscribe based on whichever of those currently apply, rather than each feature managing the
// single shared subscription on its own and potentially getting the way of what the other one needs.
static void prv_update_accel_tap_subscription(void) {
  bool need_accel_tap = (settings.SubDialChoice == 2 || settings.SubDialChoice == 6);
  #ifdef HAS_WEATHER
  need_accel_tap = need_accel_tap || settings.ShakeToParkHands || (settings.UseWeather && settings.ShakeToRefreshWeather);
  #endif

  if (need_accel_tap) {
    accel_tap_service_subscribe(accel_tap_handler);
  } else {
    accel_tap_service_unsubscribe();
  }
}

static void prv_update_bt_icon_visibility(bool connected) {
  layer_set_hidden(s_canvas_bt_icon, !settings.ShowBTQTIcons || connected);
}

// A buzz (on disconnect, or on reconnect after a real outage) would itself register as a wrist
// shake - revealing the seconds hand, or counting towards the weather double-shake - so the shake
// listener is switched off while the watch vibrates and switched back on - only if something
// still needs it - once it has stopped.
#define VIBE_SHAKE_IGNORE_MS 1000
static AppTimer *s_vibe_shake_timer;

static void prv_vibe_shake_timer_callback(void *data) {
  s_vibe_shake_timer = NULL;
  prv_update_accel_tap_subscription();
}

static void prv_vibe_ignoring_shake(bool short_pulse) {
  accel_tap_service_unsubscribe();
  if (short_pulse) { vibes_short_pulse(); } else { vibes_double_pulse(); }
  if (s_vibe_shake_timer) { app_timer_cancel(s_vibe_shake_timer); }
  s_vibe_shake_timer = app_timer_register(VIBE_SHAKE_IGNORE_MS, prv_vibe_shake_timer_callback, NULL);
}

static void bluetooth_vibe_icon (bool connected) {

   prv_update_bt_icon_visibility(connected);

  if (!connected && strcmp(settings.VibeMode, "2") != 0 &&
      (strcmp(settings.VibeMode, "1") == 0 || !quiet_time_is_active())) {
    #ifdef PBL_PLATFORM_DIORITE
    prv_vibe_ignoring_shake(true);
    #else
    prv_vibe_ignoring_shake(false);
    #endif
  }
}

#ifdef HAS_WEATHER
// Recomputes s_weather_refreshing from the two flags above and redraws if it changed.
static void prv_update_weather_refreshing_state(void) {
  bool refreshing = s_weather_min_display_active || s_weather_awaiting_response;
  if (refreshing != s_weather_refreshing) {
    s_weather_refreshing = refreshing;
    // s_canvas_weather doesn't exist the moment the window is first loading: this guards against that
    if (s_canvas_weather) {
      layer_mark_dirty(s_canvas_weather);
    }
  }
}

// Fires WEATHER_REFRESH_MIN_DISPLAY_MS after a request goes out. If the reply already arrived, this is what switches the icon off "refreshing", or until the timeout below gives up.
static void prv_weather_min_display_callback(void *data) {
  s_weather_min_display_timer = NULL;
  s_weather_min_display_active = false;
  prv_update_weather_refreshing_state();
}

// Safety net only: normally s_weather_awaiting_response is cleared as soon as the phone's response arrives (see the IconNow in prv_inbox_received_handler). 
// This stops the "refreshing" icon from being shown forever if the phone never answers at all.
static void prv_weather_refresh_timeout_callback(void *data) {
  s_weather_response_timeout_timer = NULL;
  s_weather_awaiting_response = false;
  prv_update_weather_refreshing_state();
}

// Asks the phone for a fresh weather reading
static void prv_request_weather_update(void) {
  s_last_weather_request = time(NULL);
  s_weather_min_display_active = true;
  s_weather_awaiting_response = true;
  prv_update_weather_refreshing_state();

  if (s_weather_min_display_timer) { app_timer_cancel(s_weather_min_display_timer); }
  s_weather_min_display_timer = app_timer_register(WEATHER_REFRESH_MIN_DISPLAY_MS, prv_weather_min_display_callback, NULL);

  if (s_weather_response_timeout_timer) { app_timer_cancel(s_weather_response_timeout_timer); }
  s_weather_response_timeout_timer = app_timer_register(WEATHER_REFRESH_TIMEOUT_MS, prv_weather_refresh_timeout_callback, NULL);

  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  dict_write_uint8(iter, 0, 0);
  app_message_outbox_send();
}

// Asks for weather if it's due: UpSlider minutes since the last weather arrived (or none ever
// has, or the clock has gone backwards), and no request in the last WEATHER_RETRY_SEC.
static void prv_request_weather_if_due(void) {
  if (!settings.UseWeather) {
    return;
  }
  time_t now = time(NULL);
  int interval_sec = (settings.UpSlider > 0 ? settings.UpSlider : 30) * 60;
  // (30s of slack: the reply lands a few seconds after the minute tick that asked for it, and
  // without it every update would slip to the following minute)
  bool due = s_last_weather_fetch == 0 || now < s_last_weather_fetch ||
             (now - s_last_weather_fetch) >= interval_sec - 30;
  bool asked_recently = s_last_weather_request != 0 && now >= s_last_weather_request &&
                        (now - s_last_weather_request) < WEATHER_RETRY_SEC;
  if (due && !asked_recently) {
    prv_request_weather_update();
  }
}
#endif

#ifdef HAS_WEATHER
// The watch was seeing the Bluetooth link come back before the phone's companion app was ready, asking for weather straight away got lost.  This forces it to wait for 3 seconds before requesting a weather refresh
static void prv_weather_reconnect_delay_callback(void *data) {
  s_weather_reconnect_timer = NULL;
  prv_request_weather_update();
}
#endif

// ---------------------------------------------------------------------------
// Phone-connection timeline log
//
// When the phone comes back after being gone for at least TETHER_MIN_GAP_SEC,
// two events are queued: "disconnected" (at the time it dropped) and
// "reconnected" (now). They're sent to the phone one at a time and
// src/pkjs/index.js turns each into a timeline pin. Pins can only be created
// once the phone is reachable again, so both arrive after the reconnect.
// Everything is persisted, so nothing is lost if the watchface restarts.
// ---------------------------------------------------------------------------
#define TETHER_LOG_KEY         300   // TetherLog blob
#define TETHER_DROP_KEY        301   // time of an unpaired disconnect (0 = none)
#define TETHER_MIN_GAP_SEC     10    // ignore Bluetooth blips shorter than this
#define TETHER_RING            8
#define TETHER_SEND_DELAY_MS   6000  // after reconnect (weather asks at 3s)
#define TETHER_RETRY_MS        3000
#define TETHER_MAX_RETRIES     5
#define TETHER_EVENT_LOST      0
#define TETHER_EVENT_BACK      1
#define TETHER_EVENT_TEST      2

// Set to 1 to send one "Timeline test" pin (5 minutes in the future) every
// time the watchface starts, so the whole path can be checked with
// `pebble logs` without disconnecting. Set back to 0 when done.
#define TETHER_TEST_ON_LAUNCH  0

#ifdef HAS_TIMELINE_PINS   // (aplite: only the outage itself is tracked, for the reconnect buzz)
typedef struct {
  int32_t seq;
  int32_t type;
  int32_t time;
} TetherEvent;

typedef struct {
  int32_t next_seq;   // seq of the newest queued event
  int32_t sent_seq;   // seq of the newest event the phone has received
  TetherEvent ev[TETHER_RING];
} TetherLog;

static TetherLog s_tether;
static AppTimer *s_tether_timer;
static bool s_tether_inflight;
static int32_t s_tether_inflight_seq;
static int s_tether_retries;

static void prv_tether_save(void) {
  persist_write_data(TETHER_LOG_KEY, &s_tether, sizeof(s_tether));
}

static void prv_tether_add(int32_t type, time_t when) {
  int32_t seq = ++s_tether.next_seq;
  TetherEvent *e = &s_tether.ev[seq % TETHER_RING];
  e->seq = seq;
  e->type = type;
  e->time = (int32_t)when;
}

static void prv_tether_send_next(void);

static void prv_tether_timer_callback(void *data) {
  s_tether_timer = NULL;
  prv_tether_send_next();
}

static void prv_tether_schedule(uint32_t ms) {
  if (s_tether_timer) { app_timer_cancel(s_tether_timer); }
  s_tether_timer = app_timer_register(ms, prv_tether_timer_callback, NULL);
}

static void prv_tether_retry_later(void) {
  APP_LOG(APP_LOG_LEVEL_WARNING, "tether: send not possible yet, retry %d/%d", s_tether_retries + 1, TETHER_MAX_RETRIES);
  if (++s_tether_retries <= TETHER_MAX_RETRIES) {
    prv_tether_schedule(TETHER_RETRY_MS);
  }
  // else give up until the next reconnect or watchface launch
}

// Sends the oldest event the phone hasn't had yet (one message at a time).
static void prv_tether_send_next(void) {
  if (!settings.TimelinePins) {
    // Pins switched off: drop anything still waiting rather than sending it later.
    if (s_tether.sent_seq != s_tether.next_seq) {
      s_tether.sent_seq = s_tether.next_seq;
      prv_tether_save();
    }
    return;
  }
  if (s_tether_inflight || !connection_service_peek_pebble_app_connection()) {
    return;
  }
  if (s_tether.sent_seq < s_tether.next_seq - TETHER_RING) {
    s_tether.sent_seq = s_tether.next_seq - TETHER_RING;  // older ones were overwritten
  }
  while (s_tether.sent_seq < s_tether.next_seq) {
    int32_t seq = s_tether.sent_seq + 1;
    TetherEvent *e = &s_tether.ev[seq % TETHER_RING];
    if (e->seq != seq) {        // slot doesn't hold it; skip
      s_tether.sent_seq = seq;
      prv_tether_save();
      continue;
    }
    DictionaryIterator *iter;
    if (app_message_outbox_begin(&iter) != APP_MSG_OK) {  // e.g. a weather request in flight
      prv_tether_retry_later();
      return;
    }
    dict_write_int32(iter, MESSAGE_KEY_TetherSeq, e->seq);
    dict_write_int32(iter, MESSAGE_KEY_TetherType, e->type);
    dict_write_int32(iter, MESSAGE_KEY_TetherTime, e->time);
    if (app_message_outbox_send() != APP_MSG_OK) {
      prv_tether_retry_later();
      return;
    }
    APP_LOG(APP_LOG_LEVEL_INFO, "tether: sending event seq=%d type=%d", (int)e->seq, (int)e->type);
    s_tether_inflight = true;
    s_tether_inflight_seq = seq;
    return;
  }
}

static void prv_outbox_sent_handler(DictionaryIterator *iter, void *context) {
  if (s_tether_inflight) {        // (weather requests also land here; ignore those)
    APP_LOG(APP_LOG_LEVEL_INFO, "tether: phone received event seq=%d", (int)s_tether_inflight_seq);
    s_tether_inflight = false;
    s_tether.sent_seq = s_tether_inflight_seq;
    s_tether_retries = 0;
    prv_tether_save();
    prv_tether_send_next();
  }
}

static void prv_outbox_failed_handler(DictionaryIterator *iter, AppMessageResult reason, void *context) {
  if (s_tether_inflight) {
    APP_LOG(APP_LOG_LEVEL_WARNING, "tether: phone did not take event seq=%d (reason %d)", (int)s_tether_inflight_seq, (int)reason);
    s_tether_inflight = false;
    prv_tether_retry_later();
  }
}

#endif

static int32_t prv_tether_pending_drop(void) {
  return persist_exists(TETHER_DROP_KEY) ? persist_read_int(TETHER_DROP_KEY) : 0;
}

// Returns true after a real outage (one at least TETHER_MIN_GAP_SEC long); the disconnect /
// reconnect pair is only logged for the timeline when the Timeline pins setting is on.
static bool prv_tether_connection_changed(bool connected) {
  time_t now = time(NULL);
  if (!connected) {
    if (prv_tether_pending_drop() == 0) {   // keep the earliest drop time
      persist_write_int(TETHER_DROP_KEY, (int32_t)now);
    }
    return false;
  }
  bool logged = false;
  int32_t dropped = prv_tether_pending_drop();
  if (dropped > 0) {
    persist_write_int(TETHER_DROP_KEY, 0);
    if (now - dropped >= TETHER_MIN_GAP_SEC) {
      #ifdef HAS_TIMELINE_PINS
      if (settings.TimelinePins) {   // the outage still counts (reconnect buzz) when pins are off
        prv_tether_add(TETHER_EVENT_LOST, (time_t)dropped);
        prv_tether_add(TETHER_EVENT_BACK, now);
        prv_tether_save();
      }
      #endif
      logged = true;
    }
  }
  #ifdef HAS_TIMELINE_PINS
  s_tether_retries = 0;
  prv_tether_schedule(TETHER_SEND_DELAY_MS);
  #endif
  return logged;
}

// Called once at launch: load the log and catch up on anything missed while
// the watchface wasn't running.
static void prv_tether_init(void) {
  #ifdef HAS_TIMELINE_PINS
  if (persist_read_data(TETHER_LOG_KEY, &s_tether, sizeof(s_tether)) != (int)sizeof(s_tether)) {
    memset(&s_tether, 0, sizeof(s_tether));
  }
  #endif
  if (connection_service_peek_pebble_app_connection()) {
    // Reconnected while another app/face was showing: pair it with "now".
    prv_tether_connection_changed(true);
  } else if (prv_tether_pending_drop() == 0) {
    // Already disconnected at launch; the real drop time is unknown, so use now.
    persist_write_int(TETHER_DROP_KEY, (int32_t)time(NULL));
  }
#if TETHER_TEST_ON_LAUNCH && defined(HAS_TIMELINE_PINS)
  APP_LOG(APP_LOG_LEVEL_INFO, "tether: queueing a test pin");
  prv_tether_add(TETHER_EVENT_LOST, time(NULL) - 5 * 60);   // real "disconnected" pin
  prv_tether_add(TETHER_EVENT_BACK, time(NULL) - 4 * 60);   // real "reconnected" pin
  prv_tether_add(TETHER_EVENT_TEST, time(NULL) - 3 * 60);   // known-good test pin
  prv_tether_save();
  s_tether_retries = 0;
  prv_tether_schedule(TETHER_SEND_DELAY_MS);
#endif
}

// Short buzz on reconnect after a real outage, following the same VibeMode /
// Quiet Time rules as the disconnect buzz.
static void prv_reconnect_vibe(void) {
  if (strcmp(settings.VibeMode, "2") == 0) {
    return;
  }
  if (strcmp(settings.VibeMode, "1") != 0 && quiet_time_is_active()) {
    return;
  }
  prv_vibe_ignoring_shake(true);   // so the buzz doesn't count as a shake
}

// Called whenever the phone's Bluetooth connection to the watch changes.
// (This is a live reconnect, not app launch, so it's independent of "Refresh weather on launch".  That setting still controls whether launching the watchface itself triggers a fetch.)
static void bluetooth_connection_handler(bool connected) {
  bluetooth_vibe_icon(connected);
  layer_mark_dirty(s_date_battery_logo_layer);   // the phone battery complication: "--" while away

  if (prv_tether_connection_changed(connected) && connected) {
    prv_reconnect_vibe();
  }

  #ifdef HAS_WEATHER
  if (connected && settings.UseWeather) {
    if (s_weather_reconnect_timer) { app_timer_cancel(s_weather_reconnect_timer); }
    s_weather_reconnect_timer = app_timer_register(WEATHER_RECONNECT_DELAY_MS, prv_weather_reconnect_delay_callback, NULL);
  }
  #endif
}


// Load settings from persistent storage
static void prv_load_settings(void) {
  prv_default_settings();
  int bytes_read = persist_read_data(SETTINGS_KEY, &settings, sizeof(settings));
  // Settings saved by older versions are shorter: fields added since keep sensible values.
  if (bytes_read <= (int)offsetof(ClaySettings, HourHandColor)) {
    // before the hour hand had its own colour (or nothing saved yet): it keeps matching the
    // minute hand until the colour is changed in settings
    settings.HourHandColor = settings.MinutesHandColor;
    settings.BWHourHandColor = settings.BWMinHandBatLineColor;
  }
  #ifdef PBL_COLOR
  if (bytes_read <= (int)offsetof(ClaySettings, PicColor5)) {
    // before pictures had colours, or before the painted rainbow had seven stops
    prv_set_picture_default_colours(settings.BackgroundStyle);
  }
  #endif

  if (bytes_read <= (int)offsetof(ClaySettings, SweepRate)) {
    settings.SweepRate = SWEEP_RATE_DEFAULT;   // saved before the sweep speed could be chosen
  }
  if (bytes_read <= (int)offsetof(ClaySettings, TimelinePins)) {
    settings.TimelinePins = false;             // saved before timeline pins were optional
  }
  if (bytes_read <= (int)offsetof(ClaySettings, StepTarget)) {
    // saved before the steps sub-dial and the text rows
    settings.StepTarget = STEP_TARGET_DEFAULT;
    settings.TextRow1 = TEXT_ROW_NONE;
    settings.TextRow2 = TEXT_ROW_NONE;
    settings.ShowAMPM = false;
    settings.StepSeparator = 0;
  }
  if (bytes_read <= (int)offsetof(ClaySettings, ReservedText)) {
    prv_default_row_settings();   // saved before the extra text-row options
  }
  if (bytes_read <= (int)offsetof(ClaySettings, TopSlot1)) {
    // saved before the top complication slots: show what the old switches did
    settings.TopSlot1 = (settings.UseWeather && settings.ShowCurrent) ? TEXT_ROW_WEATHER :
                        settings.EnableBattery ? TEXT_ROW_BATTERY : TEXT_ROW_NONE;
    settings.TopSlot2 = settings.ShowForecast ? TEXT_ROW_FORECAST : TEXT_ROW_NONE;
    settings.TopDate1 = settings.TopDate2 = DATE_FMT_WEEKDAY_DAY;
  }
  if (bytes_read <= (int)offsetof(ClaySettings, BottomColor)) {
    // saved before the bottom complications had their own colour, and the leading-zero choices
    settings.BottomColor = settings.BatteryWeatherColor;
    settings.BWBottomColor = settings.BWBatteryWeatherColor;
    settings.LeadingZero12 = false;
    settings.LeadingZero24 = true;
  }
  if (settings.TopSlot1 > TEXT_ROW_LAST) { settings.TopSlot1 = TEXT_ROW_BATTERY; }
  if (settings.TopSlot2 > TEXT_ROW_LAST) { settings.TopSlot2 = TEXT_ROW_FORECAST; }
  #ifdef HAS_COMPLICATIONS
  if (persist_read_data(APP_TEXT_KEY, s_app_text, sizeof(s_app_text)) != (int)sizeof(s_app_text)) {
    memset(s_app_text, 0, sizeof(s_app_text));
  }
  for (int i = 0; i < APP_TEXT_COUNT; i++) { s_app_text[i][sizeof(s_app_text[i]) - 1] = 0; }
  if (persist_read_data(SLOT_DATA_KEY, &s_slots, sizeof(s_slots)) != (int)sizeof(s_slots)) {
    prv_default_slot_data();
  }
  for (int i = 0; i < SLOT_COUNT; i++) {   // always terminated, whatever was saved
    s_slots.Text[i][sizeof(s_slots.Text[i]) - 1] = 0;
    s_slots.Label[i][sizeof(s_slots.Label[i]) - 1] = 0;
  }
  #endif
  if (settings.StepTarget < 1 || settings.StepTarget > 20) {
    settings.StepTarget = STEP_TARGET_DEFAULT;
  }

  #ifdef HAS_WEATHER
  if (persist_exists(WEATHER_FETCH_EPOCH_KEY)) {
    s_last_weather_fetch = (time_t) persist_read_int(WEATHER_FETCH_EPOCH_KEY);
  }
  #endif
}

// ---- Redraw helpers --------------------------------------------------------

// The dial, digits and date layers all depend on hand size/shape settings.
static void mark_dial_layers_dirty(void) {
  layer_mark_dirty(s_bg_layer);
  layer_mark_dirty(s_canvas_layer);
  layer_mark_dirty(s_date_battery_logo_layer);
}

// Redraws every layer. The bluetooth/quiet-time icons only need it when colours change.
static void mark_all_layers_dirty(bool include_icons) {
  Layer *layers[] = {
    s_bg_layer, s_canvas_layer, s_dial_layer, s_date_battery_logo_layer,
    s_canvas_second_hand, s_canvas_month_hand, s_canvas_battery,
    #ifdef HAS_WEATHER
    s_canvas_weather,
    #endif
    s_canvas_bt_icon, s_canvas_qt_icon,
  };
  size_t count = ARRAY_LENGTH(layers) - (include_icons ? 0 : 2);
  for (size_t i = 0; i < count; i++) {
    layer_mark_dirty(layers[i]);
  }
}

// ---- Theme helpers ---------------------------------------------------------

// B&W themes are just a foreground/background pair. The minute-hand shadow is
// dark grey when shadows are on, otherwise it blends into the background.
static void apply_bw_theme(GColor fg, GColor bg, Tuple *shadow_t) {
  if (shadow_t) {
    settings.BWShadowOn = shadow_t->value->int32 == 1;
  }
  settings.BWBackgroundColor1 = bg;
  settings.BWSubDialColor = bg;
  settings.BWMinuteHandShadowColor = settings.BWShadowOn ? GColorDarkGray : bg;
  settings.BWDateColor = fg;
  settings.BWBatteryWeatherColor = fg;
  settings.BWBottomColor = fg;
  settings.BWSecondsHandColor = fg;
  settings.BWMonthHandColor = fg;
  settings.BWMinHandBatLineColor = fg;
  settings.BWHourHandColor = fg;
  settings.BWHourDigitsColor = fg;
  settings.BWMajorTickColor = fg;
  settings.BWBTQTColor = fg;
}

typedef struct {
  const char *id;
  GColor bg;            // background, also used for the sub-dial
  GColor shadow;        // minute-hand shadow when shadows are on (off = same as bg)
  GColor minor_tick;
  GColor text;          // date, hour digits and major ticks
  GColor minutes_hand;
  GColor accent;        // seconds hand and month hand
  GColor battery_line;
  GColor btqt;          // bluetooth / quiet-time icons
} ColourTheme;

#ifdef PBL_COLOR   // B&W watches use apply_bw_theme; the phone never sends them ThemeSelect
static const ColourTheme COLOUR_THEMES[] = {
  { "wh", GColorWhite,     GColorBabyBlueEyes,   GColorBlack,           GColorBlack,                 GColorCobaltBlue,            GColorOrange,        GColorOrange,        GColorDarkGray },
  { "bl", GColorBlack,     GColorDarkGray,       GColorDarkGray,        GColorYellow,                GColorWhite,                 GColorWhite,         GColorYellow,        GColorLightGray },
  { "bu", GColorOxfordBlue, GColorBlack,         GColorPictonBlue,      GColorYellow,                GColorWhite,                 GColorRed,           GColorRed,           GColorPictonBlue },
  { "pl", GColorPurple,    GColorImperialPurple, GColorImperialPurple,  GColorRichBrilliantLavender, GColorRichBrilliantLavender, GColorBulgarianRose, GColorBulgarianRose, GColorImperialPurple },
  { "gr", GColorBlack,     GColorDarkGreen,      GColorDarkGreen,       GColorBrightGreen,           GColorBrightGreen,           GColorPastelYellow,  GColorPastelYellow,  GColorDarkGreen },
};

// Applies the preset theme called `id`. Returns false if `id` isn't a preset (e.g. "cu" for custom).
static bool apply_colour_theme(const char *id, Tuple *shadow_t) {
  for (size_t i = 0; i < ARRAY_LENGTH(COLOUR_THEMES); i++) {
    const ColourTheme *t = &COLOUR_THEMES[i];
    if (strcmp(id, t->id) != 0) {
      continue;
    }
    if (shadow_t) {
      settings.ShadowOn = shadow_t->value->int32 == 1;
    }
    settings.BackgroundColor1 = t->bg;
    settings.SubDialColor = t->bg;
    settings.MinuteHandShadowColor = settings.ShadowOn ? t->shadow : t->bg;
    settings.MinorTickColor = t->minor_tick;
    settings.DateColor = t->text;
    settings.BatteryWeatherColor = t->text;
    settings.BottomColor = t->text;
    settings.HourDigitsColor = t->text;
    settings.MajorTickColor = t->text;
    settings.MinutesHandColor = t->minutes_hand;
    settings.HourHandColor = t->minutes_hand;
    settings.SecondsHandColor = t->accent;
    settings.MonthHandColor = t->accent;
    settings.BatteryLineColor = t->battery_line;
    settings.BTQTColor = t->btqt;
    return true;
  }
  return false;
}
#endif

// AppMessage inbox handler
static void prv_inbox_received_handler(DictionaryIterator *iter, void *context) {
#ifdef LOG
  APP_LOG(APP_LOG_LEVEL_INFO, "Received message");
#endif

  bool settings_changed = false;
  bool theme_settings_changed = false;

  Tuple *vibe_t = dict_find(iter, MESSAGE_KEY_VibeMode);
  Tuple *dateform_t = dict_find(iter,MESSAGE_KEY_DateFormat);

  Tuple *always_sub_t = dict_find(iter, MESSAGE_KEY_AlwaysShowSubDial);
  Tuple *enable_secondsvisible_t = dict_find(iter, MESSAGE_KEY_SecondsVisibleTime);
  Tuple *bwseconds_color_t = dict_find(iter, MESSAGE_KEY_BWSecondsHandColor);
  Tuple *bwmonthhand_color_t = dict_find(iter, MESSAGE_KEY_BWMonthHandColor);
  Tuple *enable_date_t = dict_find(iter, MESSAGE_KEY_EnableDate);
  Tuple *enable_battery_t = dict_find(iter, MESSAGE_KEY_EnableBattery);
  Tuple *enable_battery_line_t = dict_find(iter, MESSAGE_KEY_EnableBatteryLine);
  Tuple *bwthemeselect_t = dict_find(iter, MESSAGE_KEY_BWThemeSelect);
  Tuple *bwdate_color_t = dict_find(iter, MESSAGE_KEY_BWDateColor);
  Tuple *bwbatweather_color_t = dict_find(iter, MESSAGE_KEY_BWBatteryWeatherColor);
  Tuple *bwbottom_color_t = dict_find(iter, MESSAGE_KEY_BWBottomColor);
  #ifdef HAS_COMPLICATIONS
  Tuple *leadzero12_t = dict_find(iter, MESSAGE_KEY_LeadingZero12);
  Tuple *leadzero24_t = dict_find(iter, MESSAGE_KEY_LeadingZero24);
  #endif
  Tuple *bwbg_color1_t = dict_find(iter, MESSAGE_KEY_BWBackgroundColor1);
  Tuple *bwbg_color2_t = dict_find(iter, MESSAGE_KEY_BWMinuteHandShadowColor);
  Tuple *bwtext_color1_t = dict_find(iter, MESSAGE_KEY_BWMinHandBatLineColor);
  Tuple *bwhourhand_color_t = dict_find(iter, MESSAGE_KEY_BWHourHandColor);
  Tuple *bwtext_color2_t = dict_find(iter, MESSAGE_KEY_BWHourDigitsColor);
  Tuple *bwtext_color3_t = dict_find(iter, MESSAGE_KEY_BWMajorTickColor);
  Tuple *bwbtqt_color_t = dict_find(iter, MESSAGE_KEY_BWBTQTColor);
  Tuple *bwshadowon_t = dict_find(iter, MESSAGE_KEY_BWShadowOn);
  Tuple *majort_t = dict_find(iter, MESSAGE_KEY_showMajorTick);
  Tuple *minort_t = dict_find(iter, MESSAGE_KEY_showMinorTick);
  Tuple *fg_shape_t = dict_find(iter, MESSAGE_KEY_ForegroundShape);
  Tuple *minhand_t = dict_find(iter, MESSAGE_KEY_MinuteHandThickness);
  Tuple *hrhand_t = dict_find(iter, MESSAGE_KEY_HourHandThickness);
  Tuple *minocent_t = dict_find(iter, MESSAGE_KEY_MinuteCentreSize);
  Tuple *hrocent_t = dict_find(iter, MESSAGE_KEY_HourCentreSize);
  Tuple *icent_t = dict_find(iter, MESSAGE_KEY_InnerCentreSize);
  Tuple *back_t = dict_find(iter, MESSAGE_KEY_BackSize);
  Tuple *backlen_t = dict_find(iter, MESSAGE_KEY_BackLen);

  Tuple *bwsubdial_t = dict_find(iter, MESSAGE_KEY_BWSubDialColor);
  Tuple *roman_t = dict_find(iter, MESSAGE_KEY_Roman);
  Tuple *hourticksonly_t = dict_find(iter, MESSAGE_KEY_HourTicksOnly);
  #ifdef PBL_COLOR
  Tuple *bgstyle_t = dict_find(iter, MESSAGE_KEY_BackgroundStyle);
  #endif

  #ifdef PBL_COLOR   // colour-theme keys: the phone only sends these to colour watches
  Tuple *seconds_color_t = dict_find(iter, MESSAGE_KEY_SecondsHandColor);
  Tuple *monthhand_color_t = dict_find(iter, MESSAGE_KEY_MonthHandColor);
  Tuple *themeselect_t = dict_find(iter, MESSAGE_KEY_ThemeSelect);
  Tuple *bg_color1_t = dict_find(iter, MESSAGE_KEY_BackgroundColor1);
  Tuple *bg_color2_t = dict_find(iter, MESSAGE_KEY_MinuteHandShadowColor);
  Tuple *text_color2_t = dict_find(iter, MESSAGE_KEY_MinorTickColor);
  Tuple *date_color_t = dict_find(iter, MESSAGE_KEY_DateColor);
  Tuple *batweather_color_t = dict_find(iter, MESSAGE_KEY_BatteryWeatherColor);
  Tuple *bottom_color_t = dict_find(iter, MESSAGE_KEY_BottomColor);
  Tuple *hours_color_t = dict_find(iter, MESSAGE_KEY_HourDigitsColor);
  Tuple *minutes_color_t = dict_find(iter, MESSAGE_KEY_MinutesHandColor);
  Tuple *hourhand_color_t = dict_find(iter, MESSAGE_KEY_HourHandColor);
  Tuple *tick_color_t = dict_find(iter, MESSAGE_KEY_MajorTickColor);
  Tuple *battery_line_color_t = dict_find(iter, MESSAGE_KEY_BatteryLineColor);
  Tuple *btqt_color_t = dict_find(iter, MESSAGE_KEY_BTQTColor);
  Tuple *shadowon_t = dict_find(iter, MESSAGE_KEY_ShadowOn);
  Tuple *subdial_t = dict_find(iter, MESSAGE_KEY_SubDialColor);
  #endif
  Tuple *subdialchoice_t = dict_find(iter,MESSAGE_KEY_SubDialChoice);
  Tuple *tzoffset_t = dict_find(iter, MESSAGE_KEY_TZ_OFFSET);
  Tuple *remoteampm_t = dict_find(iter, MESSAGE_KEY_showremoteAMPM);

  Tuple *smoothsweep_t = dict_find(iter, MESSAGE_KEY_SmoothSweep);
  Tuple *sweeprate_t = dict_find(iter, MESSAGE_KEY_SweepRate);
  Tuple *timelinepins_t = dict_find(iter, MESSAGE_KEY_TimelinePins);
  Tuple *steptarget_t = dict_find(iter, MESSAGE_KEY_StepTarget);
  #ifdef HAS_COMPLICATIONS   // (aplite has the original fixed layout: no complication slots)
  Tuple *textrow1_t = dict_find(iter, MESSAGE_KEY_TextRow1);
  Tuple *textrow2_t = dict_find(iter, MESSAGE_KEY_TextRow2);
  Tuple *showampm_t = dict_find(iter, MESSAGE_KEY_ShowAMPM);
  Tuple *stepsep_t = dict_find(iter, MESSAGE_KEY_StepSeparator);
  Tuple *topslot1_t = dict_find(iter, MESSAGE_KEY_TopSlot1);
  Tuple *topslot2_t = dict_find(iter, MESSAGE_KEY_TopSlot2);
  Tuple *topdate1_t = dict_find(iter, MESSAGE_KEY_TopDate1);
  Tuple *topdate2_t = dict_find(iter, MESSAGE_KEY_TopDate2);
  Tuple *slottext_t[SLOT_COUNT] = { dict_find(iter, MESSAGE_KEY_SlotText1), dict_find(iter, MESSAGE_KEY_SlotText2),
                                    dict_find(iter, MESSAGE_KEY_SlotText3), dict_find(iter, MESSAGE_KEY_SlotText4) };
  Tuple *rowdate1_t = dict_find(iter, MESSAGE_KEY_TextRowDate1);
  Tuple *rowdate2_t = dict_find(iter, MESSAGE_KEY_TextRowDate2);
  // each slot's time zone (the second top row has none: too short)
  Tuple *slotlabel_t[SLOT_COUNT] = { dict_find(iter, MESSAGE_KEY_SlotLabel1), NULL,
                                     dict_find(iter, MESSAGE_KEY_SlotLabel3), dict_find(iter, MESSAGE_KEY_SlotLabel4) };
  Tuple *slotoffset_t[SLOT_COUNT] = { dict_find(iter, MESSAGE_KEY_SlotOffset1), NULL,
                                      dict_find(iter, MESSAGE_KEY_SlotOffset3), dict_find(iter, MESSAGE_KEY_SlotOffset4) };
  Tuple *precipinches_t = dict_find(iter, MESSAGE_KEY_PrecipInches);
  Tuple *sunrise_t = dict_find(iter, MESSAGE_KEY_Sunrise);
  Tuple *sunset_t = dict_find(iter, MESSAGE_KEY_Sunset);
  Tuple *uvnow_t = dict_find(iter, MESSAGE_KEY_UVNow);
  Tuple *uvmax_t = dict_find(iter, MESSAGE_KEY_UVMax);
  Tuple *precipchance_t = dict_find(iter, MESSAGE_KEY_PrecipChance);
  Tuple *precipamount_t = dict_find(iter, MESSAGE_KEY_PrecipAmount);
  #endif
  Tuple *datelang_t = dict_find(iter, MESSAGE_KEY_DateLanguage);

  ///////Weather
  #ifdef HAS_WEATHER
  Tuple * useweather_t = dict_find(iter, MESSAGE_KEY_UseWeather);
  Tuple * frequpdate = dict_find(iter, MESSAGE_KEY_UpSlider);

  Tuple * showfore_t = dict_find(iter, MESSAGE_KEY_ShowForecast);
  Tuple * showcurr_t = dict_find(iter, MESSAGE_KEY_ShowCurrent);
  Tuple * showal_t = dict_find(iter, MESSAGE_KEY_ShowAlert);

  Tuple * wtemp_t = dict_find(iter, MESSAGE_KEY_WeatherTemp);
  Tuple * iconnow_tuple = dict_find(iter, MESSAGE_KEY_IconNow);
  Tuple * wforetemp_t = dict_find(iter, MESSAGE_KEY_TempFore);
  Tuple * rainsoon_t = dict_find(iter, MESSAGE_KEY_RainSoon);
  Tuple * rainamount_t = dict_find(iter, MESSAGE_KEY_RainAmount);
  Tuple * wbgtlevel_t = dict_find(iter, MESSAGE_KEY_WBGTLevel);
  #ifdef HAS_COMPLICATIONS
  Tuple *phonebattery_t = dict_find(iter, MESSAGE_KEY_PhoneBattery);
  {
    const uint32_t app_text_keys[APP_TEXT_COUNT] = { MESSAGE_KEY_AppText1, MESSAGE_KEY_AppText2,
                                                     MESSAGE_KEY_AppText3, MESSAGE_KEY_AppText4,
                                                     MESSAGE_KEY_AppText5 };
    bool app_text_changed = false;
    for (int i = 0; i < APP_TEXT_COUNT; i++) {
      Tuple *t = dict_find(iter, app_text_keys[i]);
      if (t && t->type == TUPLE_CSTRING) {
        snprintf(s_app_text[i], sizeof(s_app_text[i]), "%s", t->value->cstring);
        app_text_changed = true;
      }
    }
    if (app_text_changed) {
      persist_write_data(APP_TEXT_KEY, s_app_text, sizeof(s_app_text));
      layer_mark_dirty(s_date_battery_logo_layer);
    }
  }
  if (phonebattery_t) {
    int level = prv_tuple_int(phonebattery_t);
    s_phone_battery = (level >= 0 && level <= 100) ? level : -1;
    layer_mark_dirty(s_date_battery_logo_layer);
  }
  #endif
  Tuple * refreshonlaunch_t = dict_find(iter, MESSAGE_KEY_RefreshWeatherOnLaunch);
  Tuple * shaketorefresh_t = dict_find(iter, MESSAGE_KEY_ShakeToRefreshWeather);
  Tuple * shaketopark_t = dict_find(iter, MESSAGE_KEY_ShakeToParkHands);
  Tuple * parkseconds_t = dict_find(iter, MESSAGE_KEY_ParkHandsSeconds);
  Tuple *show_btqt_icons_t = dict_find(iter, MESSAGE_KEY_ShowBTQTIcons);

  if (show_btqt_icons_t) {
    settings.ShowBTQTIcons = show_btqt_icons_t->value->int32 != 0;
    settings_changed = true;
  }
  
  if (useweather_t) {
    settings.UseWeather = useweather_t->value->int32 != 0;
    settings_changed = true;
  }

   if (showfore_t) {
    settings.ShowForecast = showfore_t->value->int32 != 0;
    settings_changed = true;
  }

   if (showcurr_t) {
    settings.ShowCurrent = showcurr_t->value->int32 != 0;
    settings_changed = true;
  }

   if (showal_t) {
    settings.ShowAlert = showal_t->value->int32 != 0;
    settings_changed = true;
  }

  if (refreshonlaunch_t) {
    settings.RefreshWeatherOnLaunch = refreshonlaunch_t->value->int32 != 0;
    settings_changed = true;
  }

  if (shaketorefresh_t) {
    settings.ShakeToRefreshWeather = shaketorefresh_t->value->int32 != 0;
    settings_changed = true;
  }

  if (shaketopark_t) {
    settings.ShakeToParkHands = shaketopark_t->value->int32 != 0;
    settings_changed = true;
  }

  if (parkseconds_t) {
    int value = (int) parkseconds_t->value->int32;
    if (value >= PARK_HANDS_MIN_SECONDS && value <= PARK_HANDS_MAX_SECONDS) {
      settings.ParkHandsSeconds = value;
    }
    settings_changed = true;
  }


  if (frequpdate){
    settings.UpSlider = (int) frequpdate -> value -> int32;   // the next minute tick uses the new interval
     settings_changed = true;
  }

  if (wtemp_t){
  snprintf(settings.tempstring, sizeof(settings.tempstring), "%s", wtemp_t -> value -> cstring);
   settings_changed = true;
  }

  if (iconnow_tuple){
      snprintf(settings.iconnowstring,sizeof(settings.iconnowstring),"%s",safe_weather_condition((int)iconnow_tuple->value->int32));
      s_last_weather_fetch = time(NULL);
      persist_write_int(WEATHER_FETCH_EPOCH_KEY, (int32_t) s_last_weather_fetch);
      if (s_weather_response_timeout_timer) { app_timer_cancel(s_weather_response_timeout_timer); s_weather_response_timeout_timer = NULL; }
      s_weather_awaiting_response = false;
      prv_update_weather_refreshing_state();
     settings_changed = true;
  }

  if (wforetemp_t){
    snprintf(settings.temphistring, sizeof(settings.temphistring), "%s", wforetemp_t -> value -> cstring);
     settings_changed = true;
  }

  if (rainsoon_t){
    settings.RainSoon = rainsoon_t->value->int32 != 0;
     settings_changed = true;
  }

  if (rainamount_t){
    settings.RainAmount = (int)rainamount_t->value->int32;
     settings_changed = true;
  }

  if (wbgtlevel_t){
    settings.WBGTLevel = (int)wbgtlevel_t->value->int32;
     settings_changed = true;
  }

  #endif

 ///////////////////////////

  if (datelang_t) {
    snprintf(settings.DateLanguage, sizeof(settings.DateLanguage), "%s", datelang_t->value->cstring);
    settings_changed = true;
  }

  if (smoothsweep_t) {
      settings.SmoothSweep = smoothsweep_t->value->int32 == 1;
  }
  if (sweeprate_t) {
      int rate = sweeprate_t->type == TUPLE_CSTRING ? atoi(sweeprate_t->value->cstring) : (int)sweeprate_t->value->int32;
      if (rate >= 1 && rate <= 5) {
        settings.SweepRate = rate;
      }
  }
  if (timelinepins_t) {
      settings.TimelinePins = timelinepins_t->value->int32 == 1;
  }
  if (steptarget_t) {
      int target = prv_tuple_int(steptarget_t) / 1000;   // the slider sends steps (1000-20000)
      if (target >= 1 && target <= 20) {
        settings.StepTarget = target;
      }
      layer_mark_dirty(s_canvas_month_hand);
  }
  #ifdef HAS_COMPLICATIONS
  if (textrow1_t) {
      int row = prv_tuple_int(textrow1_t);
      settings.TextRow1 = (row >= TEXT_ROW_NONE && row <= TEXT_ROW_LAST) ? row : TEXT_ROW_NONE;
  }
  if (textrow2_t) {
      int row = prv_tuple_int(textrow2_t);
      settings.TextRow2 = (row >= TEXT_ROW_NONE && row <= TEXT_ROW_LAST) ? row : TEXT_ROW_NONE;
  }
  if (leadzero12_t) { settings.LeadingZero12 = leadzero12_t->value->int32 == 1; }
  if (leadzero24_t) { settings.LeadingZero24 = leadzero24_t->value->int32 == 1; }
  if (showampm_t) {
      settings.ShowAMPM = showampm_t->value->int32 == 1;
  }
  if (stepsep_t) {
      int sep = prv_tuple_int(stepsep_t);
      settings.StepSeparator = (sep >= 0 && sep <= 3) ? sep : 0;
  }
  bool slots_changed = false;
  for (int i = 0; i < SLOT_COUNT; i++) {
    if (slottext_t[i]) {
      snprintf(s_slots.Text[i], sizeof(s_slots.Text[i]), "%s", slottext_t[i]->value->cstring);
      slots_changed = true;
    }
  }
  s_slots.Text[SLOT_TOP2][SLOT_TOP2_TEXT_MAX] = 0;
  if (topslot1_t) {
      int kind = prv_tuple_int(topslot1_t);
      settings.TopSlot1 = (kind >= TEXT_ROW_NONE && kind <= TEXT_ROW_LAST) ? kind : TEXT_ROW_NONE;
  }
  if (topslot2_t) {
      int kind = prv_tuple_int(topslot2_t);
      settings.TopSlot2 = (kind >= TEXT_ROW_NONE && kind <= TEXT_ROW_LAST) ? kind : TEXT_ROW_NONE;
  }
  if (topdate1_t) {
      int fmt = prv_tuple_int(topdate1_t);
      settings.TopDate1 = (fmt >= 0 && fmt <= DATE_FMT_LAST) ? fmt : DATE_FMT_WEEKDAY_DAY;
  }
  if (topdate2_t) {
      int fmt = prv_tuple_int(topdate2_t);
      settings.TopDate2 = (fmt >= 0 && fmt <= DATE_FMT_LAST) ? fmt : DATE_FMT_WEEKDAY_DAY;
  }
  if (topslot1_t || topslot2_t || topdate1_t || topdate2_t) {
      slots_changed = true;
      layer_mark_dirty(s_canvas_battery);   // the battery value/meter and the weather
      #ifdef HAS_WEATHER
      layer_mark_dirty(s_canvas_weather);
      #endif
  }
  if (rowdate1_t) {
      int fmt = prv_tuple_int(rowdate1_t);
      settings.TextRowDate1 = (fmt >= 0 && fmt <= DATE_FMT_LAST) ? fmt : DATE_FMT_WEEKDAY_DAY;
  }
  if (rowdate2_t) {
      int fmt = prv_tuple_int(rowdate2_t);
      settings.TextRowDate2 = (fmt >= 0 && fmt <= DATE_FMT_LAST) ? fmt : DATE_FMT_WEEKDAY_DAY;
  }
  bool rows_changed = slots_changed || textrow1_t || textrow2_t || showampm_t || leadzero12_t || leadzero24_t || stepsep_t || rowdate1_t || rowdate2_t
                      || wtemp_t || iconnow_tuple || wforetemp_t || tzoffset_t;
  for (int i = 0; i < SLOT_COUNT; i++) {
    if (slotlabel_t[i]) {
      snprintf(s_slots.Label[i], sizeof(s_slots.Label[i]), "%s", slotlabel_t[i]->value->cstring);
      rows_changed = true;
    }
    if (slotoffset_t[i]) {
      s_slots.Offset[i] = prv_tuple_int(slotoffset_t[i]);
      rows_changed = true;
    }
  }
  if (precipinches_t) { settings.PrecipInches = prv_tuple_int(precipinches_t) == 1; }   // a select: "0" mm, "1" inches
  if (sunrise_t) { settings.SunriseMin = prv_tuple_int(sunrise_t); }
  if (sunset_t) { settings.SunsetMin = prv_tuple_int(sunset_t); }
  if (uvnow_t) { settings.UVNow = prv_tuple_int(uvnow_t); }
  if (uvmax_t) { settings.UVMax = prv_tuple_int(uvmax_t); }
  if (precipchance_t) { settings.PrecipChance = prv_tuple_int(precipchance_t); }
  if (precipamount_t) { settings.PrecipTenthMm = prv_tuple_int(precipamount_t); }
  rows_changed = rows_changed || precipinches_t || sunrise_t || sunset_t
                 || uvnow_t || uvmax_t || precipchance_t || precipamount_t;
  if (rows_changed) {
      layer_mark_dirty(s_date_battery_logo_layer);
  }
  #endif

  if (subdialchoice_t) {
      int value = atoi(subdialchoice_t->value->cstring);
      if (value >= 0 && value <= SUBDIAL_STEPS_AVERAGE) {
        settings.SubDialChoice = value;
      }
      layer_mark_dirty(s_canvas_tz);
      layer_mark_dirty(s_canvas_comp_bg);
      layer_mark_dirty(s_canvas_second_hand);
      layer_mark_dirty(s_canvas_month_hand);
   }


  if (remoteampm_t) {
  settings.showremoteAMPM = remoteampm_t->value->int32 == 1;
  layer_mark_dirty(s_canvas_tz);
  layer_mark_dirty(s_canvas_comp_bg);
  }

  if (tzoffset_t) {
    settings.tz_offset = (int)tzoffset_t->value->int32;
    if (settings.tz_offset != -1) {
      update_offset_vars(settings.tz_offset);
    }
    refresh_current_time();
    update_time_state(prv_tick_time);
    layer_mark_dirty(s_canvas_tz);
    layer_mark_dirty(s_canvas_comp_bg);
  }


   if (roman_t) {
    settings.Roman = roman_t->value->int32 == 1;
    settings_changed = true;
  }

  if (hourticksonly_t) {
    settings.HourTicksOnly = hourticksonly_t->value->int32 != 0;
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  #ifdef PBL_COLOR
  if (bgstyle_t) {
    // Clay sends a select's value as a string; accept a plain integer too.
    int value = (bgstyle_t->type == TUPLE_CSTRING) ? atoi(bgstyle_t->value->cstring)
                                                   : (int)bgstyle_t->value->int32;
    if (value >= 0 && value <= 9) {
      settings.BackgroundStyle = value;
    }
    settings_changed = true;
    layer_mark_dirty(s_bg_layer);
  }
  // Background picture colours (any theme). Sent as 0xRRGGBB integers like the other colours.
  const uint32_t piccolour_keys[7] = { MESSAGE_KEY_PicColor1, MESSAGE_KEY_PicColor2, MESSAGE_KEY_PicColor3,
    MESSAGE_KEY_PicColor4, MESSAGE_KEY_PicColor5, MESSAGE_KEY_PicColor6, MESSAGE_KEY_PicColor7 };
  GColor *piccolour[7] = { &settings.PicColor1, &settings.PicColor2, &settings.PicColor3, &settings.PicColor4,
                           &settings.PicColor5, &settings.PicColor6, &settings.PicColor7 };
  for (int i = 0; i < 7; i++) {
    Tuple *colour_t = dict_find(iter, piccolour_keys[i]);
    if (colour_t) {
      *piccolour[i] = GColorFromHEX(colour_t->value->int32);
      settings_changed = true;
      layer_mark_dirty(s_bg_layer);
    }
  }
  #endif

  if (fg_shape_t) {
    settings.ForegroundShape = fg_shape_t->value->int32 == 1;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
  }

  if (minocent_t) {
    settings.MinuteCentreSize = (int) minocent_t -> value -> int32;
    mark_dial_layers_dirty();
  }

  if (hrocent_t) {
    settings.HourCentreSize = (int) hrocent_t -> value -> int32;
    mark_dial_layers_dirty();
  }

  if (icent_t) {
    settings.InnerCentreSize = (int) icent_t -> value -> int32;
    mark_dial_layers_dirty();
  }

  if (minhand_t) {
    settings.MinuteHandThickness = (int) minhand_t -> value -> int32;
    mark_dial_layers_dirty();
    layer_mark_dirty(s_canvas_month_hand);
    layer_mark_dirty(s_canvas_second_hand);
  }

  if (hrhand_t) {
    settings.HourHandThickness = (int) hrhand_t -> value -> int32;
    mark_dial_layers_dirty();
  }

  if (back_t) {
    settings.BackSize = (int) back_t -> value -> int32;
    mark_dial_layers_dirty();
  }

  if (backlen_t) {
    settings.BackLen = (int) backlen_t -> value -> int32;
    mark_dial_layers_dirty();
  }

  if(majort_t){
    settings.showMajorTick = majort_t->value->int32 != 0;
    layer_mark_dirty(s_bg_layer);
  } 
  
  if(minort_t){
    settings.showMinorTick = minort_t->value->int32 != 0;
    layer_mark_dirty(s_bg_layer);
  }

  if (always_sub_t){
    settings.AlwaysShowSubDial = always_sub_t->value->int32 == 1;
    layer_mark_dirty(s_canvas_comp_bg);
    layer_mark_dirty(s_canvas_month_hand);
    layer_mark_dirty(s_canvas_second_hand);
  }

  
  if (vibe_t) {
    snprintf(settings.VibeMode, sizeof(settings.VibeMode), "%s", vibe_t->value->cstring);
    layer_mark_dirty(s_canvas_bt_icon);
  }

  if (dateform_t) {
    snprintf(settings.DateFormat, sizeof(settings.DateFormat), "%s", dateform_t->value->cstring);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (enable_date_t) {
    settings.EnableDate = enable_date_t->value->int32 == 1;
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }


  if (enable_battery_t) {
    settings.EnableBattery = enable_battery_t->value->int32 == 1;
    layer_mark_dirty(s_canvas_battery);
    layer_mark_dirty(s_date_battery_logo_layer);
    }

  if (enable_battery_line_t) {
    settings.EnableBatteryLine = enable_battery_line_t->value->int32 == 1;
    layer_mark_dirty(s_canvas_battery);
  }

  if (enable_secondsvisible_t) {
    settings.SecondsVisibleTime = (int) enable_secondsvisible_t->value->int32;
    // Cancel and re-register timer if it was running
    if (s_timeout_timer) {
      app_timer_cancel(s_timeout_timer);
      s_timeout_timer = NULL;
    }

    // Handle "Always On" vs. "Timeout" behavior for the seconds hand
    if (settings.SubDialChoice == 1 ) {
      // "Always On" logic: show seconds, and don't register a timer
      showSeconds = true;
      start_smooth_sweep_timer();
        tick_timer_service_unsubscribe();
        prv_subscribe_ticks();
        // Unsubscribe from accel_tap_service as it's not needed
        accel_tap_service_unsubscribe();

    } else if (settings.SubDialChoice == 2 || settings.SubDialChoice == 6) {
      // "Timeout" logic: start with seconds shown, register a timer
      showSeconds = true;
      start_smooth_sweep_timer();
        tick_timer_service_unsubscribe();
        prv_subscribe_ticks();
        s_timeout_timer = app_timer_register(SECONDS_TICK_INTERVAL_MS * settings.SecondsVisibleTime, timeout_handler, NULL);
        // Subscribe to accel_tap_service to reset the timer
        accel_tap_service_subscribe(accel_tap_handler);
      }
     else {
      // "Disabled" logic: don't show seconds, ensure on minute ticks
      showSeconds = false;
      stop_smooth_sweep_timer();
      tick_timer_service_unsubscribe();
      tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
      // Unsubscribe from accel_tap_service
      accel_tap_service_unsubscribe();
    }
    layer_mark_dirty(s_canvas_second_hand);
  }


  if (bwthemeselect_t) {
          const char *bw_theme = bwthemeselect_t->value->cstring;
          if (strcmp(bw_theme, "wh") == 0) {
              apply_bw_theme(GColorBlack, GColorWhite, bwshadowon_t);
              theme_settings_changed = true;
          } else if (strcmp(bw_theme, "bl") == 0) {
              apply_bw_theme(GColorWhite, GColorBlack, bwshadowon_t);
              theme_settings_changed = true;
          } else if (strcmp(bw_theme, "cu") == 0) {
              // Set the theme for "cu" and handle custom colors
                  if (bwdate_color_t) {
                    settings.BWDateColor = GColorFromHEX(bwdate_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                    layer_mark_dirty(s_date_battery_logo_layer);
                  }
                  if (bwbatweather_color_t) {
                    settings.BWBatteryWeatherColor = GColorFromHEX(bwbatweather_color_t->value->int32);
                    layer_mark_dirty(s_date_battery_logo_layer);
                  }
                  if (bwbottom_color_t) {
                    settings.BWBottomColor = GColorFromHEX(bwbottom_color_t->value->int32);
                    layer_mark_dirty(s_date_battery_logo_layer);
                  }

                  if (bwbg_color1_t) {
                    settings.BWBackgroundColor1 = GColorFromHEX(bwbg_color1_t->value->int32);
                    settings_changed = true;
                  }

                  if (bwsubdial_t) {
                    settings.BWSubDialColor = GColorFromHEX(bwsubdial_t->value->int32);
                    settings_changed = true;
                  }

                  if (bwshadowon_t) {
                    settings.BWShadowOn = bwshadowon_t->value->int32 == 1;

                      if(settings.BWShadowOn){
                        if (bwbg_color2_t) {
                          settings.BWMinuteHandShadowColor = GColorFromHEX(bwbg_color2_t->value->int32);
                          settings_changed = true;
                        }
                      }
                      else {
                      settings.BWMinuteHandShadowColor = settings.BWBackgroundColor1;
                      }
                  }

                  if (bwseconds_color_t) {
                    settings.BWSecondsHandColor = GColorFromHEX(bwseconds_color_t->value->int32);
                    layer_mark_dirty(s_canvas_second_hand);
                  }

                  if (bwmonthhand_color_t) {
                    settings.BWMonthHandColor = GColorFromHEX(bwmonthhand_color_t->value->int32);
                    layer_mark_dirty(s_canvas_month_hand);
                  }

                  if (bwtext_color1_t) {
                    settings.BWMinHandBatLineColor = GColorFromHEX(bwtext_color1_t->value->int32);
                    settings_changed = true;
                  }
                  if (bwhourhand_color_t) {
                    settings.BWHourHandColor = GColorFromHEX(bwhourhand_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                  }
                  if (bwtext_color2_t) {
                    settings.BWHourDigitsColor = GColorFromHEX(bwtext_color2_t->value->int32);
                    settings_changed = true;
                  }
                  if (bwtext_color3_t) {
                    settings.BWMajorTickColor = GColorFromHEX(bwtext_color3_t->value->int32);
                    settings_changed = true;
                  }
                  if (bwbtqt_color_t) {
                    settings.BWBTQTColor = GColorFromHEX(bwbtqt_color_t->value->int32);
                    layer_mark_dirty(s_canvas_bt_icon);
                    layer_mark_dirty(s_canvas_qt_icon);
                  }
                  theme_settings_changed = true;
                }
          }
/////////////////////////////////////
  #ifdef PBL_COLOR
  if (themeselect_t) {
          const char *theme = themeselect_t->value->cstring;
          if (apply_colour_theme(theme, shadowon_t)) {
              theme_settings_changed = true;
          } else if (strcmp(theme, "cu") == 0) {
              // Set the theme for "cu" and handle custom colors
                  if (bg_color1_t) {
                    settings.BackgroundColor1 = GColorFromHEX(bg_color1_t->value->int32);
                    settings_changed = true;
                  }

                   if (subdial_t) {
                    settings.SubDialColor = GColorFromHEX(subdial_t->value->int32);
                    settings_changed = true;
                  }

                  if (shadowon_t) {
                    settings.ShadowOn = shadowon_t->value->int32 == 1;

                      if(settings.ShadowOn){
                        if (bg_color2_t) {
                          settings.MinuteHandShadowColor = GColorFromHEX(bg_color2_t->value->int32);
                          settings_changed = true;
                        }
                      }
                      else {
                      settings.MinuteHandShadowColor = settings.BackgroundColor1;
                      }
                  }

                  if (text_color2_t) {
                    settings.MinorTickColor = GColorFromHEX(text_color2_t->value->int32);
                    layer_mark_dirty(s_bg_layer);
                  }
                  
                  if (date_color_t) {
                    settings.DateColor = GColorFromHEX(date_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                    layer_mark_dirty(s_date_battery_logo_layer);
                  }
                  if (bottom_color_t) {
                    settings.BottomColor = GColorFromHEX(bottom_color_t->value->int32);
                    layer_mark_dirty(s_date_battery_logo_layer);
                  }
                  if (batweather_color_t) {
                    settings.BatteryWeatherColor = GColorFromHEX(batweather_color_t->value->int32);
                    layer_mark_dirty(s_date_battery_logo_layer);
                    #ifdef HAS_WEATHER
                    if (s_canvas_weather) { layer_mark_dirty(s_canvas_weather); }
                    #endif
                  }
                  if (hours_color_t) {
                    settings.HourDigitsColor = GColorFromHEX(hours_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                  }
                 
                  if (minutes_color_t) {
                    settings.MinutesHandColor = GColorFromHEX(minutes_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                    layer_mark_dirty(s_date_battery_logo_layer);
                  }
                  if (hourhand_color_t) {
                    settings.HourHandColor = GColorFromHEX(hourhand_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                  }

                  if (seconds_color_t) {
                    settings.SecondsHandColor = GColorFromHEX(seconds_color_t->value->int32);
                    layer_mark_dirty(s_canvas_second_hand);
                  }

                   if (monthhand_color_t) {
                    settings.MonthHandColor = GColorFromHEX(monthhand_color_t->value->int32);
                    layer_mark_dirty(s_canvas_month_hand);
                  }
                 
                  if (tick_color_t) {
                    settings.MajorTickColor = GColorFromHEX(tick_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                    layer_mark_dirty(s_date_battery_logo_layer);
                  }
                  
                  if (battery_line_color_t) {
                    settings.BatteryLineColor = GColorFromHEX(battery_line_color_t->value->int32);
                    layer_mark_dirty(s_canvas_battery);
                  }
                  if (btqt_color_t) {
                    settings.BTQTColor = GColorFromHEX(btqt_color_t->value->int32);
                    layer_mark_dirty(s_canvas_bt_icon);
                    layer_mark_dirty(s_canvas_qt_icon);
                  }
                  theme_settings_changed = true;
                }
          }
  #endif // PBL_COLOR

                  ///////////////////////////////

  if (settings_changed || theme_settings_changed) {
    mark_all_layers_dirty(theme_settings_changed);
  }

  prv_update_accel_tap_subscription();
  prv_save_settings();

}

// The current time lives in our own copy (g_local_time), not in the buffer localtime() returns:
// that buffer is shared, and the firmware's health functions (the steps sub-dial and steps row)
// overwrite it with the start of the day, which froze the hands and time row at 12:00.
static void refresh_current_time(void) {
  time_t now = time(NULL);
  g_current_epoch = now;
  g_local_time = *localtime(&now);
  prv_tick_time = &g_local_time;
}

// Recomputes everything that depends on the minute/date. Called on every minute
// tick, and after settings arrive that change what the time means (e.g. a new
// second-timezone offset).
// ---- Steps (sub-dial options 7 and 8, and the steps text row) -------------------------------
// Read once a minute (update_time_state) rather than on every redraw: the averages in
// particular are a slow query. -1 = not available (no health data, or not allowed).
#if defined(PBL_HEALTH)
static int32_t s_steps_today = -1;
static int32_t s_steps_avg_day = -1;   // your average whole day (sub-dial 8: a full turn)
static int32_t s_steps_avg_now = -1;   // your average by this time of day (sub-dial 8: the marker)
#endif

static bool prv_subdial_shows_steps(void) {
  return settings.SubDialChoice == SUBDIAL_STEPS_TARGET || settings.SubDialChoice == SUBDIAL_STEPS_AVERAGE;
}

#ifdef HAS_COMPLICATIONS
static bool prv_text_rows_on(void) {
  return settings.SubDialChoice == 0 && (settings.TextRow1 != TEXT_ROW_NONE || settings.TextRow2 != TEXT_ROW_NONE);
}

// Whether a top slot's item is drawn by the original code in its original place: the battery
// value or current weather in the first slot, the forecast in the second
static bool prv_top_slot_is_classic(int top, uint8_t kind) {
  return top == 0 ? (kind == TEXT_ROW_BATTERY || kind == TEXT_ROW_WEATHER) : kind == TEXT_ROW_FORECAST;
}

// Whether any complication slot shows `kind` (the text rows only while they're on)
static bool __attribute__((unused)) prv_slot_shows(uint8_t kind) {
  return settings.TopSlot1 == kind || settings.TopSlot2 == kind ||
         (prv_text_rows_on() && (settings.TextRow1 == kind || settings.TextRow2 == kind));
}

#endif

static void prv_update_steps(void) {
  #if defined(PBL_HEALTH)
  bool row_steps = prv_slot_shows(TEXT_ROW_STEPS);
  if (!prv_subdial_shows_steps() && !row_steps) {
    return;
  }
  time_t start = time_start_of_today();
  time_t now = time(NULL);
  s_steps_today = (health_service_metric_accessible(HealthMetricStepCount, start, now) & HealthServiceAccessibilityMaskAvailable)
                  ? (int32_t)health_service_sum_today(HealthMetricStepCount) : -1;
  if (settings.SubDialChoice == SUBDIAL_STEPS_AVERAGE) {
    time_t end = start + SECONDS_PER_DAY;
    if (health_service_metric_averaged_accessible(HealthMetricStepCount, start, end, HealthServiceTimeScopeDaily)
        & HealthServiceAccessibilityMaskAvailable) {
      s_steps_avg_day = (int32_t)health_service_sum_averaged(HealthMetricStepCount, start, end, HealthServiceTimeScopeDaily);
      s_steps_avg_now = (int32_t)health_service_sum_averaged(HealthMetricStepCount, start, now, HealthServiceTimeScopeDaily);
    } else {
      s_steps_avg_day = s_steps_avg_now = -1;
    }
  }
  #endif
}

// The language for weekday and month names: the date language setting, or the watch's own
static const char *prv_date_language(void) {
  return strcmp(settings.DateLanguage, "auto") == 0 ? i18n_get_system_locale() : settings.DateLanguage;
}

// ISO week number: weeks start on Monday and week 1 is the one with the year's first Thursday
static bool prv_is_leap(int year) { return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0; }
static int prv_weeks_in_year(int year) {   // 53 if 1 January is a Thursday, or a Wednesday in a leap year
  int y = year - 1;
  int jan1 = (1 + 5 * (y % 4) + 4 * (y % 100) + 6 * (y % 400)) % 7;   // 0 = Sunday
  return (jan1 == 4 || (jan1 == 3 && prv_is_leap(year))) ? 53 : 52;
}
static int prv_iso_week(const struct tm *t) {
  int year = t->tm_year + 1900;
  int wday = (t->tm_wday + 6) % 7;   // 0 = Monday
  int week = (t->tm_yday - wday + 10) / 7;
  if (week < 1) {
    return prv_weeks_in_year(year - 1);
  }
  if (week > prv_weeks_in_year(year)) {
    return 1;
  }
  return week;
}

// "Week" as each date language shortens it before a week number (no full stop where it's optional)
static const char *prv_week_word(const char *lang) {
  static const char *const words[][2] = {
    { "es", "SEM" }, { "fr", "SEM" }, { "pt", "SEM" }, { "it", "SETT" }, { "de", "KW" },
    { "sv", "V" }, { "da", "UGE" }, { "no", "UKE" }, { "nb", "UKE" }, { "fi", "VK" }, { "nl", "WK" },
  };
  for (size_t i = 0; i < ARRAY_LENGTH(words); i++) {
    if (strncmp(lang, words[i][0], 2) == 0) { return words[i][1]; }
  }
  return "WK";   // English, and any other language
}

// The date in format `fmt` (DATE_FMT_*), weekday and month names in the date language
static void prv_format_date(int fmt, char *out, size_t size) {
  #ifdef BACKLIGHTON
  snprintf(out, size, "WED 30");
  return;
  #endif
  if (!prv_tick_time) { out[0] = 0; return; }
  const char *lang = prv_date_language();
  int day = prv_tick_time->tm_mday;
  char weekday[5], month[10];
  fetchwday(prv_tick_time->tm_wday, lang, weekday);
  fetchmonth(prv_tick_time->tm_mon, lang, month);
  switch (fmt) {
    case DATE_FMT_MONTH_DAY: snprintf(out, size, "%s %d", month, day); break;
    case DATE_FMT_DAY_MONTH: snprintf(out, size, "%d %s", day, month); break;
    case DATE_FMT_DAY:       snprintf(out, size, "%d", day); break;
    case DATE_FMT_DAY2:      snprintf(out, size, "%02d", day); break;
    case DATE_FMT_WEEK:      snprintf(out, size, "%s %d", prv_week_word(lang), prv_iso_week(prv_tick_time)); break;
    case DATE_FMT_WEEKDAY:   snprintf(out, size, "%s", weekday); break;
    case DATE_FMT_MONTH:     snprintf(out, size, "%s", month); break;
    default:                 snprintf(out, size, "%s %d", weekday, day); break;
  }
}

#ifdef HAS_COMPLICATIONS
// A time of day as the watch shows times: its 12/24-hour setting, "10:08" (or "10:08 PM" with
// ShowAMPM)
static void prv_format_clock(int hour, int minute, char *out, size_t size) {
  if (clock_is_24h_style()) {
    snprintf(out, size, settings.LeadingZero24 ? "%02d:%02d" : "%d:%02d", hour, minute);
  } else {
    const char *fmt = settings.LeadingZero12 ? (settings.ShowAMPM ? "%02d:%02d %s" : "%02d:%02d")
                                             : (settings.ShowAMPM ? "%d:%02d %s" : "%d:%02d");
    snprintf(out, size, fmt, hour % 12 ? hour % 12 : 12, minute, hour < 12 ? "AM" : "PM");
  }
}

#ifndef PBL_PLATFORM_APLITE
// A timezone row: "NYC 05:08" (label, if one is set, in capitals), or "--" while the offset is unknown
static void prv_format_timezone(int32_t offset, const char *label, char *out, size_t size) {
  if (offset == -1) { snprintf(out, size, "--"); return; }
  time_t remote = g_current_epoch + offset;
  struct tm *t = gmtime(&remote);
  char clock[12], tag[4];
  prv_format_clock(t->tm_hour, t->tm_min, clock, sizeof clock);
  size_t n = 0;
  for (; label[n] && n < sizeof tag - 1; n++) {
    tag[n] = (label[n] >= 'a' && label[n] <= 'z') ? label[n] - 32 : label[n];
  }
  tag[n] = 0;
  snprintf(out, size, n ? "%s %s" : "%s%s", tag, clock);
}
#endif

// Removes the last character (UTF-8: with its continuation bytes) and any spaces it leaves at the end
static void prv_cut_last_char(char *text) {
  size_t n = strlen(text);
  while (n > 0 && (text[n - 1] & 0xC0) == 0x80) { n--; }   // continuation bytes
  if (n > 0) { n--; }
  while (n > 0 && text[n - 1] == ' ') { n--; }
  text[n] = 0;
}

// The second top row's width: between the rain alert icon (its widest glyph, about 1.1 em) and the
// heat alert icon, either side of the centre, so its text is cut short rather than run into them
static int prv_top2_max_width(GRect bounds) {
  int centre = bounds.size.w / 2 + 1;
  int left_room = centre - (config.RainIconRect[0].origin.x + WEATHER_ICON_PX * 11 / 10) - 3;
  int right_room = config.WarningIconRect[0].origin.x - centre - 3;
  return 2 * (left_room < right_room ? left_room : right_room);
}

// Copies `src` into `out` (`size` bytes, with the terminator) in capitals, as the fonts have no
// lower case. Returns the length.
static size_t prv_copy_capitals(const char *src, char *out, size_t size) {
  size_t n = 0;
  for (; src[n] && n < size - 1; n++) {
    char c = src[n];
    out[n] = (c >= 'a' && c <= 'z') ? c - 32 : c;
  }
  out[n] = 0;
  return n;
}

// A text row's text (and icon, drawn before it, or NULL). False for an empty row.
//  - Time: the watch's 12/24-hour setting; "10:08", or "10:08 PM" with ShowAMPM.
//  - Steps: today's, with a thousands separator: "," for English, "." for the other languages
//    (by the date language, as the date is), unless StepSeparator picks one. "--" until known.
//  - Battery: "80%". Custom text: in capitals. Date: in the row's own format (date_fmt).
//  - From the weather (empty while weather is off; "--" until it has arrived): sunrise / sunset
//    (icon and time), UV ("UV 3 | 6"), precipitation ("30% | 1.2MM" or "30% | 0.05IN"),
//    the current icon and temperature, today's high | low.
//  - Timezones: "NYC 05:08".
// Aplite offers time, battery, custom text and date only.
// `slot` (SLOT_*) picks the custom text, time zone and date format.
static bool prv_text_row_text(int slot, uint8_t row, char *out, size_t size, const char **icon) {
  static const uint8_t *date_fmts[SLOT_COUNT] = { &settings.TopDate1, &settings.TopDate2,
                                                  &settings.TextRowDate1, &settings.TextRowDate2 };
  *icon = NULL;
  switch (row) {
    case TEXT_ROW_TIME:
      if (!prv_tick_time) { return false; }
      prv_format_clock(prv_tick_time->tm_hour, prv_tick_time->tm_min, out, size);
      return true;
    case TEXT_ROW_BATTERY:
      snprintf(out, size, "%d", battery_state_service_peek().charge_percent);   // no "%", as the battery value always was
      return true;
    case TEXT_ROW_CUSTOM:
      return prv_copy_capitals(s_slots.Text[slot], out, slot == SLOT_TOP2 ? SLOT_TOP2_TEXT_MAX + 1 : size) > 0;
    case TEXT_ROW_APP_FIRST:
    case TEXT_ROW_APP_FIRST + 1:
    case TEXT_ROW_APP_FIRST + 2:
    case TEXT_ROW_APP_FIRST + 3:
    case TEXT_ROW_APP_LAST:
      // "--" until the phone sends one (or while that position of the list is empty)
      if (prv_copy_capitals(s_app_text[row - TEXT_ROW_APP_FIRST], out, size) == 0) {
        snprintf(out, size, "--");
      }
      return true;
    case TEXT_ROW_DATE:
      prv_format_date(*date_fmts[slot], out, size);
      return true;
    #if defined(PBL_HEALTH)
    case TEXT_ROW_STEPS: {
      if (s_steps_today < 0) {
        snprintf(out, size, "--");
        return true;
      }
      char sep = settings.StepSeparator == 1 ? ',' : settings.StepSeparator == 2 ? '.' : 0;
      if (settings.StepSeparator == 0) {
        sep = strncmp(prv_date_language(), "en", 2) == 0 ? ',' : '.';
      }
      if (s_steps_today >= 1000 && sep) {
        snprintf(out, size, "%d%c%03d", (int)(s_steps_today / 1000), sep, (int)(s_steps_today % 1000));
      } else {
        snprintf(out, size, "%d", (int)s_steps_today);
      }
      return true;
    }
    #endif
    #ifndef PBL_PLATFORM_APLITE
    case TEXT_ROW_TZ2:
    case TEXT_ROW_TZ3:
      if (slot == SLOT_TOP2) { return false; }   // too short for a time zone
      prv_format_timezone(s_slots.Offset[slot], s_slots.Label[slot], out, size);
      return true;
    case TEXT_ROW_SUNRISE:
    case TEXT_ROW_SUNSET:
    case TEXT_ROW_SUN_NEXT: {
      if (!settings.UseWeather) { return false; }
      bool rise = row == TEXT_ROW_SUNRISE;
      if (row == TEXT_ROW_SUN_NEXT) {   // sunrise until it's happened, then sunset, then tomorrow's sunrise
        int now = prv_tick_time ? prv_tick_time->tm_hour * 60 + prv_tick_time->tm_min : 0;
        rise = !(settings.SunriseMin >= 0 && now >= settings.SunriseMin && settings.SunsetMin >= 0 && now < settings.SunsetMin);
      }
      int minutes = rise ? settings.SunriseMin : settings.SunsetMin;
      *icon = rise ? "\U0000F051" : "\U0000F052";
      if (minutes < 0) {
        snprintf(out, size, "--");
      } else {
        prv_format_clock(minutes / 60, minutes % 60, out, size);
      }
      return true;
    }
    case TEXT_ROW_UV:
      if (!settings.UseWeather) { return false; }
      if (settings.UVNow < 0) {
        snprintf(out, size, "UV --");
      } else if (settings.UVMax < 0) {
        snprintf(out, size, "UV %d", settings.UVNow);
      } else {
        snprintf(out, size, "UV %d | %d", settings.UVNow, settings.UVMax);
      }
      return true;
    case TEXT_ROW_PRECIP: {
      if (!settings.UseWeather) { return false; }
      if (settings.PrecipChance < 0 || settings.PrecipTenthMm < 0) {
        snprintf(out, size, "--");
        return true;
      }
      char amount[10];
      if (settings.PrecipInches) {
        int hundredths = (settings.PrecipTenthMm * 100 + 127) / 254;   // tenths of a mm -> hundredths of an inch
        snprintf(amount, sizeof amount, "%d.%02dIN", hundredths / 100, hundredths % 100);
      } else {
        snprintf(amount, sizeof amount, "%d.%dMM", settings.PrecipTenthMm / 10, settings.PrecipTenthMm % 10);
      }
      snprintf(out, size, "%d%% | %s", settings.PrecipChance, amount);
      return true;
    }
    #endif
    case TEXT_ROW_PHONE_BATTERY:
      // "--" until the phone sends it, and while it's away (the last level may be out of date)
      if (s_phone_battery < 0 || !connection_service_peek_pebble_app_connection()) {
        snprintf(out, size, "--");
      } else {
        snprintf(out, size, "%d", s_phone_battery);   // no "%", as the watch's battery
      }
      *icon = PHONE_ICON;
      return true;
    // the current weather and forecast: aplite too (its top slots offer them)
    case TEXT_ROW_WEATHER: {
      if (!settings.UseWeather) { return false; }
      time_t stale_after = (time_t)(settings.UpSlider * 90);   // as the weather at the top
      bool stale = s_last_weather_fetch == 0 || (g_current_epoch - s_last_weather_fetch) > stale_after;
      *icon = s_weather_refreshing ? WEATHER_REFRESHING_ICON : stale ? WEATHER_STALE_ICON : settings.iconnowstring;
      snprintf(out, size, "%s°", settings.tempstring);
      return true;
    }
    case TEXT_ROW_FORECAST:
      if (!settings.UseWeather) { return false; }
      snprintf(out, size, "%s°", settings.temphistring);
      return true;
    default:
      return false;
  }
}

// The font a complication's icon is drawn in, its pixel size, and how far (in % of that size) its
// box top sits above the text's cap middle
static GFont prv_slot_icon_font(const char *icon, int *px, int *top_pct) {
  *top_pct = TEXT_ROW_ICON_TOP_PCT;
  if (strcmp(icon, PHONE_ICON) == 0) {
    *px = PHONE_ICON_PX;
    *top_pct = PHONE_ICON_TOP_PCT;
    return FontPhoneIcon;
  }
  if (strcmp(icon, "\U0000F051") == 0 || strcmp(icon, "\U0000F052") == 0) {
    *px = SUN_ICON_PX;
    return FontSunIcons;
  }
  *px = WEATHER_ICON_PX;
  return FontWeatherIcons;
}

#endif

static void update_time_state(struct tm *tick_time) {
  minutes = tick_time->tm_min;
  hours = tick_time->tm_hour % 12;
  s_hours = tick_time->tm_hour;
  layer_mark_dirty(s_canvas_layer);
  layer_mark_dirty(s_date_battery_logo_layer);
  prv_update_steps();
  if (settings.SubDialChoice == 4 || prv_subdial_shows_steps()) {
    layer_mark_dirty(s_canvas_month_hand);   // battery or steps meter: pick up the latest every minute
  }
  if ((settings.SubDialChoice == 3 || settings.SubDialChoice == 6) && tick_time->tm_mon != s_month) {
    s_month = tick_time->tm_mon;
  }
  if (settings.EnableDate && tick_time->tm_mday != current_date) {
    current_date = tick_time->tm_mday;
    s_weekday = tick_time->tm_wday;
    s_month = tick_time->tm_mon;
  }
}

static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {

  #ifdef DEBUG
  APP_LOG(APP_LOG_LEVEL_DEBUG, "tick_handler fired: %02d:%02d", tick_time->tm_hour, tick_time->tm_min);
  #endif

  refresh_current_time();

  if (units_changed & MINUTE_UNIT) {
    #ifdef HAS_WEATHER
    // Ask the phone for fresh weather once it's UpSlider minutes old (only while weather is on)
    prv_request_weather_if_due();
    #endif

    update_time_state(tick_time);
  }

  // Update seconds hand on second change, but only if it's visible
  if (showSeconds && (units_changed & SECOND_UNIT)) {
    seconds = tick_time->tm_sec;
    if (!settings.SmoothSweep) {
      layer_mark_dirty(s_canvas_second_hand);
    }
  }
}

///second hand and second hand background

static void draw_seconds_tick (GContext *ctx, int angle, int length, GColor border_color) {
    GPoint origin = GPoint(config.seconds_circle_centre_x, config.seconds_circle_centre_y);
      GPoint p1 = polar_to_point_offset(origin, angle, config.second_hand_a - length );
      GPoint p2 = polar_to_point_offset(origin, angle, config.second_hand_a);
    
 
    graphics_context_set_antialiased(ctx, true);
    graphics_context_set_stroke_color(ctx, border_color);
    graphics_context_set_stroke_width(ctx, 1);
    graphics_draw_line(ctx, p1, p2);
}

static void draw_seconds_month_background(GContext *ctx) {

  GPoint origin = GPoint(config.seconds_circle_centre_x, config.seconds_circle_centre_y);
//  GPoint origin_offset = GPoint(origin.x + config.hands_shadow/2, origin.y + config.hands_shadow/2);

#ifdef PBL_COLOR
  GPoint origin_offset_minus = GPoint(origin.x - config.hands_shadow/2, origin.y - config.hands_shadow/2);
#else 
  GPoint origin_offset_minus = GPoint(origin.x - config.hands_shadow, origin.y - config.hands_shadow);
#endif

// Define shadow color
  GColor shadow_color = PBL_IF_BW_ELSE(settings.BWMinuteHandShadowColor,settings.MinuteHandShadowColor);
  //GColor seconds_complication_color = PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1);
  GColor seconds_complication_color = PBL_IF_BW_ELSE(settings.BWSubDialColor, settings.SubDialColor);

  // Set the antialiasing
  graphics_context_set_antialiased(ctx, true);

  // Draw the background shadow first, with a small offset
  graphics_context_set_fill_color(ctx, shadow_color);
  graphics_fill_circle(ctx, origin_offset_minus, config.seconds_circle_radius);

  // Draw a background coloured circle on top of the shadow
  graphics_context_set_fill_color(ctx, seconds_complication_color);
  graphics_fill_circle(ctx, origin, config.seconds_circle_radius - 1 );

  
  
  // 12 ticks (hours / months / seconds), or 10 for the battery and steps meters (one every 10%)
  int tick_count = (settings.SubDialChoice == 4 || prv_subdial_shows_steps()) ? 10 : 12;
  for (int i = 0; i < tick_count; i++) {
        int angle = i * 360 / tick_count - 90;
        draw_seconds_tick(ctx, angle, config.majorticklength, PBL_IF_BW_ELSE(settings.BWMajorTickColor, settings.MajorTickColor));
  }


}

static void draw_month_hand(GContext *ctx, int angle, int length, int back_length, GColor color) {
  GPoint origin = GPoint(config.seconds_circle_centre_x, config.seconds_circle_centre_y);
  GPoint origin_offset = GPoint(origin.x + config.hands_shadow/2, origin.y + config.hands_shadow/2);
 // GPoint origin_offset_minus = GPoint(origin.x - config.hands_shadow/2, origin.y - config.hands_shadow/2);

  GPoint p1 = polar_to_point_offset(origin, angle + 180, back_length);
  GPoint p2 = polar_to_point_offset(origin, angle, length);

  #ifdef PBL_BW
  GPoint p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
  GPoint p4 = polar_to_point_offset(origin_offset, angle, length);
  #endif

  // Define shadow color
  GColor shadow_color = PBL_IF_BW_ELSE(settings.BWMinuteHandShadowColor,settings.MinuteHandShadowColor);

  // Set the antialiasing
  graphics_context_set_antialiased(ctx, true);
 
  // Draw the shadow for the month hand centre, with a small offset

  graphics_context_set_fill_color(ctx, shadow_color);
  graphics_fill_circle(ctx, origin_offset, settings.SecondOuterCentreSize);

  // Draw the shadow for the second hand, with a small offset 
  #ifdef PBL_COLOR
  if(settings.ShadowOn){

  graphics_context_set_stroke_color(ctx, shadow_color);
  graphics_context_set_stroke_width(ctx, settings.MinuteHandThickness); // Same width as the hand
  graphics_draw_line(ctx, GPoint(p1.x + 2, p1.y + 2), GPoint(p2.x + 2, p2.y + 2));
  }
  #else

  if(settings.BWShadowOn){
        GPoint s1 = GPoint(p3.x, p3.y);
        GPoint s2 = GPoint(p4.x, p4.y);

        int sdx = s2.x - s1.x;
        int sdy = s2.y - s1.y;
        int len_sq = sdx*sdx + sdy*sdy;
        int len = 1;
        while (len * len < len_sq) len++;

        int px = (sdy * settings.MinuteHandThickness ) / len;
        int py = (sdx * settings.MinuteHandThickness ) / len;

        GPoint shadow_points[4] = {
          GPoint(s1.x - px, s1.y + py),
          GPoint(s1.x + px, s1.y - py),
          GPoint(s2.x + px, s2.y - py),
          GPoint(s2.x - px, s2.y + py),
        };
        GPathInfo shadow_path_info = { .num_points = 4, .points = shadow_points };
        GPath *shadow_path = gpath_create(&shadow_path_info);
        graphics_context_set_fill_color(ctx, shadow_color);
        gpath_draw_filled(ctx, shadow_path);
        gpath_destroy(shadow_path);
      }
  #endif
  // Now draw the second hand on top
  graphics_context_set_stroke_color(ctx, color);
  graphics_context_set_stroke_width(ctx, settings.MinuteHandThickness);
  graphics_draw_line(ctx, p1, p2);

}

static void draw_second_hand(GContext *ctx, int angle, int length, int back_length, GColor color) {
  GPoint origin = GPoint(config.seconds_circle_centre_x, config.seconds_circle_centre_y);
  GPoint origin_offset = GPoint(origin.x + config.hands_shadow/2, origin.y + config.hands_shadow/2);
 
  GPoint p1 = polar_to_point_offset(origin, angle + 180, back_length);
  GPoint p2 = polar_to_point_offset(origin, angle, length);
  #ifdef PBL_BW
  GPoint p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
  GPoint p4 = polar_to_point_offset(origin_offset, angle, length);
  #endif

  // Define shadow color
  GColor shadow_color = PBL_IF_BW_ELSE(settings.BWMinuteHandShadowColor,settings.MinuteHandShadowColor);
 
  // Set the antialiasing
  graphics_context_set_antialiased(ctx, !settings.SmoothSweep);
 
  // Draw the shadow for the second hand centre, with a small offset
  graphics_context_set_fill_color(ctx, shadow_color);
  graphics_fill_circle(ctx, origin_offset, settings.SecondOuterCentreSize);

  // Draw the shadow for the second hand, with a small offset
  #ifdef PBL_COLOR
  if(settings.ShadowOn){
  graphics_context_set_stroke_color(ctx, shadow_color);
  graphics_context_set_stroke_width(ctx, settings.MinuteHandThickness); // Same width as the hand
  graphics_draw_line(ctx, GPoint(p1.x + config.hands_shadow/2, p1.y + config.hands_shadow/2), GPoint(p2.x + config.hands_shadow/2, p2.y + config.hands_shadow/2));
  }
  #else
  if(settings.BWShadowOn){
        GPoint s1 = GPoint(p3.x, p3.y);
        GPoint s2 = GPoint(p4.x, p4.y);

        int sdx = s2.x - s1.x;
        int sdy = s2.y - s1.y;
        int len_sq = sdx*sdx + sdy*sdy;
        int len = 1;
        while (len * len < len_sq) len++;

        int px = (sdy * settings.MinuteHandThickness ) / len;
        int py = (sdx * settings.MinuteHandThickness ) / len;

        GPoint shadow_points[4] = {
          GPoint(s1.x - px, s1.y + py),
          GPoint(s1.x + px, s1.y - py),
          GPoint(s2.x + px, s2.y - py),
          GPoint(s2.x - px, s2.y + py),
        };
        GPathInfo shadow_path_info = { .num_points = 4, .points = shadow_points };
        GPath *shadow_path = gpath_create(&shadow_path_info);
        graphics_context_set_fill_color(ctx, shadow_color);
        gpath_draw_filled(ctx, shadow_path);
        gpath_destroy(shadow_path);
      }

  #endif
  // Now draw the second hand on top
  graphics_context_set_stroke_color(ctx, color);
  graphics_context_set_stroke_width(ctx, settings.MinuteHandThickness);
  graphics_draw_line(ctx, p1, p2);

  #ifdef DEBUG
  APP_LOG(APP_LOG_LEVEL_DEBUG, "second hand draw fired");
  #endif    
}

static void draw_seconds_center(GContext *ctx, GColor minutes_color, GColor seconds_color) {
  GPoint origin = GPoint(config.seconds_circle_centre_x, config.seconds_circle_centre_y);
  graphics_context_set_antialiased(ctx, true);

  graphics_context_set_fill_color(ctx, seconds_color);
  graphics_fill_circle(ctx, origin, settings.SecondOuterCentreSize); //started as 4

  graphics_context_set_fill_color(ctx, minutes_color);
  graphics_fill_circle(ctx, origin, settings.SecondInnerCentreSize); //started as 2

}


///analogue hands
static void draw_hour_hand(GContext *ctx, int angle, int length, int back_length, int rect_length_x, int rect_length_y, int corner_radius, GColor color) {
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds(s_canvas_layer);
  #endif

  GPoint origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  GPoint origin_offset = GPoint(origin.x + config.hands_shadow, origin.y + config.hands_shadow);
  GPoint p1;
  GPoint p2;
  GPoint p3;
  GPoint p4;
  
  #ifdef PBL_ROUND
      p1 = polar_to_point_offset(origin, angle + 180, back_length);
      p2 = polar_to_point_offset(origin, angle, length);
      p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
      p4 = polar_to_point_offset(origin_offset, angle, length);
  #else
    if(settings.ForegroundShape){
      p1 = polar_to_point_offset(origin, angle + 180, back_length);
      p2 = polar_to_point_offset(origin, angle, length);
      p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
      p4 = polar_to_point_offset(origin_offset, angle, length);
    }
    else{
      //GRect r = GRect(0, 0, bounds.size.w, bounds.size.h);
      p1 = polar_to_point_offset(origin, angle + 180, back_length);
      p2 = angle_to_rounded_rect_edge(origin, angle, bounds.size.w/2-rect_length_x, bounds.size.h/2-rect_length_y, corner_radius);
      p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
      p4 = angle_to_rounded_rect_edge(origin_offset, angle, bounds.size.w/2-rect_length_x, bounds.size.h/2-rect_length_y, corner_radius);

    }
  #endif
  // Define shadow color
  GColor shadow_color = PBL_IF_BW_ELSE(settings.BWMinuteHandShadowColor,settings.MinuteHandShadowColor);


  // Set the antialiasing
  graphics_context_set_antialiased(ctx, true);

  // Draw the shadow first, with a small offset
  graphics_context_set_stroke_color(ctx, shadow_color);
  graphics_context_set_fill_color(ctx, shadow_color);
  graphics_context_set_stroke_width(ctx, settings.HourHandThickness); // Same width as the hand
  
  #ifdef PBL_COLOR
  if(settings.ShadowOn){
    graphics_draw_line(ctx, 
        GPoint(p3.x, p3.y), 
        GPoint(p4.x, p4.y)
      );

       GPoint origin_back_offset = GPoint(p1.x + config.hands_shadow, p1.y + config.hands_shadow);
        graphics_fill_circle(ctx, origin_back_offset, settings.BackSize);
        graphics_fill_circle(ctx, origin_offset, settings.HourCentreSize); //started as 4
    }
  #else  //switch to a fill as grey is not available as a line colour on BW screens
  if(settings.BWShadowOn){
        GPoint s1 = GPoint(p3.x, p3.y);
        GPoint s2 = GPoint(p4.x, p4.y);

        int sdx = s2.x - s1.x;
        int sdy = s2.y - s1.y;
        int len_sq = sdx*sdx + sdy*sdy;
        int len = 1;
        while (len * len < len_sq) len++;

        int px = (sdy * settings.HourHandThickness ) / len;
        int py = (sdx * settings.HourHandThickness ) / len;

        GPoint shadow_points[4] = {
          GPoint(s1.x - px, s1.y + py),
          GPoint(s1.x + px, s1.y - py),
          GPoint(s2.x + px, s2.y - py),
          GPoint(s2.x - px, s2.y + py),
        };
        GPathInfo shadow_path_info = { .num_points = 4, .points = shadow_points };
        GPath *shadow_path = gpath_create(&shadow_path_info);
        graphics_context_set_fill_color(ctx, shadow_color);
        gpath_draw_filled(ctx, shadow_path);
        gpath_destroy(shadow_path);

        GPoint origin_back_offset = GPoint(p1.x + config.hands_shadow, p1.y + config.hands_shadow);
        graphics_fill_circle(ctx, origin_back_offset, settings.BackSize);
        graphics_fill_circle(ctx, origin_offset, settings.HourCentreSize); //started as 4
      }
  #endif  

   // Now draw the main hand on top
  graphics_context_set_stroke_color(ctx, color);
  graphics_context_set_stroke_width(ctx, settings.HourHandThickness);
  graphics_draw_line(ctx, p1, p2);

  graphics_context_set_fill_color(ctx, color);
  GPoint origin_back = GPoint(p1.x, p1.y);
  graphics_fill_circle(ctx, origin_back, settings.BackSize);

  graphics_context_set_fill_color(ctx, color);
  graphics_fill_circle(ctx, origin, settings.HourCentreSize); //started as 4

}

static void draw_minute_hand(GContext *ctx, int angle, int length, int back_length, int rect_length_x, int rect_length_y, int corner_radius, GColor color) {
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds(s_canvas_layer);
  #endif
  
  GPoint origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  GPoint origin_offset = GPoint(origin.x + config.hands_shadow, origin.y + config.hands_shadow);
  GPoint origin_offset_centre_shadow = GPoint(origin.x + config.hands_shadow/2, origin.y + config.hands_shadow/2);
  GPoint p1;
  GPoint p2;
  GPoint p3;
  GPoint p4;
  
  #ifdef PBL_ROUND
      p1 = polar_to_point_offset(origin, angle + 180, back_length);
      p2 = polar_to_point_offset(origin, angle, length);
      p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
      p4 = polar_to_point_offset(origin_offset, angle, length);
  #else
    if(settings.ForegroundShape){
      p1 = polar_to_point_offset(origin, angle + 180, back_length);
      p2 = polar_to_point_offset(origin, angle, length);
      p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
      p4 = polar_to_point_offset(origin_offset, angle, length);
    }
    else{
      //GRect r = GRect(0, 0, bounds.size.w, bounds.size.h);
      p1 = polar_to_point_offset(origin, angle + 180, back_length);
      p2 = angle_to_rounded_rect_edge(origin, angle, bounds.size.w/2-rect_length_x, bounds.size.h/2-rect_length_y, corner_radius);
      p3 = polar_to_point_offset(origin_offset, angle + 180, back_length);
      p4 = angle_to_rounded_rect_edge(origin_offset, angle, bounds.size.w/2-rect_length_x, bounds.size.h/2-rect_length_y, corner_radius);

    }
  #endif
  // Define shadow color
  GColor shadow_color = PBL_IF_BW_ELSE(settings.BWMinuteHandShadowColor,settings.MinuteHandShadowColor);


  // Set the antialiasing
  graphics_context_set_antialiased(ctx, true);

  // Draw the shadow first, with a small offset
  graphics_context_set_stroke_color(ctx, shadow_color);
  graphics_context_set_fill_color(ctx, shadow_color);
  graphics_context_set_stroke_width(ctx, settings.MinuteHandThickness); // Same width as the hand
  
  #ifdef PBL_COLOR
  if(settings.ShadowOn){
    graphics_draw_line(ctx, 
        GPoint(p3.x, p3.y), 
        GPoint(p4.x, p4.y)
      );

       
    }
  #else  //switch to a fill as grey is not available as a line colour on BW screens
  if(settings.BWShadowOn){
        GPoint s1 = GPoint(p3.x, p3.y);
        GPoint s2 = GPoint(p4.x, p4.y);

        int sdx = s2.x - s1.x;
        int sdy = s2.y - s1.y;
        int len_sq = sdx*sdx + sdy*sdy;
        int len = 1;
        while (len * len < len_sq) len++;

        int px = (sdy * settings.MinuteHandThickness ) / len;
        int py = (sdx * settings.MinuteHandThickness ) / len;

        GPoint shadow_points[4] = {
          GPoint(s1.x - px, s1.y + py),
          GPoint(s1.x + px, s1.y - py),
          GPoint(s2.x + px, s2.y - py),
          GPoint(s2.x - px, s2.y + py),
        };
        GPathInfo shadow_path_info = { .num_points = 4, .points = shadow_points };
        GPath *shadow_path = gpath_create(&shadow_path_info);
        graphics_context_set_fill_color(ctx, shadow_color);
        gpath_draw_filled(ctx, shadow_path);
        gpath_destroy(shadow_path);

       
      }
  #endif  

  GPoint origin_back_offset = GPoint(p1.x + config.hands_shadow/2, p1.y + config.hands_shadow/2);
        graphics_fill_circle(ctx, origin_back_offset, settings.BackSize);
        graphics_fill_circle(ctx, origin_offset_centre_shadow, settings.MinuteCentreSize); //started as 4

  // Now draw the main hand on top
  graphics_context_set_stroke_color(ctx, color);
  graphics_context_set_stroke_width(ctx, settings.MinuteHandThickness);
  graphics_draw_line(ctx, p1, p2);

  graphics_context_set_fill_color(ctx, color);
  GPoint origin_back = GPoint(p1.x, p1.y);
  graphics_fill_circle(ctx, origin_back, settings.BackSize);

  graphics_context_set_fill_color(ctx, color);
  graphics_fill_circle(ctx, origin, settings.MinuteCentreSize); //started as 4
  

}


static void draw_hand_center(GContext *ctx, GColor outer_color, GColor inner_color) {
  
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds(s_canvas_layer);
  #endif
  
  GPoint origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  graphics_context_set_antialiased(ctx, true);

  graphics_context_set_fill_color(ctx, inner_color);
  graphics_fill_circle(ctx, origin, settings.InnerCentreSize); //started as 2

}


static void draw_major_tick (GContext *ctx, int angle, int length, GColor fill_color, GColor border_color) {
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  GRect full_bounds = layer_get_bounds (s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds (s_canvas_layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif
  GPoint origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);
      GPoint p1;
      GPoint p2;

      #ifdef PBL_ROUND
        p1 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.outertickinset );
        p2 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.outertickinset + length);
      #else
        if(settings.ForegroundShape){
          p1 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.outertickinset );
          p2 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.outertickinset + length);
        }
        else{
          GRect r = GRect(0, 0, bounds.size.w, bounds.size.h);
          GPoint edge = angle_to_rect_edge(origin, angle, r);
          int32_t dx = cos_lookup(DEG_TO_TRIGANGLE(angle));
          int32_t dy = sin_lookup(DEG_TO_TRIGANGLE(angle));
          p2 = GPoint(edge.x - (int)((dx * config.tick_inset_outer) / TRIG_MAX_ANGLE),
                            edge.y - (int)((dy * config.tick_inset_outer) / TRIG_MAX_ANGLE));
          p1 = angle_to_rounded_rect_edge(origin, angle, config.majortickrect_w, config.majortickrect_h *bounds.size.h/full_bounds.size.h, config.corner_radius_majortickrect);
        }
      #endif
 
    graphics_context_set_antialiased(ctx, true);
    graphics_context_set_stroke_color(ctx, border_color);
    graphics_context_set_stroke_width(ctx, 3);
    graphics_draw_line(ctx, p1, p2);
}

static void draw_major_tick_inner_set (GContext *ctx, int angle, int length, GColor fill_color, GColor border_color) {
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  GRect full_bounds = layer_get_bounds (s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds (s_canvas_layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif
  
  GPoint origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);
      GPoint p1;
      GPoint p2;

      #ifdef PBL_ROUND
        p1 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.innertickinset );
        p2 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.innertickinset - length);
      #else
        if(settings.ForegroundShape){
          p1 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.innertickinset );
          p2 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.innertickinset - length);
        }
        else{
          GRect r = GRect(config.innertickinset, config.innertickinset, bounds.size.w - (config.innertickinset*2), bounds.size.h - (config.innertickinset*2));
          GPoint edge = angle_to_rect_edge(origin, angle, r);
          int32_t dx = cos_lookup(DEG_TO_TRIGANGLE(angle));
          int32_t dy = sin_lookup(DEG_TO_TRIGANGLE(angle));
          p2 = GPoint(edge.x - (int)((dx * config.tick_inset_inner) / TRIG_MAX_ANGLE),
                            edge.y - (int)((dy * config.tick_inset_inner) / TRIG_MAX_ANGLE));
          p1 = angle_to_rounded_rect_edge(origin, angle, config.majortickrect_w - config.innertickinset/2, (config.majortickrect_h *bounds.size.h/full_bounds.size.h) - config.innertickinset/2, config.corner_radius_majortickrect);
        }
      #endif
 
    graphics_context_set_antialiased(ctx, true);
    graphics_context_set_stroke_color(ctx, border_color);
    graphics_context_set_stroke_width(ctx, 3);
    graphics_draw_line(ctx, p1, p2);
}

static void draw_minor_tick(GContext *ctx, int angle, GColor border_color) {
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  GRect full_bounds = layer_get_bounds (s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds (s_canvas_layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif

  GPoint origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);
      GPoint p1;
      GPoint p2;

      #ifdef PBL_ROUND
          // The tick starts away from the center of the watch face.
          p1 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.outertickinset);
          // The tick ends closer to the edge.
          p2 = polar_to_point_offset(origin, angle, bounds.size.h / 2 );
      #else
        if(settings.ForegroundShape){
            p1 = polar_to_point_offset(origin, angle, bounds.size.h / 2 - config.outertickinset);
            p2 = polar_to_point_offset(origin, angle, bounds.size.h / 2 );
          }
          else{
            GRect r = GRect(0, 0, bounds.size.w, bounds.size.h);
            GPoint edge = angle_to_rect_edge(origin, angle, r);
            int32_t dx = cos_lookup(DEG_TO_TRIGANGLE(angle));
            int32_t dy = sin_lookup(DEG_TO_TRIGANGLE(angle));
            p2 = GPoint(edge.x - (int)((dx * config.tick_inset_outer) / TRIG_MAX_ANGLE),
                              edge.y - (int)((dy * config.tick_inset_outer) / TRIG_MAX_ANGLE));
            p1 = angle_to_rounded_rect_edge(origin, angle, config.minortickrect_w, config.minortickrect_h *bounds.size.h/full_bounds.size.h, config.corner_radius_minortickrect);
          }
      #endif

  graphics_context_set_antialiased(ctx, true);
  graphics_context_set_stroke_color(ctx, border_color);
  graphics_context_set_stroke_width(ctx, 1); // A thin line for minor ticks
  graphics_draw_line(ctx, p1, p2);
}

///////Roman numerals option
static void get_digit_string(int i, bool roman, char *out, size_t out_size) {
  if (roman) {
    switch (i) {
      case 2: snprintf(out, out_size, "II"); break;
      case 4: snprintf(out, out_size, "IIII"); break;
      case 6: snprintf(out, out_size, "VI"); break;
      case 8: snprintf(out, out_size, "VIII"); break;
      case 10: snprintf(out, out_size, "X"); break;
      case 12: snprintf(out, out_size, "XII"); break;
      default: snprintf(out, out_size, "%d", i); break;
    }
  } else {
    snprintf(out, out_size, "%d", i);
  }
}
//////////////////


#ifdef PBL_PLATFORM_APLITE //DON'T use FCTX a second time on Aplite: also use on Diorite and Flint as fctx is less efficient
#ifdef HAS_COMPLICATIONS
// Aplite: a complication's icon (or none) and text in the 16px font, centred together in `box`
// (the text box: its capitals' middle is 10 below the top). The icon is centred on the capitals
// as on the other watches.
// `max_w` (0 for none): the most the icon and text may take, the text cut short to fit
static void prv_draw_slot_aplite(GContext *ctx, const char *full_text, const char *icon, GRect box, int max_w) {
  char text[24];
  snprintf(text, sizeof text, "%s", full_text);
  int icon_px = 0, icon_top_pct = 0;
  GFont icon_font = icon ? prv_slot_icon_font(icon, &icon_px, &icon_top_pct) : NULL;
  GSize icon_size = icon ? graphics_text_layout_get_content_size(icon, icon_font, GRect(0, 0, 60, 40),
                                                                 GTextOverflowModeFill, GTextAlignmentLeft) : GSize(0, 0);
  int gap = icon ? 2 : 0;
  GSize text_size = graphics_text_layout_get_content_size(text, FontBattery, GRect(0, 0, box.size.w, 20),
                                                          GTextOverflowModeFill, GTextAlignmentLeft);
  while (max_w > 0 && text[0] && icon_size.w + gap + text_size.w > max_w) {
    prv_cut_last_char(text);
    text_size = graphics_text_layout_get_content_size(text, FontBattery, GRect(0, 0, box.size.w, 20),
                                                      GTextOverflowModeFill, GTextAlignmentLeft);
  }
  if (!icon) {
    graphics_draw_text(ctx, text, FontBattery, box, GTextOverflowModeFill, GTextAlignmentCenter, NULL);
    return;
  }
  int left = box.origin.x + (box.size.w - icon_size.w - 2 - text_size.w) / 2;
  int cap_middle = box.origin.y + 10;
  graphics_draw_text(ctx, icon, icon_font, GRect(left, cap_middle - icon_px * icon_top_pct / 100, icon_size.w + 2, icon_size.h + 4),
                     GTextOverflowModeFill, GTextAlignmentLeft, NULL);
  graphics_draw_text(ctx, text, FontBattery, GRect(left + icon_size.w + 2, box.origin.y, text_size.w + 4, 20),
                     GTextOverflowModeFill, GTextAlignmentLeft, NULL);
}

#endif

static void update_logo_date_battery_fctx_layer (Layer *layer, GContext *ctx) {
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this
  
  GRect bounds = layer_get_unobstructed_bounds(s_date_battery_logo_layer);

  // 28px digits, same size as basalt; 1px lower than the old 30px so they stay centred where they were
  GRect TwelveRect = GRect(1,6+1-4,bounds.size.w, 28);   // same place as diorite/flint
  GRect SixRect = GRect(1,bounds.size.h-28-11+1,bounds.size.w, 28);
  graphics_context_set_text_color(ctx, settings.BWHourDigitsColor);

  if (!settings.HourTicksOnly) {
    graphics_draw_text(ctx, settings.Roman ? "XII" : "12", FontHour, TwelveRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
    if(!settings.EnableDate){
      graphics_draw_text(ctx, settings.Roman ? "VI" : "6", FontHour, SixRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
    }
  }


  // The text rows (aplite: time, battery, custom text and date), in the 16px font: its capitals are 13
  // tall and start 3 below the text box's top, so the box starts 10 above each row's middle
#ifdef HAS_COMPLICATIONS
  if (prv_text_rows_on()) {
    uint8_t rows[2] = { settings.TextRow1, settings.TextRow2 };
    graphics_context_set_text_color(ctx, settings.BWBottomColor);
    for (int i = 0; i < 2; i++) {
      char text[24];
      const char *icon;
      if (!prv_text_row_text(SLOT_ROW1 + i, rows[i], text, sizeof text, &icon)) {
        continue;
      }
      int mid = config.seconds_circle_centre_y + (i ? 9 : -9);
      prv_draw_slot_aplite(ctx, text, icon, GRect(0, mid - 10, bounds.size.w, 20), 0);
    }
  }

  // The top slots' other items (the battery value is below; the current weather and forecast are
  // drawn by the weather layer), in the 16px font: in the battery value's place, and the forecast's
  {
    uint8_t kinds[2] = { settings.TopSlot1, settings.TopSlot2 };
    graphics_context_set_text_color(ctx, settings.BWBatteryWeatherColor);
    for (int i = 0; i < 2; i++) {
      char text[24];
      const char *icon;
      // the battery value and current weather in the first slot, and the forecast in the second,
      // are drawn as they always were (battery layer / weather layer); anything else here
      if (prv_top_slot_is_classic(i, kinds[i]) ||
          !prv_text_row_text(SLOT_TOP1 + i, kinds[i], text, sizeof text, &icon)) {
        continue;
      }
      GRect box = i ? GRect(1, config.BatteryYOffset + 20, bounds.size.w, 20)
                    : GRect(0, config.BatteryYOffset + (settings.EnableBatteryLine ? 0 : 4), bounds.size.w, 20);
      prv_draw_slot_aplite(ctx, text, icon, box, i ? prv_top2_max_width(bounds) : 0);
    }
  }

#endif

  //draw battery value
  if (SHOW_TOP_BATTERY()) {
     //if(strcmp(settings.PosTop, "lo") == 0){
      int s_battery_level = battery_state_service_peek().charge_percent;
      char BatterytoDraw[6];
            snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

      if (settings.EnableBatteryLine) {
        GRect BatteryRect = GRect((bounds.size.w / 2) - 18, config.BatteryYOffset, 36, 40);
        graphics_context_set_text_color(ctx, settings.BWBatteryWeatherColor);
        graphics_draw_text(ctx, BatterytoDraw, FontBattery, BatteryRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      }
      else{
        GRect BatteryRect = GRect((bounds.size.w / 2) - 18, config.BatteryYOffset + 4, 36, 40);
        graphics_context_set_text_color(ctx, settings.BWBatteryWeatherColor);
        graphics_draw_text(ctx, BatterytoDraw, FontBattery, BatteryRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      }
   
  }

  //draw weekday and date text
  if (settings.EnableDate ) {
  
    int yPosition;
    int yOffset = config.yOffset;
    int yWeekdayDateOffset = config.yWeekdayDateOffset + 88;
    int WeekdayDateHeight = config.WeekdayDateHeight;


          yPosition = config.DateBottomYPosition;

          graphics_context_set_antialiased(ctx, true);

            char datenow[15];

               prv_format_date(atoi(settings.DateFormat), datenow, sizeof(datenow));   // DATE_FMT_*

            GRect FullDateRect = 
                GRect(0, yPosition + yOffset +yWeekdayDateOffset, bounds.size.w, WeekdayDateHeight);

            graphics_context_set_text_color(ctx, settings.BWDateColor);
           
      #ifdef BACKLIGHTON
              graphics_draw_text(ctx, "24", FontDate, DateRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
              graphics_draw_text(ctx, "WED", FontDate, WeekdayRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      #else
                graphics_draw_text(ctx, datenow, FontDate, FullDateRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      #endif
                   
  }


}

#else   //use FCTX to antialise the digits better on all colour watches, still refers to B&W in case I change my mind later on non-APLITE watches

// Starts an fctx drawing context. Its anti-aliasing buffer is a byte per pixel: the whole screen
// (~24KB on basalt, ~32KB on chalk) where there's memory for it, which on basalt and chalk there
// often isn't (less still with a background texture, itself a screen-sized bitmap), so (src/c/fctx,
// changed from pebble-fctx for this) it then covers a band of rows and each fill is drawn band by
// band (prv_fill_text). Only if even an 8-row band can't be had does it fall back to fctx's black &
// white mode (1 bit per pixel, ~4KB): that frame's text is drawn without anti-aliasing instead of
// crashing. If even that fails, it returns false and the caller skips its text for this frame.
static bool prv_fctx_begin(FContext *fctx, GContext *ctx) {
  #ifdef PBL_COLOR
  fctx_enable_aa(true);
  #endif
  fctx_init_context(fctx, ctx);
  if (!fctx->flag_buffer) {
    fctx->gctx = NULL;   // so a stray fctx_deinit_context won't free a buffer that doesn't exist
    #ifdef PBL_COLOR
    APP_LOG(APP_LOG_LEVEL_WARNING, "fctx: no memory for anti-aliased text (%d bytes free), drawing without", (int)heap_bytes_free());
    fctx_enable_aa(false);
    fctx_init_context(fctx, ctx);
    if (!fctx->flag_buffer) {
      fctx->gctx = NULL;
      fctx_enable_aa(true);
      return false;
    }
    #else
    return false;
    #endif
  }
  fctx_set_color_bias(fctx, 0);
  return true;
}

// One piece of text, in the fctx font at the em height already set, turned by `rot` about `offset`:
// drawn in one go, or, where fctx only had memory for its anti-aliasing buffer to cover a band of the
// screen (basalt and chalk, often), measured first and then drawn band by band down its height.
// The same picture either way. (As Loupe's prv_fill.)
static void prv_fill_text(FContext *fctx, const char *text, GTextAlignment align, FTextAnchor anchor,
                          uint32_t rot, FPoint offset) {
  fctx_set_rotation(fctx, rot);
  fctx_set_offset(fctx, offset);
  int band = fctx_band_rows(fctx), h = fctx->flag_bounds.size.h;
  if (band >= h) {
    fctx_begin_fill(fctx);
    fctx_draw_string(fctx, text, FCTX_Font, align, anchor);
    fctx_end_fill(fctx);
    return;
  }
  fctx->band_y = 0;
  fctx->measuring = true;   // its extent, without drawing
  fctx_begin_fill(fctx);
  fctx_draw_string(fctx, text, FCTX_Font, align, anchor);
  fctx->measuring = false;
  int top = FIXED_TO_INT(fctx->extent_min.y) - 1, bottom = FIXED_TO_INT(fctx->extent_max.y) + 1;
  if (top < 0) { top = 0; }
  if (bottom > h - 1) { bottom = h - 1; }
  for (int y = top; y <= bottom; y += band) {
    fctx->band_y = y;
    fctx_begin_fill(fctx);
    fctx_draw_string(fctx, text, FCTX_Font, align, anchor);
    fctx_end_fill(fctx);
  }
  fctx->band_y = 0;
}

// A complication slot's icon (or none) and text, centred together on x with the text's capitals
// middled on y. The icon is in the weather icon font: the sunrise/sunset icons sized to the text,
// the current weather's as at the top.
// `max_w` (0 for none): the most the icon and text may take, the text cut short to fit
static void prv_draw_slot(GContext *ctx, FContext *fctx, const char *full_text, const char *icon, int x, int y,
                          int em, GColor colour, int max_w) {
  GTextAlignment align = GTextAlignmentCenter;
  char text[24];
  snprintf(text, sizeof text, "%s", full_text);
  fctx_set_fill_color(fctx, colour);
  fctx_set_text_em_height(fctx, FCTX_Font, em);
  GSize icon_size = GSize(0, 0);
  int icon_px = 0, icon_top_pct = 0;
  GFont icon_font = NULL;
  int gap = 0;
  if (icon) {
    icon_font = prv_slot_icon_font(icon, &icon_px, &icon_top_pct);
    icon_size = graphics_text_layout_get_content_size(icon, icon_font, GRect(0, 0, 60, 40),
                                                      GTextOverflowModeFill, GTextAlignmentLeft);
    gap = em / 6;
  }
  int text_w = FIXED_TO_INT(fctx_string_width(fctx, text, FCTX_Font));
  while (max_w > 0 && text[0] && icon_size.w + gap + text_w > max_w) {
    prv_cut_last_char(text);
    text_w = FIXED_TO_INT(fctx_string_width(fctx, text, FCTX_Font));
  }
  if (icon) {
    int left = x - (icon_size.w + gap + text_w) / 2;
    graphics_context_set_text_color(ctx, colour);
    graphics_draw_text(ctx, icon, icon_font, GRect(left, y - icon_px * icon_top_pct / 100, icon_size.w + 2, icon_size.h + 4),
                       GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    x = left + icon_size.w + gap;
    align = GTextAlignmentLeft;
  }
  prv_fill_text(fctx, text, align, FTextAnchorCapMiddle, 0, FPointI(x, y));
}

static void update_logo_date_battery_fctx_layer (Layer *layer, GContext *ctx) {
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this
  
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);
  #else   // gabbro: Quick View doesn't shrink the face, so draw at full size underneath it
  GRect bounds = layer_get_bounds(layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif

  FContext fctx;
  if (!prv_fctx_begin(&fctx, ctx)) {
    return;
  }

  
  if (!settings.HourTicksOnly) {
    if(!settings.EnableDate){
       for (int i = 1; i < 13; i++) {
        if (i % 2 == 0){
          fctx_set_text_em_height(&fctx, FCTX_Font, settings.Roman ? ((config.font_size_digits-config.romanadjust) * bounds.size.h/full_bounds.size.h) : config.font_size_digits* bounds.size.h/full_bounds.size.h);
          fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWHourDigitsColor, settings.HourDigitsColor));
          char digit_string[6];
          int32_t digit_angle = i * 30 ;
          int32_t digit_angle_trig = (TRIG_MAX_ANGLE * digit_angle) / 360;
          int32_t digit_rotation; // = digit_angle_trig; // if you want rotation to match position angle

          if(i < 4 || i > 9){
                digit_rotation = digit_angle_trig;//  TRIG_MAX_ANGLE / 2;
              }
              else{
                digit_rotation = digit_angle_trig + TRIG_MAX_ANGLE / 2;
              }

          fixed_t text_radius = INT_TO_FIXED(settings.Roman ? (bounds.size.w/2 * bounds.size.h/full_bounds.size.h) - config.digit_inset - config.romanadjust/2: (bounds.size.w/2 * bounds.size.h/full_bounds.size.h) - config.digit_inset );
        
          get_digit_string(i, settings.Roman, digit_string, sizeof digit_string);
          #ifdef PBL_RECT
          FPoint center_digits = FPointI(bounds.size.w / 2 + 1, bounds.size.h / 2);
          #else
          FPoint center_digits = FPointI(full_bounds.size.w / 2 + 1, full_bounds.size.h / 2);
          #endif
          FPoint p = clockToCartesian(center_digits, text_radius, digit_angle_trig);
          prv_fill_text(&fctx, digit_string, GTextAlignmentCenter, FTextAnchorMiddle, digit_rotation, p);
      
        }
       }
      }
      else{
         for (int i = 1; i < 13; i++) {
        if (i % 2 == 0 && i != 6){
          fctx_set_text_em_height(&fctx, FCTX_Font, settings.Roman ? ((config.font_size_digits-config.romanadjust) * bounds.size.h/full_bounds.size.h) : config.font_size_digits* bounds.size.h/full_bounds.size.h);
          fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWHourDigitsColor, settings.HourDigitsColor));
          char digit_string[6];
          int32_t digit_angle = i * 30 ;
          int32_t digit_angle_trig = (TRIG_MAX_ANGLE * digit_angle) / 360;
          int32_t digit_rotation; // = digit_angle_trig; // if you want rotation to match position angle

          if(i < 4 || i > 9){
                digit_rotation = digit_angle_trig;//  TRIG_MAX_ANGLE / 2;
              }
              else{
                digit_rotation = digit_angle_trig + TRIG_MAX_ANGLE / 2;
              }

          fixed_t text_radius = INT_TO_FIXED(settings.Roman ? (bounds.size.w/2 * bounds.size.h/full_bounds.size.h) - config.digit_inset - config.romanadjust/2: (bounds.size.w/2 * bounds.size.h/full_bounds.size.h) - config.digit_inset );
        
          get_digit_string(i, settings.Roman, digit_string, sizeof digit_string);
          #ifdef PBL_RECT
          FPoint center_digits = FPointI(bounds.size.w / 2 + 1, bounds.size.h / 2);
          #else
          FPoint center_digits = FPointI(full_bounds.size.w / 2 + 1, full_bounds.size.h / 2);
          #endif
          FPoint p = clockToCartesian(center_digits, text_radius, digit_angle_trig);
          prv_fill_text(&fctx, digit_string, GTextAlignmentCenter, FTextAnchorMiddle, digit_rotation, p);
      
        }
       }
      }
  }

  //draw weekday and date text
  if (settings.EnableDate ) {

  
    fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));

    minutes = prv_tick_time->tm_min;
    hours = prv_tick_time->tm_hour % 12;

    FPoint fulldate_pos;

    int font_size_date = config.font_size_date * bounds.size.h/full_bounds.size.h;

    int yOffset = config.yOffset;
    int yOffsetFctx = config.yOffsetFctx;
    int yWeekdayDateOffset = config.yWeekdayDateOffset;
  
      fulldate_pos.x = INT_TO_FIXED(bounds.size.w/2);
      fulldate_pos.y = INT_TO_FIXED(bounds.size.h - config.DateBottomYPosition + yOffset + yOffsetFctx + yWeekdayDateOffset);

    fctx_set_text_em_height(&fctx, FCTX_Font, font_size_date);

    char datenow[15];
 
              prv_format_date(atoi(settings.DateFormat), datenow, sizeof(datenow));   // DATE_FMT_*

    #ifdef BACKLIGHTON
    prv_fill_text(&fctx, "WED 30", GTextAlignmentCenter, FTextAnchorTop, 0, fulldate_pos);
    #else
    prv_fill_text(&fctx, datenow, GTextAlignmentCenter, FTextAnchorTop, 0, fulldate_pos);
    #endif


  }

  // The two text rows, in the sub-dial's place (while it's off): centred on where its centre
  // would be, three quarters of the date's size, in the date's colour. Hidden while Quick View
  // squeezes a rectangular face, as the sub-dial is.
  if (prv_text_rows_on() && grect_equal(&full_bounds, &bounds)) {
    int row_em = config.font_size_date * TEXT_ROW_EM_PCT / 100;
    int half_step = row_em * TEXT_ROW_CAP_PCT / 100 * (100 + TEXT_ROW_GAP_PCT) / 200;
    uint8_t rows[2] = { settings.TextRow1, settings.TextRow2 };
    GColor row_colour = PBL_IF_BW_ELSE(settings.BWBottomColor, settings.BottomColor);
    for (int i = 0; i < 2; i++) {
      char text[24];
      const char *icon;
      if (prv_text_row_text(SLOT_ROW1 + i, rows[i], text, sizeof text, &icon)) {
        prv_draw_slot(ctx, &fctx, text, icon, config.seconds_circle_centre_x,
                      config.seconds_circle_centre_y + (i ? half_step : -half_step), row_em, row_colour, 0);
      }
    }
  }

  // The top slots' other items (the battery value is below; the current weather and forecast are
  // drawn by the weather layer): in the battery value's place at its size, and the forecast's
  // place at its size. Hidden while Quick View squeezes a rectangular face, as the battery value is.
  if (grect_equal(&full_bounds, &bounds)) {
    uint8_t kinds[2] = { settings.TopSlot1, settings.TopSlot2 };
    GColor top_colour = PBL_IF_BW_ELSE(settings.BWBatteryWeatherColor, settings.BatteryWeatherColor);
    for (int i = 0; i < 2; i++) {
      char text[24];
      const char *icon;
      // the battery value and current weather in the first slot, and the forecast in the second,
      // are drawn as they always were (battery layer / weather layer); anything else here
      if (prv_top_slot_is_classic(i, kinds[i]) ||
          !prv_text_row_text(SLOT_TOP1 + i, kinds[i], text, sizeof text, &icon)) {
        continue;
      }
      int em = i ? config.font_size_battery + 2 : config.font_size_battery;
      int top = i ? config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z + config.forecast_offset
                  : config.BatteryYOffset + config.yOffsetFctx + (settings.EnableBatteryLine ? config.battery_pos_z : config.battery_pos_y);
      prv_draw_slot(ctx, &fctx, text, icon, bounds.size.w / 2 + i, top + em * TOP_SLOT_CAP_MIDDLE_PCT / 100, em, top_colour,
                    i ? prv_top2_max_width(bounds) : 0);
    }
  }


  
    //draw battery value
  #ifdef HAS_WEATHER
  if (SHOW_TOP_BATTERY() && grect_equal(&full_bounds, &bounds)) {
  
            fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWBatteryWeatherColor, settings.BatteryWeatherColor));
            FPoint battery_pos;
            
            int font_size_battery = config.font_size_battery * bounds.size.h/full_bounds.size.h;
            
            int s_battery_level = battery_state_service_peek().charge_percent;
            fctx_set_text_em_height(&fctx, FCTX_Font, font_size_battery);

                // Formats and draws the battery percentage text
              if (settings.EnableBatteryLine) {

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 1));
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  prv_fill_text(&fctx, BatterytoDraw, GTextAlignmentCenter, FTextAnchorTop, 0, battery_pos);
                }
                else { //shift the percentage text slightly when there's no battery line

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2) );
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_y)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  prv_fill_text(&fctx, BatterytoDraw, GTextAlignmentCenter, FTextAnchorTop, 0, battery_pos);
                }
     
  }
  #else
  if (SHOW_TOP_BATTERY() && grect_equal(&full_bounds, &bounds)) {
  
            fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWBatteryWeatherColor, settings.BatteryWeatherColor));
            FPoint battery_pos;
            
            int font_size_battery = config.font_size_battery * bounds.size.h/full_bounds.size.h;
            
            int s_battery_level = battery_state_service_peek().charge_percent;
            fctx_set_text_em_height(&fctx, FCTX_Font, font_size_battery);

                // Formats and draws the battery percentage text
              if (settings.EnableBatteryLine) {

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 1));
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  prv_fill_text(&fctx, BatterytoDraw, GTextAlignmentCenter, FTextAnchorTop, 0, battery_pos);
                }
                else { //shift the percentage text slightly when there's no battery line

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2) );
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_y)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  prv_fill_text(&fctx, BatterytoDraw, GTextAlignmentCenter, FTextAnchorTop, 0, battery_pos);
                }
     
  }
  #endif


    fctx_deinit_context(&fctx);
      
}
#endif

// Update procedure for the seconds hand layer
static void layer_update_proc_seconds_hand(Layer *layer, GContext *ctx) {
        
    if (settings.SubDialChoice != 1 && settings.SubDialChoice != 2 && settings.SubDialChoice != 6) {
    return;
    }

    if ((!showSeconds && !settings.AlwaysShowSubDial) || !prv_tick_time) {
      // Do not draw the second hand if it should be hidden or if time data is not yet available
      return;
    }

    GRect bounds = layer_get_unobstructed_bounds(layer);
    GRect full_bounds = layer_get_bounds(layer);

    if (!grect_equal(&full_bounds, &bounds)) {
      return;
    }

    int seconds_angle;

    if (settings.SmoothSweep) {
      time_t sweep_epoch;
      uint16_t sweep_ms;
      time_ms(&sweep_epoch, &sweep_ms);
      struct tm *sweep_time = localtime(&sweep_epoch);
      seconds = sweep_time->tm_sec;
      seconds_angle = (seconds * 6) + ((sweep_ms * 6) / 1000) - 90;
    } else {
      seconds = prv_tick_time->tm_sec;
      seconds_angle = (seconds * 6) - 90;
    }

 // draw_seconds_month_background(ctx);
  draw_second_hand(ctx, seconds_angle, config.second_hand_a, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor));
  draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor));
}

static void layer_update_proc_complication(Layer *layer, GContext *ctx) {
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this

    if ((settings.SubDialChoice != 3 && 
    settings.SubDialChoice != 1 && settings.SubDialChoice != 2 && settings.SubDialChoice != 6)) {
      return;
    }

    if((!showSeconds && !settings.AlwaysShowSubDial) || !prv_tick_time){
    return;
    }

    GRect bounds = layer_get_unobstructed_bounds(layer);
    GRect full_bounds = layer_get_bounds(layer);

    if (!grect_equal(&full_bounds, &bounds)) {
      return;
    }
       
    draw_seconds_month_background(ctx);
  
}


// Steps meter (sub-dial 7: today vs your target; 8: today vs your average day). The hand goes
// round with today's steps, 12 o'clock being the target or your average whole day, and stops
// at 12 once you pass it. On 8 a small marker on the rim shows your usual steps by this time of
// day, so you can see if you're ahead or behind. Hand: sub-dial hand 1 (seconds) colour;
// marker: the major tickmark colour (the preset themes give both sub-dial hands the same colour,
// so a hand-2 marker would vanish into the hand). No hand while the step count isn't available.
static void prv_draw_steps_subdial(GContext *ctx) {
  draw_seconds_month_background(ctx);
  GColor hand_colour = PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor);
  #if defined(PBL_HEALTH)
  GPoint origin = GPoint(config.seconds_circle_centre_x, config.seconds_circle_centre_y);
  int32_t full = settings.SubDialChoice == SUBDIAL_STEPS_TARGET ? (int32_t)settings.StepTarget * 1000 : s_steps_avg_day;
  if (settings.SubDialChoice == SUBDIAL_STEPS_AVERAGE && full > 0 && s_steps_avg_now >= 0) {
    int32_t pace = s_steps_avg_now < full ? s_steps_avg_now : full;
    int marker_angle = (int)(pace * 360 / full) - 90;
    int tip = config.second_hand_a - config.majorticklength - 1;
    int rim = config.second_hand_a + 1;
    GPoint pts[3] = { polar_to_point_offset(origin, marker_angle, tip),
                      polar_to_point_offset(origin, marker_angle - STEPS_MARKER_HALF_DEG, rim),
                      polar_to_point_offset(origin, marker_angle + STEPS_MARKER_HALF_DEG, rim) };
    GPath marker = { .num_points = 3, .points = pts, .rotation = 0, .offset = GPointZero };
    graphics_context_set_antialiased(ctx, true);
    graphics_context_set_fill_color(ctx, PBL_IF_BW_ELSE(settings.BWMajorTickColor, settings.MajorTickColor));
    gpath_draw_filled(ctx, &marker);
  }
  if (full > 0 && s_steps_today >= 0) {
    int32_t steps = s_steps_today < full ? s_steps_today : full;
    int angle = (int)(steps * 360 / full) - 90;
    draw_month_hand(ctx, angle, config.second_hand_a, config.second_hand_b, hand_colour);
  }
  #endif
  draw_seconds_center(ctx, PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), hand_colour);
}

static void layer_update_proc_month_hand(Layer *layer, GContext *ctx) {
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this

    if(settings.SubDialChoice != 3 && settings.SubDialChoice != 6 && settings.SubDialChoice != 4 && !prv_subdial_shows_steps()){
    return;
      }

   GRect bounds = layer_get_unobstructed_bounds(layer);
   GRect full_bounds = layer_get_bounds(layer);

    if (!grect_equal(&full_bounds, &bounds)) {
      return;
    }
    if (prv_subdial_shows_steps()) {
      prv_draw_steps_subdial(ctx);
      return;
    }
    if (settings.SubDialChoice == 4) {
      // Battery meter: the hand goes round with the charge - 12 o'clock is full (100%),
      // 9 is 75%, 6 is 50%, 3 is 25%. Uses the sub-dial hand 2 (month hand) colour.
      int battery_angle = battery_state_service_peek().charge_percent * 360 / 100 - 90;
      draw_seconds_month_background(ctx);
      draw_month_hand(ctx, battery_angle, config.second_hand_a, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
      draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
      return;
    }

       //month = prv_tick_time->tm_mon;
    int month = s_month + 1;    
  
    int month_angle = month * 30 - 90;   // month/12 of a turn; integer maths (floating point costs ~2KB of code on aplite)


    draw_seconds_month_background(ctx);
    draw_month_hand(ctx, month_angle, config.second_hand_a, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
   draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));

}

static void layer_update_proc_tz(Layer *layer, GContext *ctx) {
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this

    if(settings.SubDialChoice != 5 ){
    return;
      }

    GRect bounds = layer_get_unobstructed_bounds(layer);
    GRect full_bounds = layer_get_bounds(layer);

      if (!grect_equal(&full_bounds, &bounds)) {
        return;
      }

      time_t remote_epoch = g_current_epoch + settings.tz_offset;
      g_remote_time = *gmtime(&remote_epoch);

      bool remote_pm = g_remote_time.tm_hour >= 12;
      int remotehour = g_remote_time.tm_hour % 12;
      int remoteminute = g_remote_time.tm_min;

      int hour_angle = ((remotehour * 60 + remoteminute) * 30) / 60 - 90;
      int minute_angle = (remoteminute * 6) - 90;

      GPoint hand_origin = GPoint(config.seconds_circle_centre_x, config.seconds_circle_centre_y);

     draw_seconds_month_background(ctx);
    
     if (remoteminute != prv_tick_time->tm_min) {
      draw_month_hand(ctx, hour_angle, config.second_hand_a * 3/4, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
      if (remote_pm && settings.showremoteAMPM) {
        GPoint pm_dot = polar_to_point_offset(hand_origin, hour_angle, (config.second_hand_a * 3/4)/2);
        graphics_context_set_fill_color(ctx, PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
        graphics_fill_circle(ctx, pm_dot, settings.MinuteHandThickness * 3 / 2);
      }
     }
     else{
      draw_month_hand(ctx, hour_angle, config.second_hand_a , config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
      draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
      if (remote_pm && settings.showremoteAMPM) {
        GPoint pm_dot = polar_to_point_offset(hand_origin, hour_angle, (config.second_hand_a)/2);
        graphics_context_set_fill_color(ctx, PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
        graphics_fill_circle(ctx, pm_dot, settings.MinuteHandThickness * 3 / 2);
      }
     }
    
 
     if (remoteminute != prv_tick_time->tm_min) {
       draw_second_hand(ctx, minute_angle, config.second_hand_a, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor));
       draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor)); 
      }
     
     

}


static void layer_update_proc_battery_line(Layer *layer, GContext *ctx) {
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this

  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);
  #else   // gabbro: Quick View doesn't shrink the face, so draw at full size underneath it
  GRect bounds = layer_get_bounds(layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif

    // If neither element is enabled in config, stop.
    if (!settings.EnableBatteryLine) {
        return;
    }

    int s_battery_level = battery_state_service_peek().charge_percent;

    // Draw battery line
   
    if (settings.EnableBatteryLine) {
        int width_rect = (s_battery_level * config.battery_line) / 100 * bounds.size.h/full_bounds.size.h;
        int rect_x_pos = (bounds.size.w/2) - (width_rect/2);

        GRect BatteryLineRect = GRect(rect_x_pos,config.BatteryLineYOffset * bounds.size.h/full_bounds.size.h,width_rect, 2);
        graphics_context_set_antialiased(ctx, true);
        graphics_context_set_fill_color(ctx, PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.BatteryLineColor));
        graphics_fill_rect(ctx,BatteryLineRect, 1, GCornersBottom);
    }
    
}

//Update procedure for the Bluetooth Icon (shows when disconnected) layer
static void layer_update_proc_bt(Layer * layer, GContext * ctx){
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);
  #else   // gabbro: Quick View doesn't shrink the face, so draw at full size underneath it
  GRect bounds = layer_get_bounds(layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif

  if (!grect_equal(&full_bounds, &bounds)) {
    return;
  }

  GRect BTIconRect = config.BTIconRect[0];

#ifdef PBL_COLOR
 graphics_context_set_text_color(ctx, settings.BTQTColor);
 #else
  graphics_context_set_text_color(ctx, settings.BWBTQTColor);
 #endif

 graphics_context_set_antialiased(ctx, true);
 graphics_draw_text(ctx, "z", FontBTQTIcons, BTIconRect, GTextOverflowModeFill,GTextAlignmentCenter, NULL);


}

//Update procedure for the QT Icon layer (shows when Quiet time is active)
static void layer_update_proc_qt(Layer * layer, GContext * ctx){
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this

  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);
  #else   // gabbro: Quick View doesn't shrink the face, so draw at full size underneath it
  GRect bounds = layer_get_bounds(layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif

    if (!grect_equal(&full_bounds, &bounds)) {
      return;
    }


  GRect QTIconRect = config.QTIconRect[0];

 quiet_time_icon(); //checks whether quiet time is active

 #ifdef PBL_COLOR
  graphics_context_set_text_color(ctx, settings.BTQTColor);
  #else
   graphics_context_set_text_color(ctx, settings.BWBTQTColor);
  #endif
  graphics_context_set_antialiased(ctx, true);
  graphics_draw_text(ctx, "\U0000E061", FontBTQTIcons, QTIconRect, GTextOverflowModeFill,GTextAlignmentCenter, NULL);

}

// Update procedure for the main canvas layer (hour & minute hands)
static void hour_min_hands_canvas_update_proc(Layer *layer, GContext *ctx) {

  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  GRect full_bounds = layer_get_bounds (s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds (s_canvas_layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif


#ifdef BACKLIGHTON
  ///use below for testing and for screenshots
    int minutes = 8;
    s_hours = 10;
  
#else
  //use these for live version
   minutes = prv_tick_time->tm_min;
   s_hours = prv_tick_time->tm_hour % 12;
#endif

  int minutes_angle = (360 * minutes / 60) - 90;
  int hours_angle   = (360 * (s_hours % 12) / 12) + (minutes / 2) - 90;

  #ifdef HAS_WEATHER
  if (s_hands_parked) {   // shaken: a flat bar out of the weather's way (angles: 0 = 3 o'clock)
    minutes_angle = 0;    // minute hand to 3
    hours_angle = 180;    // hour hand to 9
  }
  #endif

  //int hand_angle = settings.DigitalHour ? minutes_angle : hours_angle;

  #ifdef PBL_ROUND
      draw_hour_hand(ctx, hours_angle,
          (bounds.size.w/3 - config.analogue_hand_a)* bounds.size.h/full_bounds.size.h,
          settings.BackLen,
          config.hour_hand_p2x,
          config.hour_hand_p2y,
          config.corner_radius_hourhand,
          PBL_IF_BW_ELSE(settings.BWHourHandColor, settings.HourHandColor));
      draw_minute_hand(ctx, minutes_angle,
          (bounds.size.w/2 - config.analogue_hand_a)* bounds.size.h/full_bounds.size.h,
          settings.BackLen,
          config.min_hand_p2x,
          config.min_hand_p2y,
          config.corner_radius_minutehand,
          PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor));    
      draw_hand_center(ctx, PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor), PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1));
  #else
      if(settings.ForegroundShape){
          draw_hour_hand(ctx, hours_angle,
              (bounds.size.w/3 - config.analogue_hand_a)* bounds.size.h/full_bounds.size.h,
              settings.BackLen,
              config.hour_hand_p2x,
              config.hour_hand_p2y,
              config.corner_radius_hourhand,
              PBL_IF_BW_ELSE(settings.BWHourHandColor, settings.HourHandColor));
          draw_minute_hand(ctx, minutes_angle,
              (bounds.size.w/2 - config.analogue_hand_a)* bounds.size.h/full_bounds.size.h,
              settings.BackLen,
              config.min_hand_p2x,
              config.min_hand_p2y,
              config.corner_radius_minutehand,
              PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor));    
          draw_hand_center(ctx, PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor), PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1));
      }
      else{
          draw_hour_hand(ctx, hours_angle,
              (bounds.size.w/3 - config.analogue_hand_c)* bounds.size.h/full_bounds.size.h,
              settings.BackLen,
              config.hour_hand_p2x,
              config.hour_hand_p2y,
              config.corner_radius_hourhand,
              PBL_IF_BW_ELSE(settings.BWHourHandColor, settings.HourHandColor));
          draw_minute_hand(ctx, minutes_angle,
              (bounds.size.w/2 - config.analogue_hand_a)* bounds.size.h/full_bounds.size.h,
              settings.BackLen,
              config.min_hand_p2x,
              config.min_hand_p2y,
              config.corner_radius_minutehand,
              PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor));    
          draw_hand_center(ctx, PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor), PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1));
      }
  #endif

}

////////weather updates - emery and gabbro only
#ifdef HAS_WEATHER
static void weather_update_proc(Layer *layer, GContext *ctx) {
  SKIP_ON_FAST_FRAME();   // only the hands change: the saved face already has this
    
    if (!settings.UseWeather) {
      return;
    }
  
  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  GRect full_bounds = layer_get_bounds (s_canvas_layer);
  #else
  GRect bounds = layer_get_bounds (s_canvas_layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif

    if (!grect_equal(&full_bounds, &bounds)) {
      return;
    }


    // Weather older than 1.5x the update interval is stale (time_t is seconds, so x 60 x 1.5 = x 90)
    time_t staleAfterSeconds = (time_t)(settings.UpSlider * 90);
    bool weatherStale = (s_last_weather_fetch == 0) ||
        ((g_current_epoch - s_last_weather_fetch) > staleAfterSeconds);

    if (SHOW_TOP_WEATHER()) {
      char CondToDraw[4];
    snprintf(CondToDraw, sizeof(CondToDraw), "%s",
             s_weather_refreshing ? WEATHER_REFRESHING_ICON :
             weatherStale ? WEATHER_STALE_ICON : settings.iconnowstring);

    GRect IconNowRect = settings.EnableBatteryLine ? config.IconNowRect[0] : config.IconNowRect2[0];
    graphics_context_set_text_color(ctx, PBL_IF_BW_ELSE(settings.BWBatteryWeatherColor, settings.BatteryWeatherColor));
    graphics_draw_text(ctx, CondToDraw, FontWeatherIcons, IconNowRect, GTextOverflowModeFill, GTextAlignmentRight, NULL);
    }

    if (settings.RainSoon && settings.ShowAlert) {

      GRect RainIconRect = config.RainIconRect[0];
      graphics_draw_text(ctx, safe_rain_amount(settings.RainAmount), FontWeatherIcons, RainIconRect, GTextOverflowModeFill, GTextAlignmentLeft, NULL);
      
    }

    #ifdef BACKLIGHTON
    GRect WarningIconRect = config.WarningIconRect[0];
    graphics_context_set_text_color(ctx, PBL_IF_BW_ELSE(settings.BWBatteryWeatherColor, settings.BatteryWeatherColor));
    graphics_draw_text(ctx, "\U0000F0ED", FontWeatherIcons, WarningIconRect, GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    #else
    if (settings.WBGTLevel > 0 && settings.ShowAlert) {
      // Three distinct glyphs, one per severity level, rather than one glyph  - F0EC (yellow), F0ED (red), F0EE (black).
      const char *warnGlyph;
      switch (settings.WBGTLevel) {
        case 1:  warnGlyph = "\U0000F0EC"; break;
        case 2:  warnGlyph = "\U0000F0ED"; break;
        default: warnGlyph = "\U0000F0EE"; break; // level 3 and any unexpected value
      }

      GRect WarningIconRect = config.WarningIconRect[0];
      graphics_context_set_text_color(ctx, PBL_IF_BW_ELSE(settings.BWBatteryWeatherColor, settings.BatteryWeatherColor));
      graphics_draw_text(ctx, warnGlyph, FontWeatherIcons, WarningIconRect, GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    }
    #endif
    
    #ifdef PBL_PLATFORM_APLITE
    // aplite has no fctx: plain graphics_draw_text, with the Tangent fonts it already loads for the
    // date (18px) and battery (16px), in the same places as the fctx text on diorite/flint.
    graphics_context_set_text_color(ctx, settings.BWBatteryWeatherColor);
    if (SHOW_TOP_WEATHER()) {
      char TempToDraw[8];   // tempstring (up to 5) + "°" (2 bytes) + NUL
      snprintf(TempToDraw, sizeof(TempToDraw), "%s%s", settings.tempstring, "°");
      GRect TempRect = GRect(bounds.size.w / 2 + 2, config.BatteryYOffset + (settings.EnableBatteryLine ? -2 : 2),
                             bounds.size.w / 2 - 2, 24);
      graphics_draw_text(ctx, TempToDraw, FontDate, TempRect, GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    }
    if (SHOW_TOP_FORECAST()) {
      char TempForeToDraw[14];
      snprintf(TempForeToDraw, sizeof(TempForeToDraw), "%s%s", settings.temphistring, "°");
      GRect ForeRect = GRect(1, config.BatteryYOffset + 20, bounds.size.w, 20);
      graphics_draw_text(ctx, TempForeToDraw, FontBattery, ForeRect, GTextOverflowModeFill, GTextAlignmentCenter, NULL);
    }
    #else
    FContext fctx;
    if (!prv_fctx_begin(&fctx, ctx)) {
      return;
    }

    fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWBatteryWeatherColor, settings.BatteryWeatherColor));
            FPoint temp_pos;
            
            int font_size_temp = (config.font_size_battery) + config.weather_temp_grow * bounds.size.h/full_bounds.size.h;
            
            //int s_battery_level = battery_state_service_peek().charge_percent;
            fctx_set_text_em_height(&fctx, FCTX_Font, font_size_temp);

                // Formats and draws the battery percentage text
              if (settings.EnableBatteryLine && SHOW_TOP_WEATHER()) {

                  temp_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 2 ));
                  temp_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z - 2 - 1)* bounds.size.h/full_bounds.size.h);

                  char TempToDraw[8];   // tempstring (up to 5) + "°" (2 bytes) + NUL
                  //snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);
                  snprintf(TempToDraw, sizeof(TempToDraw), "%s%s",settings.tempstring,"°");


                  prv_fill_text(&fctx, TempToDraw, GTextAlignmentLeft, FTextAnchorTop, 0, temp_pos);
                }
                else if (SHOW_TOP_WEATHER()) { //shift the text slightly when there's no battery line

                  temp_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 2));
                  temp_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_y - 2 - 1)* bounds.size.h/full_bounds.size.h);

                  char TempToDraw[8];   // tempstring (up to 5) + "°" (2 bytes) + NUL
                  //snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);
                  snprintf(TempToDraw, sizeof(TempToDraw), "%s%s",settings.tempstring,"°");

                  prv_fill_text(&fctx, TempToDraw, GTextAlignmentLeft, FTextAnchorTop, 0, temp_pos);
                }
                
                
                if (SHOW_TOP_FORECAST()) {
                  int font_size_fore = (config.font_size_battery) +2 * bounds.size.h/full_bounds.size.h;

                fctx_set_text_em_height(&fctx, FCTX_Font, font_size_fore);
                FPoint fore_pos;
                
                 fore_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 1));
                 fore_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z)* bounds.size.h/full_bounds.size.h + config.forecast_offset);


                char TempForeToDraw[14];
                snprintf(TempForeToDraw, sizeof(TempForeToDraw), "%s%s",settings.temphistring,"°");

                prv_fill_text(&fctx, TempForeToDraw, GTextAlignmentCenter, FTextAnchorTop, 0, fore_pos);
                }

    fctx_deinit_context(&fctx);
    #endif // aplite / fctx

}
#endif

#ifdef PBL_COLOR
// ---- Background pictures (colour watches) -----------------------------------------------------
// Each picture is a "map" resource made by tools/make_backgrounds.py: one byte per pixel saying
// where that pixel sits along the colours picked in settings (PicColor1-4), not what colour it
// is. At draw time a 256-entry table turns map bytes into colours, which are then dithered to
// the 64 Pebble colours, so any colours can be chosen without new images. (The same arithmetic
// is in make_backgrounds.py and modifications.js - keep all three in step.)
//
// Map resource: 8-byte header 'T', mode, width (LE16), height (LE16), kind, 0; for rainbows
// (kind 1) a 256 x 3-byte table (position, whiteness, value) follows; then width*height bytes.
// Modes: 0 = full size, 1 = half size smoothed back up, 2 = half size in 2x2 blocks, 3 = a tile.

#define PICTURE_HEADER_SIZE 8
#define PICTURE_TABLE_SIZE 768
#define PICTURE_MAX_ROW 260

// BackgroundStyle -> resource. 1 painted rainbow, 2 rose rainbow, 3.. the finishes.
static uint32_t prv_picture_resource(int style) {
  switch (style) {
    case 1: return RESOURCE_ID_BG_PAINTED;
    case 2: return RESOURCE_ID_BG_ROSE;
    case 3: return RESOURCE_ID_BG_SUNBURST;
    case 4: return RESOURCE_ID_BG_HAMMERED;
    case 6: return RESOURCE_ID_BG_FUME;
    case 7: return RESOURCE_ID_BG_ENAMEL;
    case 9: return RESOURCE_ID_BG_TEXTURED;
    default: return 0;   // includes 5 and 8 (wave and lacquer, since removed): flat colour
  }
}

// Each picture's own colours, used until they're changed in settings (and for settings saved
// before pictures had colours). GColor8 bytes 0b11RRGGBB; unused stops repeat the last one.
#define PICTURE_STOPS 7
static const uint8_t PICTURE_DEFAULT_COLOURS[10][PICTURE_STOPS] = {
  { 0xFC, 0xCF, 0xF3, 0xC3, 0xC3, 0xC3, 0xC3 },   // 0 flat (unused): same as the rose
  { 0xF0, 0xF4, 0xFC, 0xC9, 0xC7, 0xC2, 0xF2 },   // 1 painted: red, orange, yellow, green, blue, navy, pink
  { 0xFC, 0xCF, 0xF3, 0xC3, 0xC3, 0xC3, 0xC3 },   // 2 rose: top yellow, 9 o'clock cyan, 3 o'clock magenta, bottom blue
  { 0xDF, 0xC1, 0xC1, 0xC1, 0xC1, 0xC1, 0xC1 },   // 3 sunburst: aqua, shadow navy
  { 0xC7, 0xDB, 0xDB, 0xDB, 0xDB, 0xDB, 0xDB },   // 4 hammered: blue, sky blue
  { 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA },   // 5 (wave, removed)
  { 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA },   // 6 fume: light grey
  { 0xDC, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF },   // 7 enamel: bright green, white
  { 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA },   // 8 (lacquer, removed)
  { 0xEA, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF },   // 9 textured: light grey, white
};

static void prv_set_picture_default_colours(int style) {
  if (style < 0 || style > 9) { style = 0; }
  settings.PicColor1 = (GColor){ .argb = PICTURE_DEFAULT_COLOURS[style][0] };
  settings.PicColor2 = (GColor){ .argb = PICTURE_DEFAULT_COLOURS[style][1] };
  settings.PicColor3 = (GColor){ .argb = PICTURE_DEFAULT_COLOURS[style][2] };
  settings.PicColor4 = (GColor){ .argb = PICTURE_DEFAULT_COLOURS[style][3] };
  settings.PicColor5 = (GColor){ .argb = PICTURE_DEFAULT_COLOURS[style][4] };
  settings.PicColor6 = (GColor){ .argb = PICTURE_DEFAULT_COLOURS[style][5] };
  settings.PicColor7 = (GColor){ .argb = PICTURE_DEFAULT_COLOURS[style][6] };
}

typedef struct { int r, g, b; } PicRGB;

static PicRGB prv_pic_rgb(GColor c) {
  PicRGB o = { ((c.argb >> 4) & 3) * 85, ((c.argb >> 2) & 3) * 85, (c.argb & 3) * 85 };
  return o;
}

// a + (b - a) * num / den, rounding towards a
static int prv_pic_step(int a, int b, int num, int den) {
  return b >= a ? a + (b - a) * num / den : a - (a - b) * num / den;
}

// Integer HSV: h 0..1535 (6 x 256), s and v 0..255
static void prv_pic_to_hsv(PicRGB c, int *h, int *s, int *v) {
  int mx = c.r > c.g ? (c.r > c.b ? c.r : c.b) : (c.g > c.b ? c.g : c.b);
  int mn = c.r < c.g ? (c.r < c.b ? c.r : c.b) : (c.g < c.b ? c.g : c.b);
  int d = mx - mn;
  *v = mx;
  *s = mx ? d * 255 / mx : 0;
  if (d == 0) { *h = 0; return; }
  int hh;
  if (mx == c.r)      { hh = c.g >= c.b ? 256 * (c.g - c.b) / d : 1536 - 256 * (c.b - c.g) / d; }
  else if (mx == c.g) { hh = c.b >= c.r ? 512 + 256 * (c.b - c.r) / d : 512 - 256 * (c.r - c.b) / d; }
  else                { hh = c.r >= c.g ? 1024 + 256 * (c.r - c.g) / d : 1024 - 256 * (c.g - c.r) / d; }
  *h = hh % 1536;
}

static PicRGB prv_pic_from_hsv(int h, int s, int v) {
  int region = h / 256, f = h % 256;
  int p = v * (255 - s) / 255;
  int q = v * (255 - s * f / 256) / 255;
  int t = v * (255 - s * (256 - f) / 256) / 255;
  PicRGB o;
  switch (region) {
    case 0:  o.r = v; o.g = t; o.b = p; break;
    case 1:  o.r = q; o.g = v; o.b = p; break;
    case 2:  o.r = p; o.g = v; o.b = t; break;
    case 3:  o.r = p; o.g = q; o.b = v; break;
    case 4:  o.r = t; o.g = p; o.b = v; break;
    default: o.r = v; o.g = p; o.b = q; break;
  }
  return o;
}

// num/den of the way from colour a to b, going round the colour wheel the short way
static PicRGB prv_pic_blend(PicRGB a, PicRGB b, int num, int den) {
  int ha, sa, va, hb, sb, vb;
  prv_pic_to_hsv(a, &ha, &sa, &va);
  prv_pic_to_hsv(b, &hb, &sb, &vb);
  if (sa == 0) { ha = hb; }
  if (sb == 0) { hb = ha; }
  int dh = hb - ha;
  if (dh > 768) { dh -= 1536; } else if (dh < -768) { dh += 1536; }
  int h = dh >= 0 ? ha + dh * num / den : ha - (-dh) * num / den;
  h = (h + 1536) % 1536;
  return prv_pic_from_hsv(h, prv_pic_step(sa, sb, num, den), prv_pic_step(va, vb, num, den));
}

// Fills lut[256][3] with each map byte's colour as 0..48 per channel (ready to dither).
static bool prv_build_picture_lut(uint8_t (*lut)[3], int style, ResHandle handle) {
  PicRGB stops[PICTURE_STOPS] = {
    prv_pic_rgb(settings.PicColor1), prv_pic_rgb(settings.PicColor2), prv_pic_rgb(settings.PicColor3),
    prv_pic_rgb(settings.PicColor4), prv_pic_rgb(settings.PicColor5), prv_pic_rgb(settings.PicColor6),
    prv_pic_rgb(settings.PicColor7) };
  // finishes ramp shadow -> main -> highlight; the shadow is black, except for sunburst, whose
  // colour 2 is its shadow (it only runs shadow -> main)
  PicRGB shadow = { 0, 0, 0 };
  if (style == 3) { shadow = stops[1]; }
  uint8_t chunk[48];   // rainbow table, read 16 entries at a time
  for (int b = 0; b < 256; b++) {
    PicRGB c;
    if (style >= 3) {
      // finishes: shadow (0) -> main colour (128) -> highlight (255)
      if (b <= 128) {
        c.r = prv_pic_step(shadow.r, stops[0].r, b, 128);
        c.g = prv_pic_step(shadow.g, stops[0].g, b, 128);
        c.b = prv_pic_step(shadow.b, stops[0].b, b, 128);
      } else {
        c.r = prv_pic_step(stops[0].r, stops[1].r, b - 128, 127);
        c.g = prv_pic_step(stops[0].g, stops[1].g, b - 128, 127);
        c.b = prv_pic_step(stops[0].b, stops[1].b, b - 128, 127);
      }
    } else {
      if (b % 16 == 0 &&
          resource_load_byte_range(handle, PICTURE_HEADER_SIZE + b * 3, chunk, sizeof(chunk)) != sizeof(chunk)) {
        return false;
      }
      int pos = chunk[(b % 16) * 3], white = chunk[(b % 16) * 3 + 1], value = chunk[(b % 16) * 3 + 2];
      if (style == 1) {          // painted: seven stops, one every 42.5 positions
        int seg = 2 * pos / 85 < 5 ? 2 * pos / 85 : 5;
        c = prv_pic_blend(stops[seg], stops[seg + 1], 2 * pos - seg * 85, 85);
      } else {                   // rose: left side via stop2, right side via stop3, to stop4
        PicRGB mid = pos >= 128 ? stops[2] : stops[1];
        int q = pos & 127;
        c = (2 * q <= 127) ? prv_pic_blend(stops[0], mid, 2 * q, 127)
                           : prv_pic_blend(mid, stops[3], 2 * q - 127, 127);
      }
      c.r = (c.r + (255 - c.r) * white / 255) * value / 255;
      c.g = (c.g + (255 - c.g) * white / 255) * value / 255;
      c.b = (c.b + (255 - c.b) * white / 255) * value / 255;
    }
    lut[b][0] = (c.r * 48 + 127) / 255;
    lut[b][1] = (c.g * 48 + 127) / 255;
    lut[b][2] = (c.b * 48 + 127) / 255;
  }
  return true;
}

static const uint8_t PICTURE_BAYER[4][4] = { { 0, 8, 2, 10 }, { 12, 4, 14, 6 }, { 3, 11, 1, 9 }, { 15, 7, 13, 5 } };

// Draws background picture `style` straight into the frame buffer, one row at a time, shifted
// up by `y_offset` rows (so it can stay centred on the hands when Quick View shrinks the face). The
// colour table and two row buffers (~1.2KB) are allocated here and freed before returning, so
// nothing is held while the text layers need fctx's full-screen buffer. Returns false (and the
// caller fills with the flat colour) if the resource is missing or wrong, or memory is short.
static bool prv_draw_picture(GContext *ctx, int style, GRect area, int y_offset) {
  uint32_t resource_id = prv_picture_resource(style);
  ResHandle handle = resource_id ? resource_get_handle(resource_id) : NULL;
  if (!handle) {
    return false;
  }
  uint8_t header[PICTURE_HEADER_SIZE];
  if (resource_load_byte_range(handle, 0, header, sizeof(header)) != sizeof(header) || header[0] != 'T') {
    return false;
  }
  int mode = header[1];
  int sw = header[2] | (header[3] << 8);
  int sh = header[4] | (header[5] << 8);
  uint32_t data_offset = PICTURE_HEADER_SIZE + (header[6] ? PICTURE_TABLE_SIZE : 0);
  if (sw <= 0 || sh <= 0 || sw > PICTURE_MAX_ROW || resource_size(handle) != data_offset + (uint32_t)(sw * sh)) {
    APP_LOG(APP_LOG_LEVEL_WARNING, "background %d: bad picture resource", style);
    return false;
  }

  uint8_t (*lut)[3] = malloc(256 * 3);
  uint8_t *row_a = malloc(sw);
  uint8_t *row_b = malloc(sw);
  bool ok = lut && row_a && row_b && prv_build_picture_lut(lut, style, handle);
  GBitmap *fb = ok ? graphics_capture_frame_buffer(ctx) : NULL;
  if (fb) {
    GRect fb_bounds = gbitmap_get_bounds(fb);
    int w = fb_bounds.size.w;
    int h = fb_bounds.size.h;
    int y_start = area.origin.y < 0 ? 0 : area.origin.y;
    int y_end = area.origin.y + area.size.h < h ? area.origin.y + area.size.h : h;
    for (int y = y_start; y < y_end; y++) {
      GBitmapDataRowInfo row = gbitmap_get_data_row_info(fb, y);
      int x0 = row.min_x;
      int x1 = row.max_x < w - 1 ? row.max_x : w - 1;
      if (x1 < x0) {
        continue;
      }
      // the source row(s) this screen row comes from
      int py = y + y_offset;                         // the picture row shown on this screen row
      if (py < 0) { py = 0; }
      if (py > h - 1) { py = h - 1; }
      int src_y = mode == 0 ? py : (mode == 3 ? py % sh : py >> 1);
      if (src_y >= sh) { src_y = sh - 1; }
      resource_load_byte_range(handle, data_offset + src_y * sw, row_a, sw);
      if (mode == 1) {
        int k2 = (py & 1) ? src_y + 1 : src_y - 1;
        if (k2 < 0) { k2 = 0; }
        if (k2 >= sh) { k2 = sh - 1; }
        resource_load_byte_range(handle, data_offset + k2 * sw, row_b, sw);
      }
      const uint8_t *bayer = PICTURE_BAYER[y & 3];
      for (int x = x0; x <= x1; x++) {
        int s;
        if (mode == 0) {
          s = row_a[x < sw ? x : sw - 1];
        } else if (mode == 2) {
          int j = x >> 1;
          s = row_a[j < sw ? j : sw - 1];
        } else if (mode == 3) {
          s = row_a[x % sw];
        } else {   // mode 1: half size, smoothed back up (weights 3:1 each way)
          int j = x >> 1;
          if (j >= sw) { j = sw - 1; }
          int j2 = (x & 1) ? j + 1 : j - 1;
          if (j2 < 0) { j2 = 0; }
          if (j2 >= sw) { j2 = sw - 1; }
          int near = 3 * row_a[j] + row_b[j];
          int far = 3 * row_a[j2] + row_b[j2];
          s = (3 * near + far + 8) >> 4;
        }
        int t = bayer[x & 3];
        const uint8_t *e = lut[s];
        row.data[x] = 0xC0 | (((e[0] + t) >> 4) << 4) | (((e[1] + t) >> 4) << 2) | ((e[2] + t) >> 4);
      }
    }
    graphics_release_frame_buffer(ctx, fb);
  }
  free(row_b);
  free(row_a);
  free(lut);
  return fb != NULL;
}
#endif

///update procedure for background
#ifdef FACE_CACHE
// Bytes [*start, *start+len) of a screen row (round screens' rows are shorter at top and bottom).
static int prv_face_row(GBitmapDataRowInfo *row, int *start) {
  #ifdef PBL_COLOR
  *start = row->min_x;
  return row->max_x - row->min_x + 1;
  #else
  *start = row->min_x >> 3;   // 1 bit per pixel
  return (row->max_x >> 3) - *start + 1;
  #endif
}

// Copies the screen into the saved face (save) or the saved face back onto the screen.
static bool prv_face_copy(GContext *ctx, bool save) {
  GBitmap *fb = graphics_capture_frame_buffer(ctx);
  if (!fb) { return false; }
  int h = gbitmap_get_bounds(fb).size.h;
  int start;
  if (save && !s_face_cache) {
    size_t total = 0;
    for (int y = 0; y < h; y++) {
      GBitmapDataRowInfo row = gbitmap_get_data_row_info(fb, y);
      total += prv_face_row(&row, &start);
    }
    size_t free_before = heap_bytes_free();
    if (free_before >= total + FACE_CACHE_HEAP_MARGIN) {
      s_face_cache = malloc(total);
    }
    static bool s_logged;   // say once per launch whether it fits (shows with pebble install --logs)
    if (!s_logged) {
      s_logged = true;
      APP_LOG(APP_LOG_LEVEL_INFO, "saved face: %s (%d bytes, %d free)", s_face_cache ? "on" : "no room",
              (int)total, (int)free_before);
    }
    if (!s_face_cache) {   // not enough memory: just draw everything every frame, as before
      graphics_release_frame_buffer(ctx, fb);
      return false;
    }
  }
  uint8_t *p = s_face_cache;
  for (int y = 0; y < h; y++) {
    GBitmapDataRowInfo row = gbitmap_get_data_row_info(fb, y);
    int len = prv_face_row(&row, &start);
    if (save) { memcpy(p, row.data + start, len); }
    else      { memcpy(row.data + start, p, len); }
    p += len;
  }
  graphics_release_frame_buffer(ctx, fb);
  return true;
}

// Sits just above the face layers and below the seconds hand and hour/minute hands: after a full
// redraw, saves the face so the following seconds frames can reuse it.
static void face_capture_update_proc(Layer *layer, GContext *ctx) {
  if (s_fast_frame || !second_hand_is_active()) { return; }
  if (prv_face_copy(ctx, true)) {
    s_face_cache_valid = true;
    s_face_cache_seconds = showSeconds;
    s_face_cache_unobstructed = layer_get_unobstructed_bounds(layer);
  }
}
#endif

static void bg_update_proc(Layer *layer, GContext *ctx) {

  #ifdef FACE_CACHE
  // Only the hands have moved since the face was saved: put it back and let the hand layers draw.
  GRect unobstructed = layer_get_unobstructed_bounds(layer);
  s_fast_frame = s_face_cache && s_face_cache_valid && s_face_cache_seconds == showSeconds
                 && second_hand_is_active() && grect_equal(&unobstructed, &s_face_cache_unobstructed);
  if (s_fast_frame) {
    if (prv_face_copy(ctx, false)) { return; }
    s_fast_frame = false;
  }
  // A full redraw: let the old saved face go first, so the anti-aliased text gets the memory it
  // needs (face_capture_update_proc saves a new one after the face layers have drawn).
  if (s_face_cache) {
    free(s_face_cache);
    s_face_cache = NULL;
  }
  s_face_cache_valid = false;
  #endif

  #ifdef PBL_RECT
  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);
  #else   // gabbro: Quick View doesn't shrink the face, so draw at full size underneath it
  GRect bounds = layer_get_bounds(layer);
  GRect full_bounds = bounds;
  (void)full_bounds;   // only some round-screen code uses it
  #endif

  // The background always covers the whole screen, not just the unobstructed part: on round
  // screens Timeline Quick View doesn't cover the bottom of the circle, which would otherwise
  // show whatever was left there (white).
  GRect FullBackground =
       GRect(0, 0, full_bounds.size.w, full_bounds.size.h);

  bool drew_bitmap = false;
  #ifdef PBL_COLOR
  if (settings.BackgroundStyle >= 1 && settings.BackgroundStyle <= 9) {
    // Rectangular watches: when Quick View shrinks the face, the hands move up to the middle
    // of what's left, so move the picture up by the same amount to keep its centre on them.
    // (Round watches don't shrink - see the bounds at the top of this function.)
    int picture_shift = (full_bounds.size.h - bounds.size.h) / 2;
    drew_bitmap = prv_draw_picture(ctx, settings.BackgroundStyle, FullBackground, picture_shift);
  }
  #endif
  if (!drew_bitmap) {
    // Flat fill: either BackgroundStyle is flat, this is a B&W screen, or (very
    // unexpectedly) the picture resource failed to load - either way, same fallback.
    graphics_context_set_fill_color(ctx,PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1) );
    graphics_fill_rect(ctx, FullBackground,0,GCornersAll);
  }

  if(settings.showMinorTick){
        for (int i = 0; i < 60; i++) {
        //if (i % 5 == 0) continue;
        int angle = i * 6;
        draw_minor_tick(ctx, angle, PBL_IF_BW_ELSE(settings.BWMajorTickColor, settings.MinorTickColor));
      }
    }

  if(settings.showMajorTick){
      for (int i = 0; i < 12; i++) {
        int angle = i * 30 - 90;
        draw_major_tick(ctx, angle, config.majorticklength, PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.MajorTickColor), PBL_IF_BW_ELSE(settings.BWMajorTickColor, settings.MajorTickColor));
        
        //don't draw inner ticks where digits are present.  Don't draw an innner tick at 6 o'clock when digits are off but date is on
        bool at_date_position = (i == 6 && settings.EnableDate);
        #ifdef PBL_PLATFORM_APLITE
          // Aplite only ever draws "12" (i==0), and "6" (i==6) only when the date is off.
          bool at_digit_position = (i == 0) || (i == 6 && !settings.EnableDate);
        #else
          bool at_digit_position = (i % 2 == 0);
        #endif
        if (at_date_position || (at_digit_position && !settings.HourTicksOnly)) continue;
          draw_major_tick_inner_set(ctx, angle, config.majorticklengthinner* bounds.size.h/full_bounds.size.h, PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.MajorTickColor), PBL_IF_BW_ELSE(settings.BWMajorTickColor, settings.MajorTickColor));
      }
    }

}


static void prv_window_load(Window *window) {

  #ifdef BACKLIGHTON
    light_enable(true);  ///for ShareX screencapture gifs.  Must comment out declaration on line 11 before publishing, otherwise the backlight will stay on!
  #endif


  refresh_current_time();   // our own copy of the time (see refresh_current_time)
  current_date = prv_tick_time->tm_mday;
  s_weekday = prv_tick_time->tm_wday;
  minutes = prv_tick_time->tm_min;
  hours = prv_tick_time->tm_hour % 12;
  s_hours = prv_tick_time->tm_hour;
  s_month = prv_tick_time->tm_mon;
  prv_update_steps();

  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  // Load fctx ffonts
    #ifndef PBL_PLATFORM_APLITE
    FCTX_Font =  ffont_create_from_resource(RESOURCE_ID_FONT_DATE_FCTX);
    #endif
    FontBTQTIcons = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DRIPICONS_16));
    #if defined(PBL_PLATFORM_EMERY) || defined(PBL_PLATFORM_GABBRO)
    FontPhoneIcon = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_PHONEICON_16));
    #elif defined(HAS_COMPLICATIONS)
    FontPhoneIcon = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_PHONEICON_12));
    #endif
    //non-fctx custom fonts for B&W screens
    #ifdef PBL_PLATFORM_APLITE
    FontDate = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_20));
    FontBattery = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_16));
    FontLogo = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_14));
    FontHour = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_28));
    #endif
    #ifdef HAS_WEATHER
    // 20px icons on emery/gabbro's bigger screens, 16px everywhere else
    #if defined(PBL_PLATFORM_EMERY) || defined(PBL_PLATFORM_GABBRO)
    FontWeatherIcons = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_WEATHERICONS_20));
    FontSunIcons = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_SUNICONS_16));
    #else
    FontWeatherIcons = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_WEATHERICONS_16));
    #ifndef PBL_PLATFORM_APLITE
    FontSunIcons = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_SUNICONS_12));
    #else
    FontSunIcons = FontWeatherIcons;   // aplite has no sunrise/sunset rows
    #endif
    #endif
    #endif
  // Subscribe to the connection service to get Bluetooth status updates.
  connection_service_subscribe((ConnectionHandlers){
    .pebble_app_connection_handler = bluetooth_connection_handler
  });


        if (settings.SubDialChoice == 1) {
        showSeconds = true;
        start_smooth_sweep_timer();
        prv_subscribe_ticks();
        } else if (settings.SubDialChoice == 2 || settings.SubDialChoice == 6){
        showSeconds = true;
        start_smooth_sweep_timer();
        prv_subscribe_ticks();
        s_timeout_timer = app_timer_register(1000*settings.SecondsVisibleTime, timeout_handler,NULL);
        accel_tap_service_subscribe(accel_tap_handler);
        }
        else {
        showSeconds = false;
        stop_smooth_sweep_timer();
        tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
        }
 

   
  //create layers
  s_bg_layer = layer_create(bounds);
  s_dial_layer = layer_create(bounds);
  s_canvas_second_hand = layer_create(bounds);
  s_canvas_month_hand = layer_create(bounds);
  s_canvas_tz = layer_create(bounds);
  s_canvas_comp_bg = layer_create(bounds);
  s_canvas_qt_icon = layer_create(bounds);
     quiet_time_icon();
  s_canvas_bt_icon = layer_create(bounds);
    bool is_connected = connection_service_peek_pebble_app_connection();
    #ifdef BACKLIGHTON
    layer_set_hidden(s_canvas_bt_icon, !is_connected);
    #else
    layer_set_hidden(s_canvas_bt_icon, is_connected);
    #endif
  s_canvas_battery = layer_create(bounds);
  #ifdef HAS_WEATHER
  s_canvas_weather = layer_create(bounds);
  #endif
  s_canvas_layer = layer_create(bounds);
  s_date_battery_logo_layer = layer_create(bounds);

  // Change the order here
  layer_add_child(window_layer, s_bg_layer); //backforound, circles, major tick shoadow &tickmask
  layer_add_child(window_layer, s_canvas_comp_bg);
  layer_add_child(window_layer, s_canvas_month_hand);  //month hand
  layer_add_child(window_layer, s_canvas_tz);  //2nd timezone
  layer_add_child(window_layer, s_canvas_bt_icon);
  layer_add_child(window_layer, s_canvas_qt_icon);
  layer_add_child(window_layer, s_date_battery_logo_layer); //fctx version of text
  #ifdef HAS_WEATHER
  layer_add_child(window_layer, s_canvas_weather);
  #endif
  layer_add_child(window_layer, s_canvas_battery); //battery line
  // Everything above here is the face, saved between seconds frames (see FACE_CACHE); the
  // seconds hand and hour/minute hands go on top and are drawn every frame.
  #ifdef FACE_CACHE
  s_face_capture_layer = layer_create(bounds);
  layer_set_update_proc(s_face_capture_layer, face_capture_update_proc);
  layer_add_child(window_layer, s_face_capture_layer);
  #endif
  layer_add_child(window_layer, s_canvas_second_hand);  //second hand
  layer_add_child(window_layer, s_canvas_layer);  //hour and minute hands
 
  bluetooth_vibe_icon(connection_service_peek_pebble_app_connection());

  layer_set_update_proc(s_bg_layer, bg_update_proc);
  layer_set_update_proc(s_canvas_bt_icon, layer_update_proc_bt);
  layer_set_update_proc(s_canvas_qt_icon, layer_update_proc_qt);
  layer_set_update_proc(s_date_battery_logo_layer, update_logo_date_battery_fctx_layer);
  layer_set_update_proc(s_canvas_battery, layer_update_proc_battery_line);
  #ifdef HAS_WEATHER
  layer_set_update_proc(s_canvas_weather, weather_update_proc);
  #endif
  layer_set_update_proc(s_canvas_layer, hour_min_hands_canvas_update_proc);
  layer_set_update_proc(s_canvas_comp_bg,layer_update_proc_complication);
  layer_set_update_proc(s_canvas_second_hand, layer_update_proc_seconds_hand);
  layer_set_update_proc(s_canvas_month_hand, layer_update_proc_month_hand);
  layer_set_update_proc(s_canvas_tz, layer_update_proc_tz);

  //refresh weather on launch/relaunch
  #ifdef HAS_WEATHER
  // Always if "Refresh Weather on Relaunch" is on; otherwise only if it's due (so going in and out
  // of menus no longer holds the scheduled update back).
  if (settings.UseWeather && settings.RefreshWeatherOnLaunch) {
    prv_request_weather_update();
  } else {
    prv_request_weather_if_due();
  }
  #endif

  prv_update_accel_tap_subscription();

}


static void prv_window_unload(Window *window) {
  #ifdef BACKLIGHTON
    light_enable(false);
  #endif

  #ifdef HAS_WEATHER
  // Don't let a pending reconnect-triggered request fire later, into whatever window happens to
  // be loaded next.
  if (s_weather_reconnect_timer) { app_timer_cancel(s_weather_reconnect_timer); s_weather_reconnect_timer = NULL; }
  // Nor let the hands' un-park timer touch the hands layer after it's destroyed below.
  if (s_park_hands_timer) { app_timer_cancel(s_park_hands_timer); s_park_hands_timer = NULL; }
  s_hands_parked = false;
  #endif
  if (s_vibe_shake_timer) { app_timer_cancel(s_vibe_shake_timer); s_vibe_shake_timer = NULL; }

  accel_tap_service_unsubscribe();
  connection_service_unsubscribe();
  battery_state_service_unsubscribe();
  tick_timer_service_unsubscribe();
  layer_destroy(s_canvas_layer);
  layer_destroy(s_bg_layer);
  layer_destroy(s_dial_layer);
  layer_destroy(s_canvas_second_hand);
  layer_destroy(s_canvas_month_hand);
  layer_destroy(s_canvas_tz);
  layer_destroy(s_canvas_comp_bg);
  layer_destroy(s_canvas_battery);
  #ifdef HAS_WEATHER
  layer_destroy(s_canvas_weather);
  s_canvas_weather = NULL;
  #endif
  layer_destroy(s_canvas_bt_icon);
  layer_destroy(s_canvas_qt_icon);
  layer_destroy(s_date_battery_logo_layer);
  #ifdef FACE_CACHE
  layer_destroy(s_face_capture_layer);
  if (s_face_cache) { free(s_face_cache); s_face_cache = NULL; }
  s_face_cache_valid = false;
  #endif
  #ifndef PBL_PLATFORM_APLITE
  ffont_destroy(FCTX_Font);
  #endif
  #ifdef PBL_PLATFORM_APLITE
  fonts_unload_custom_font(FontDate);
  fonts_unload_custom_font(FontBattery);
  fonts_unload_custom_font(FontLogo);
  fonts_unload_custom_font(FontHour);
  #endif
  fonts_unload_custom_font(FontBTQTIcons);
  #ifdef HAS_COMPLICATIONS
  fonts_unload_custom_font(FontPhoneIcon);
  #endif
  #ifdef HAS_WEATHER
  fonts_unload_custom_font(FontWeatherIcons);
  #ifndef PBL_PLATFORM_APLITE
  fonts_unload_custom_font(FontSunIcons);
  #endif
  #endif
  if (s_timeout_timer) {
  app_timer_cancel(s_timeout_timer);
  s_timeout_timer = NULL;
  }
}

static void prv_init(void) {
  prv_load_settings();

  // The inbox is larger on emery/gabbro to fit the extra weather data (smaller buffers crashed).
  // The watch only ever sends the 1-byte weather request (see prv_request_weather_update).
  #if defined(PBL_PLATFORM_EMERY) || defined(PBL_PLATFORM_GABBRO)
  const uint32_t inbox_size = 2048;
  #elif defined(PBL_PLATFORM_APLITE)
  // aplite has only 24KB for everything. The biggest message it gets (the phone strips the
  // colour, phone-only and complication keys: aplite has the original fixed layout) is ~600 bytes.
  const uint32_t inbox_size = 640;
  #elif defined(PBL_PLATFORM_BASALT) || defined(PBL_PLATFORM_CHALK)
  // The other colour watches get the colours too: the biggest message (all settings + weather,
  // long custom texts and time zones in every slot) is ~1070 bytes.
  // Memory is tight here: on chalk every KB counts towards fctx's ~26KB text buffer.
  const uint32_t inbox_size = 1280;
  #else
  // diorite/flint: the biggest message (no colours) is ~820 bytes, so 1KB is enough.
  const uint32_t inbox_size = 1024;
  #endif
  // Outbox: big enough for a timeline-log event (3 x int32); the weather ping is smaller.
  app_message_open(inbox_size, dict_calc_buffer_size(3, sizeof(int32_t)));
  app_message_register_inbox_received(prv_inbox_received_handler);
  #ifdef HAS_TIMELINE_PINS
  app_message_register_outbox_sent(prv_outbox_sent_handler);
  app_message_register_outbox_failed(prv_outbox_failed_handler);
  #endif
  prv_tether_init();

  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = prv_window_load,
    .unload = prv_window_unload,
  });

  window_stack_push(s_window, true);
}

static void prv_deinit(void) {
  window_destroy(s_window);
}

int main(void) {
  prv_init();
  app_event_loop();
  prv_deinit();
}