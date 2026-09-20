#include <pebble.h>
#include "nomos.h"
#include "utils/weekday.h"
#include "utils/month.h"
#include "utils/MathUtils.h"
#include "utils/Weather.h"
#include <pebble-fctx/fctx.h>
#include <pebble-fctx/fpath.h>
#include <pebble-fctx/ffont.h>

// Weather (and the extra layers/fonts/settings it needs) is only built so far for the large-screen platforms
#if defined(PBL_PLATFORM_EMERY) || defined(PBL_PLATFORM_GABBRO)
  #define HAS_WEATHER
#endif

#ifndef ARRAY_LENGTH
  #define ARRAY_LENGTH(a) (sizeof(a) / sizeof((a)[0]))
#endif

////remember to comment out before publishing!!!!
//#define BACKLIGHTON   ///Use this for ShareX screencapture GIFs
//#define DEBUG         ///Use this for debugging and showing max size of complications
////remember to comment out before publishing!!!!
#define SECONDS_TICK_INTERVAL_MS 1000
#ifdef PBL_PLATFORM_APLITE
  #define SMOOTH_SWEEP_INTERVAL_MS 1000  //how often the second hand updates when SmoothSweep is on
#else
  #define SMOOTH_SWEEP_INTERVAL_MS 200
#endif


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

#ifdef HAS_WEATHER
static GFont
    FontWeatherIcons;
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
static int s_countdown = 30;
static time_t s_last_weather_fetch = 0;
// Stored separately from ClaySettings/SETTINGS_KEY since it's local
#define WEATHER_FETCH_EPOCH_KEY 248
#define WEATHER_STALE_ICON "\U0000F03E"
static bool s_launch_weather_delay = false;
static AppTimer *s_launch_weather_timer = NULL;
#define LAUNCH_WEATHER_DELAY_MS 1000
#endif
static ClaySettings settings;


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
  GRect battery_arc_bounds[1];
  int romanadjust;
  GRect IconNowRect[1];
  GRect IconNowRect2[1];
  GRect RainIconRect[1];
  GRect WarningIconRect[1];
  GRect BTIconRect[1];
  GRect QTIconRect[1];
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
  .battery_arc_bounds = {{{51,98},{37,37}}},        //UV arc, right of centre, middle row
.romanadjust = 2,
.IconNowRect = {{{0,48},{98,22}}},
.IconNowRect2 = {{{0,52},{98,22}}},
.RainIconRect = {{{48,81},{40,22}}},
.WarningIconRect = {{{132,83},{40,22}}},
.BTIconRect = {{{53,21},{44,20}}},
.QTIconRect = {{{106,20},{44,20}}}
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
  .battery_arc_bounds = {{{80,112},{37,37}}},        //UV arc, right of centre, middle row
.romanadjust = 0,
.IconNowRect = {{{0,60},{128,22}}},
.IconNowRect2 = {{{0,64},{128,22}}},
.RainIconRect = {{{75,90},{40,22}}},
.WarningIconRect = {{{165,91},{40,22}}},
.BTIconRect = {{{78,23},{44,20}}},
.QTIconRect = {{{140,22},{44,20}}}
};
#elif defined(PBL_BW)
static const UIConfig config = {
.DateBottomYPosition = 40, //126-3+5,
.yOffset = -7,
.yOffsetFctx = 2,
.yWeekdayDateOffset = 18 - 2,
.WeekdayDateHeight = 11,
.BatteryYOffset = 40-4,
.BatteryLineYOffset = 49 + 6,
.font_size_digits = 30,
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
  .battery_arc_bounds = {{{76,48},{24,24}}},        //UV arc, right of centre, middle row
.romanadjust = 1,
.BTIconRect = {{{36,16},{36,20}}},
.QTIconRect = {{{75,16},{36,20}}}

};
#elif defined(PBL_ROUND)
static const UIConfig config = {
.DateBottomYPosition = 48, //132,
.yOffset = -7,
.yOffsetFctx = 2,
.yWeekdayDateOffset = 1 + 24 - 4,
.WeekdayDateHeight = 11,
.BatteryYOffset = 40-4,
.BatteryLineYOffset = 49 + 6,
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
  .battery_arc_bounds = {{{55,79},{24,24}}},        //UV arc, right of centre, middle row
.romanadjust = 0,
.BTIconRect = {{{54,17},{32,20}}},
.QTIconRect = {{{97,16},{32,20}}}


};
#else // Default for other platforms
static const UIConfig config = {
.DateBottomYPosition = 40, //126-3+5,
.yOffset = -7,
.yOffsetFctx = 2,
.yWeekdayDateOffset = 18 - 2,
.WeekdayDateHeight = 11,
.BatteryYOffset = 40-4,
.BatteryLineYOffset = 49 + 6,
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
  .battery_arc_bounds = {{{37,75},{24,24}}},        //UV arc, right of centre, middle row
.romanadjust = 1,
.BTIconRect = {{{36,16},{36,20}}},
.QTIconRect = {{{75,16},{36,20}}}
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
static void prv_launch_weather_delay_callback(void *data);
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

// Save settings to persistent storage
static void prv_save_settings(void) {
  persist_write_data(SETTINGS_KEY, &settings, sizeof(settings));
}


// Set default settings
static void prv_default_settings(void) {
  settings.AlwaysShowSubDial = false;
  settings.SecondsVisibleTime = 15;
  settings.EnableDate = true;
  settings.EnableBattery = true;
  settings.EnableBatteryLine = true;
  settings.BackgroundColor1 = GColorOxfordBlue;
  settings.SubDialColor = GColorOxfordBlue;
  settings.MinuteHandShadowColor = GColorBlack;
  settings.MinorTickColor = GColorPictonBlue;
  settings.DateColor = GColorYellow;
  settings.HourDigitsColor = GColorYellow;
  settings.MinutesHandColor = GColorWhite;
  settings.MajorTickColor = GColorYellow;
  settings.SecondsHandColor = GColorRed;
  settings.MonthHandColor = GColorRed;
  settings.BWSecondsHandColor = GColorWhite;
  settings.BWMonthHandColor = GColorWhite;
  settings.BatteryLineColor = GColorOrange;
  settings.BWDateColor = GColorWhite;
  settings.BWBackgroundColor1 = GColorBlack;
  settings.BWSubDialColor = GColorBlack;
  settings.BWMinuteHandShadowColor = GColorDarkGray;
  settings.BWMinHandBatLineColor = GColorWhite;
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
  settings.SubDialChoice = 0;
  settings.tz_offset = 0;
  settings.showremoteAMPM = true;
  settings.SmoothSweep = false;
  snprintf(settings.DateLanguage, sizeof(settings.DateLanguage), "%s", "auto");

  #ifdef HAS_WEATHER

  settings.UseWeather = false;
  settings.UpSlider = 30;
  settings.RainSoon = false;
  settings.WBGTLevel = 0;
  settings.RefreshWeatherOnLaunch = false;

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
    layer_set_hidden(s_canvas_qt_icon, !quiet_time_is_active());
    #endif
}

static AppTimer *s_timeout_timer;
static AppTimer *s_smooth_sweep_timer;


static bool second_hand_is_active(void) {
  return (showSeconds) &&  //|| settings.AlwaysShowSubDial) &&
         (settings.SubDialChoice == 1 || settings.SubDialChoice == 2 || settings.SubDialChoice == 6);
}


static void smooth_sweep_timer_handler(void *context) {
  s_smooth_sweep_timer = NULL;

  if (settings.SmoothSweep && second_hand_is_active()) {
    layer_mark_dirty(s_canvas_second_hand);

    // Register fixed interval directly
    s_smooth_sweep_timer = app_timer_register(SMOOTH_SWEEP_INTERVAL_MS, smooth_sweep_timer_handler, NULL);
  }
}

static void start_smooth_sweep_timer(void) {
  if (settings.SmoothSweep && second_hand_is_active() && !s_smooth_sweep_timer) {
    time_t now_sec;
    uint16_t now_ms;
    time_ms(&now_sec, &now_ms);

    // Initial phase sync: align ONLY the first tick to the nearest ms interval boundary
    int initial_delay = SMOOTH_SWEEP_INTERVAL_MS - (now_ms % SMOOTH_SWEEP_INTERVAL_MS);
    if (initial_delay < 50) {
      initial_delay += SMOOTH_SWEEP_INTERVAL_MS;
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

static void accel_tap_handler(AccelAxisType axis, int32_t direction) {
   if (ignore_next_tap) {
       ignore_next_tap = false; // Reset the flag for the next tap
       return;
     }

  // Only handle if the seconds hand setting is enabled and not already always on
  if ((settings.SubDialChoice == 2 || settings.SubDialChoice ==6)){ // && settings.SecondsVisibleTime < 135) {
      // If a timer is already running, cancel it
      if (s_timeout_timer) {
        app_timer_cancel(s_timeout_timer);
        s_timeout_timer = NULL;
      }

      // Only subscribe to second ticks if not already subscribed
      if (!showSeconds) {
          tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
      }
      
      showSeconds = true;
      start_smooth_sweep_timer();
      
      // Register a new timer to hide the seconds hand
      s_timeout_timer = app_timer_register(SECONDS_TICK_INTERVAL_MS * settings.SecondsVisibleTime, timeout_handler, NULL);
      layer_mark_dirty(s_canvas_comp_bg);
      layer_mark_dirty(s_canvas_month_hand);
      layer_mark_dirty(s_canvas_second_hand);
  }
}

static void bluetooth_vibe_icon (bool connected) {

   layer_set_hidden(s_canvas_bt_icon, connected);

    if (!connected && strcmp(settings.VibeMode, "2") != 0) {
    if (strcmp(settings.VibeMode, "1") == 0 || !quiet_time_is_active()) {
    if (settings.SecondsVisibleTime > 0 && settings.SecondsVisibleTime < 135) {
      // Unsubscribe from accel_tap before the vibe
      accel_tap_service_unsubscribe();
      showSeconds = false;
      stop_smooth_sweep_timer(); 
    }
      #ifdef PBL_PLATFORM_DIORITE
      vibes_short_pulse();
      #else
      vibes_double_pulse();
      #endif
    }
      if (settings.SecondsVisibleTime > 0 && settings.SecondsVisibleTime < 135) {
      accel_tap_service_subscribe(accel_tap_handler);
    }
  }

}

#ifdef HAS_WEATHER
static void prv_launch_weather_delay_callback(void *data) {
  s_launch_weather_timer = NULL;
  s_launch_weather_delay = false;
  layer_mark_dirty(s_canvas_weather);
}

static void prv_request_weather_update(void) {
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  dict_write_uint8(iter, 0, 0);
  app_message_outbox_send();
}
#endif


// Load settings from persistent storage
static void prv_load_settings(void) {
  prv_default_settings();
  persist_read_data(SETTINGS_KEY, &settings, sizeof(settings));

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
  settings.BWSecondsHandColor = fg;
  settings.BWMonthHandColor = fg;
  settings.BWMinHandBatLineColor = fg;
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
    settings.HourDigitsColor = t->text;
    settings.MajorTickColor = t->text;
    settings.MinutesHandColor = t->minutes_hand;
    settings.SecondsHandColor = t->accent;
    settings.MonthHandColor = t->accent;
    settings.BatteryLineColor = t->battery_line;
    settings.BTQTColor = t->btqt;
    return true;
  }
  return false;
}

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
  Tuple *seconds_color_t = dict_find(iter, MESSAGE_KEY_SecondsHandColor);
  Tuple *bwseconds_color_t = dict_find(iter, MESSAGE_KEY_BWSecondsHandColor);
  Tuple *monthhand_color_t = dict_find(iter, MESSAGE_KEY_MonthHandColor);
  Tuple *bwmonthhand_color_t = dict_find(iter, MESSAGE_KEY_BWMonthHandColor);
  Tuple *enable_date_t = dict_find(iter, MESSAGE_KEY_EnableDate);
  Tuple *enable_battery_t = dict_find(iter, MESSAGE_KEY_EnableBattery);
  Tuple *enable_battery_line_t = dict_find(iter, MESSAGE_KEY_EnableBatteryLine);
  Tuple *bwthemeselect_t = dict_find(iter, MESSAGE_KEY_BWThemeSelect);
  Tuple *themeselect_t = dict_find(iter, MESSAGE_KEY_ThemeSelect);
  Tuple *bg_color1_t = dict_find(iter, MESSAGE_KEY_BackgroundColor1);
  Tuple *bg_color2_t = dict_find(iter, MESSAGE_KEY_MinuteHandShadowColor);
  Tuple *text_color2_t = dict_find(iter, MESSAGE_KEY_MinorTickColor);
  Tuple *date_color_t = dict_find(iter, MESSAGE_KEY_DateColor);
  Tuple *bwdate_color_t = dict_find(iter, MESSAGE_KEY_BWDateColor);
  Tuple *hours_color_t = dict_find(iter, MESSAGE_KEY_HourDigitsColor);
  Tuple *minutes_color_t = dict_find(iter, MESSAGE_KEY_MinutesHandColor);
  Tuple *tick_color_t = dict_find(iter, MESSAGE_KEY_MajorTickColor);
  Tuple *battery_line_color_t = dict_find(iter, MESSAGE_KEY_BatteryLineColor);
  Tuple *bwbg_color1_t = dict_find(iter, MESSAGE_KEY_BWBackgroundColor1);
  Tuple *bwbg_color2_t = dict_find(iter, MESSAGE_KEY_BWMinuteHandShadowColor);
  Tuple *bwtext_color1_t = dict_find(iter, MESSAGE_KEY_BWMinHandBatLineColor);
  Tuple *bwtext_color2_t = dict_find(iter, MESSAGE_KEY_BWHourDigitsColor);
  Tuple *bwtext_color3_t = dict_find(iter, MESSAGE_KEY_BWMajorTickColor);
  Tuple *btqt_color_t = dict_find(iter, MESSAGE_KEY_BTQTColor);
  Tuple *bwbtqt_color_t = dict_find(iter, MESSAGE_KEY_BWBTQTColor);
  Tuple *bwshadowon_t = dict_find(iter, MESSAGE_KEY_BWShadowOn);
  Tuple *shadowon_t = dict_find(iter, MESSAGE_KEY_ShadowOn);
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

  Tuple *subdial_t = dict_find(iter, MESSAGE_KEY_SubDialColor);
  Tuple *bwsubdial_t = dict_find(iter, MESSAGE_KEY_BWSubDialColor);
  Tuple *roman_t = dict_find(iter, MESSAGE_KEY_Roman);

  Tuple *subdialchoice_t = dict_find(iter,MESSAGE_KEY_SubDialChoice);
  Tuple *tzoffset_t = dict_find(iter, MESSAGE_KEY_TZ_OFFSET);
  Tuple *remoteampm_t = dict_find(iter, MESSAGE_KEY_showremoteAMPM);

  Tuple *smoothsweep_t = dict_find(iter, MESSAGE_KEY_SmoothSweep);
  Tuple *datelang_t = dict_find(iter, MESSAGE_KEY_DateLanguage);

  ///////Weather
  #ifdef HAS_WEATHER
  Tuple * useweather_t = dict_find(iter, MESSAGE_KEY_UseWeather);
  Tuple * frequpdate = dict_find(iter, MESSAGE_KEY_UpSlider);

  Tuple * wtemp_t = dict_find(iter, MESSAGE_KEY_WeatherTemp);
  Tuple * iconnow_tuple = dict_find(iter, MESSAGE_KEY_IconNow);
  Tuple * wforetemp_t = dict_find(iter, MESSAGE_KEY_TempFore);
  Tuple * rainsoon_t = dict_find(iter, MESSAGE_KEY_RainSoon);
  Tuple * wbgtlevel_t = dict_find(iter, MESSAGE_KEY_WBGTLevel);
  Tuple * refreshonlaunch_t = dict_find(iter, MESSAGE_KEY_RefreshWeatherOnLaunch);
  
  if (useweather_t) {
    settings.UseWeather = useweather_t->value->int32 != 0;
    settings_changed = true;
  }

  if (refreshonlaunch_t) {
    settings.RefreshWeatherOnLaunch = refreshonlaunch_t->value->int32 != 0;
    settings_changed = true;
  }


  if (frequpdate){
    settings.UpSlider = (int) frequpdate -> value -> int32;
    //Restart the counter
    s_countdown = settings.UpSlider;
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

  if (subdialchoice_t) {
      int value = atoi(subdialchoice_t->value->cstring);
      if (value >= 0 && value <= 6) {
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
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

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
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
        // Unsubscribe from accel_tap_service as it's not needed
        accel_tap_service_unsubscribe();

    } else if (settings.SubDialChoice == 2 || settings.SubDialChoice == 6) {
      // "Timeout" logic: start with seconds shown, register a timer
      showSeconds = true;
      start_smooth_sweep_timer();
        tick_timer_service_unsubscribe();
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
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
                  if (hours_color_t) {
                    settings.HourDigitsColor = GColorFromHEX(hours_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                  }
                 
                  if (minutes_color_t) {
                    settings.MinutesHandColor = GColorFromHEX(minutes_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                    layer_mark_dirty(s_date_battery_logo_layer);
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

                  ///////////////////////////////

  if (settings_changed || theme_settings_changed) {
    mark_all_layers_dirty(theme_settings_changed);
  }

  prv_save_settings();

}

static void refresh_current_time(void) {
  time_t now = time(NULL);
  g_current_epoch = now;
  prv_tick_time = localtime(&now);
}

// Recomputes everything that depends on the minute/date. Called on every minute
// tick, and after settings arrive that change what the time means (e.g. a new
// second-timezone offset).
static void update_time_state(struct tm *tick_time) {
  minutes = tick_time->tm_min;
  hours = tick_time->tm_hour % 12;
  s_hours = tick_time->tm_hour;
  layer_mark_dirty(s_canvas_layer);
  layer_mark_dirty(s_date_battery_logo_layer);
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
    // Ask the phone for fresh weather every UpSlider minutes
    if (--s_countdown <= 0) {
      s_countdown = settings.UpSlider > 0 ? settings.UpSlider : 1;
      prv_request_weather_update();
    }
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

  
  
  for (int i = 0; i < 12; i++) {
        int angle = i * 30 - 90;


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
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);

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
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  
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
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  
  GPoint origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  graphics_context_set_antialiased(ctx, true);

  graphics_context_set_fill_color(ctx, inner_color);
  graphics_fill_circle(ctx, origin, settings.InnerCentreSize); //started as 2

}


static void draw_major_tick (GContext *ctx, int angle, int length, GColor fill_color, GColor border_color) {
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  #ifdef PBL_RECT
  GRect full_bounds = layer_get_bounds (s_canvas_layer);
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
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);
  #ifdef PBL_RECT
  GRect full_bounds = layer_get_bounds (s_canvas_layer);
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
  GRect bounds = layer_get_unobstructed_bounds(s_canvas_layer);

  #ifdef PBL_RECT
   GRect full_bounds = layer_get_bounds (s_canvas_layer);
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
static void update_logo_date_battery_fctx_layer (Layer *layer, GContext *ctx) {
  
  GRect bounds = layer_get_unobstructed_bounds(s_date_battery_logo_layer);

  GRect TwelveRect = GRect(1,6,bounds.size.w, 28);
  GRect SixRect = GRect(1,bounds.size.h-28-11,bounds.size.w, 28);
  graphics_context_set_text_color(ctx, settings.BWHourDigitsColor);

  graphics_draw_text(ctx, settings.Roman ? "XII" : "12", FontHour, TwelveRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  if(!settings.EnableDate){
    graphics_draw_text(ctx, settings.Roman ? "VI" : "6", FontHour, SixRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  }


  //draw battery value
  if(settings.EnableBattery ){
     //if(strcmp(settings.PosTop, "lo") == 0){
      int s_battery_level = battery_state_service_peek().charge_percent;
      char BatterytoDraw[6];
            snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

      if (settings.EnableBatteryLine) {
        GRect BatteryRect = GRect((bounds.size.w / 2) - 18, config.BatteryYOffset, 36, 40);
        graphics_context_set_text_color(ctx, settings.BWDateColor);
        graphics_draw_text(ctx, BatterytoDraw, FontBattery, BatteryRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      }
      else{
        GRect BatteryRect = GRect((bounds.size.w / 2) - 18, config.BatteryYOffset + 4, 36, 40);
        graphics_context_set_text_color(ctx, settings.BWDateColor);
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

            const char * sys_locale = i18n_get_system_locale();
            const char * date_lang = (strcmp(settings.DateLanguage, "auto") == 0)
                            ? sys_locale
                            : settings.DateLanguage;

            char weekday[5];
            fetchwday(s_weekday, date_lang, weekday);

            char weekdaydraw[10];
            snprintf(weekdaydraw, sizeof(weekdaydraw), "%s", weekday);

            char daynow[5];
            snprintf(daynow, sizeof(daynow), "%d", current_date);

            char monthnow[9];
            fetchmonth(s_month, date_lang, monthnow);

            char datenow[15];

               if(strcmp(settings.DateFormat, "0") == 0){  // 0 = DDD DD eg WED 30

                snprintf(datenow, sizeof(datenow), "%s %d", weekday, current_date);

              } else if (strcmp(settings.DateFormat, "1") == 0){ //1 = MMM D (AUG 30, JAN 9 etc)

                snprintf(datenow, sizeof(datenow), "%s %d", monthnow, current_date);

              } else if (strcmp(settings.DateFormat, "2") == 0){ //2 = DD MMM (30 AUG, 9 JAN etc)

                snprintf(datenow, sizeof(datenow), "%d %s", current_date, monthnow);
              
              } else if (strcmp(settings.DateFormat, "3") == 0){ //3 = just the date eg 9, 30 etc

                snprintf(datenow, sizeof(datenow), "%d", current_date);
              
              } else { //4 = just the date as two digits, eg 09, 30 etc

                snprintf(datenow, sizeof(datenow), "%02d", current_date);
              
              }

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
static void update_logo_date_battery_fctx_layer (Layer *layer, GContext *ctx) {
  
  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);

  FContext fctx;
  fctx_init_context(&fctx, ctx);
  fctx_set_color_bias(&fctx, 0);
  #ifdef PBL_COLOR
   fctx_enable_aa(true);
  #endif

  
  if(!settings.EnableDate){
     for (int i = 1; i < 13; i++) {
      if (i % 2 == 0){
        fctx_begin_fill(&fctx);
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
        FPoint center_digits = FPointI(bounds.size.w / 2 + 1, bounds.size.h / 2);
        FPoint p = clockToCartesian(center_digits, text_radius, digit_angle_trig);
        fctx_set_rotation(&fctx, digit_rotation);
        fctx_set_offset(&fctx, p);
        fctx_draw_string(&fctx, digit_string, FCTX_Font, GTextAlignmentCenter, FTextAnchorMiddle);
        fctx_end_fill(&fctx);
      
      }
     }
    }
    else{
       for (int i = 1; i < 13; i++) {
      if (i % 2 == 0 && i != 6){
        fctx_begin_fill(&fctx);
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
        FPoint center_digits = FPointI(bounds.size.w / 2 + 1, bounds.size.h / 2);
        FPoint p = clockToCartesian(center_digits, text_radius, digit_angle_trig);
        fctx_set_rotation(&fctx, digit_rotation);
        fctx_set_offset(&fctx, p);
        fctx_draw_string(&fctx, digit_string, FCTX_Font, GTextAlignmentCenter, FTextAnchorMiddle);
        fctx_end_fill(&fctx);
      
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

    fctx_begin_fill(&fctx);
    fctx_set_text_em_height(&fctx, FCTX_Font, font_size_date);

    const char * sys_locale = i18n_get_system_locale();
    const char * date_lang = (strcmp(settings.DateLanguage, "auto") == 0)
                            ? sys_locale
                            : settings.DateLanguage;

    char weekday[5];
    fetchwday(s_weekday, date_lang, weekday);

    char weekdaydraw[10];
    snprintf(weekdaydraw, sizeof(weekdaydraw), "%s", weekday);

    char monthnow[10];
    fetchmonth(s_month, date_lang, monthnow);


    fctx_begin_fill(&fctx);
    fctx_set_text_em_height(&fctx, FCTX_Font, font_size_date);

    char daynow[5];
    snprintf(daynow, sizeof(daynow), "%d", current_date);


    char datenow[15];
 
              if(strcmp(settings.DateFormat, "0") == 0){  // 0 = DDD DD eg WED 30

                snprintf(datenow, sizeof(datenow), "%s %d", weekday, current_date);

              } else if (strcmp(settings.DateFormat, "1") == 0){ //1 = MMM DD (AUG 30)

                snprintf(datenow, sizeof(datenow), "%s %d", monthnow, current_date);

              } else if (strcmp(settings.DateFormat, "2") == 0){ //2 = DD MMM (30 AUG)

                snprintf(datenow, sizeof(datenow), "%d %s", current_date, monthnow);
              
              } else if (strcmp(settings.DateFormat, "3") == 0){ //3 = just the date eg 9 or 30

                snprintf(datenow, sizeof(datenow), "%d", current_date);
              
              } else { //4 = just the date as two digits eg 09 or 30

                snprintf(datenow, sizeof(datenow), "%02d", current_date);
              
              }

    fctx_set_offset(&fctx, fulldate_pos);
    #ifdef BACKLIGHTON
    fctx_draw_string(&fctx, "WED 30", FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
    #else
    fctx_draw_string(&fctx, datenow, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
    #endif
    fctx_end_fill(&fctx);


  }


  
    //draw battery value
  #ifdef HAS_WEATHER
  if(settings.EnableBattery && grect_equal(&full_bounds, &bounds) && !settings.UseWeather){
  
            fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));
            FPoint battery_pos;
            
            int font_size_battery = config.font_size_battery * bounds.size.h/full_bounds.size.h;
            
            int s_battery_level = battery_state_service_peek().charge_percent;
            fctx_begin_fill(&fctx);
            fctx_set_text_em_height(&fctx, FCTX_Font, font_size_battery);

                // Formats and draws the battery percentage text
              if (settings.EnableBatteryLine) {

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 1));
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  fctx_set_offset(&fctx, battery_pos);
                  fctx_draw_string(&fctx, BatterytoDraw, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                  fctx_end_fill(&fctx);
                }
                else { //shift the percentage text slightly when there's no battery line

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2) );
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_y)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  fctx_set_offset(&fctx, battery_pos);
                  fctx_draw_string(&fctx, BatterytoDraw, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                  fctx_end_fill(&fctx);
                }
     
  }
  #else
  if(settings.EnableBattery && grect_equal(&full_bounds, &bounds) ){
  
            fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));
            FPoint battery_pos;
            
            int font_size_battery = config.font_size_battery * bounds.size.h/full_bounds.size.h;
            
            int s_battery_level = battery_state_service_peek().charge_percent;
            fctx_begin_fill(&fctx);
            fctx_set_text_em_height(&fctx, FCTX_Font, font_size_battery);

                // Formats and draws the battery percentage text
              if (settings.EnableBatteryLine) {

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 1));
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  fctx_set_offset(&fctx, battery_pos);
                  fctx_draw_string(&fctx, BatterytoDraw, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                  fctx_end_fill(&fctx);
                }
                else { //shift the percentage text slightly when there's no battery line

                  battery_pos.x = INT_TO_FIXED((bounds.size.w / 2) );
                  battery_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_y)* bounds.size.h/full_bounds.size.h);

                  char BatterytoDraw[6];
                  snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);

                  fctx_set_offset(&fctx, battery_pos);
                  fctx_draw_string(&fctx, BatterytoDraw, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                  fctx_end_fill(&fctx);
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


static void layer_update_proc_month_hand(Layer *layer, GContext *ctx) {

    if(settings.SubDialChoice != 3 && settings.SubDialChoice != 6){
    return;
      }

   GRect bounds = layer_get_unobstructed_bounds(layer);
   GRect full_bounds = layer_get_bounds(layer);

    if (!grect_equal(&full_bounds, &bounds)) {
      return;
    }
       //month = prv_tick_time->tm_mon;
    int month = s_month + 1;    
  
    int month_angle = ((double)month / 12 * 360) - 90;


    draw_seconds_month_background(ctx);
    draw_month_hand(ctx, month_angle, config.second_hand_a, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
   draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));

}

static void layer_update_proc_tz(Layer *layer, GContext *ctx) {

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
        graphics_fill_circle(ctx, pm_dot, settings.MinuteHandThickness*1.5);
      }
     }
     else{
      draw_month_hand(ctx, hour_angle, config.second_hand_a , config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
      draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
      if (remote_pm && settings.showremoteAMPM) {
        GPoint pm_dot = polar_to_point_offset(hand_origin, hour_angle, (config.second_hand_a)/2);
        graphics_context_set_fill_color(ctx, PBL_IF_BW_ELSE(settings.BWMonthHandColor, settings.MonthHandColor));
        graphics_fill_circle(ctx, pm_dot, settings.MinuteHandThickness*1.5);
      }
     }
    
 
     if (remoteminute != prv_tick_time->tm_min) {
       draw_second_hand(ctx, minute_angle, config.second_hand_a, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor));
       draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor)); 
      }
     
     

}


static void layer_update_proc_battery_line(Layer *layer, GContext *ctx) {

    GRect bounds = layer_get_unobstructed_bounds(layer);
    GRect full_bounds = layer_get_bounds(layer);

    // If neither element is enabled in config, stop.
    if (!settings.EnableBattery && !settings.EnableBatteryLine) {
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
  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);

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

    GRect bounds = layer_get_unobstructed_bounds(layer);
    GRect full_bounds = layer_get_bounds(layer);

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

 GRect bounds = layer_get_unobstructed_bounds(layer);
 GRect full_bounds = layer_get_bounds(layer);


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

  //int hand_angle = settings.DigitalHour ? minutes_angle : hours_angle;

  #ifdef PBL_ROUND
      draw_hour_hand(ctx, hours_angle,
          (bounds.size.w/3 - config.analogue_hand_a)* bounds.size.h/full_bounds.size.h,
          settings.BackLen,
          config.hour_hand_p2x,
          config.hour_hand_p2y,
          config.corner_radius_hourhand,
          PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor));
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
              PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor));
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
              PBL_IF_BW_ELSE(settings.BWMinHandBatLineColor, settings.MinutesHandColor));
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
    
    if (!settings.UseWeather) {
      return;
    }
  
    GRect bounds = layer_get_unobstructed_bounds(layer);
    GRect full_bounds = layer_get_bounds(layer);

    if (!grect_equal(&full_bounds, &bounds)) {
      return;
    }


    // Weather older than 1.5x the update interval is stale (time_t is seconds, so x 60 x 1.5 = x 90)
    time_t staleAfterSeconds = (time_t)(settings.UpSlider * 90);
    bool weatherStale = (s_last_weather_fetch == 0) ||
        ((g_current_epoch - s_last_weather_fetch) > staleAfterSeconds);

    char CondToDraw[4];
    snprintf(CondToDraw, sizeof(CondToDraw), "%s",
             (s_launch_weather_delay || weatherStale) ? WEATHER_STALE_ICON : settings.iconnowstring);

    GRect IconNowRect = settings.EnableBatteryLine ? config.IconNowRect[0] : config.IconNowRect2[0];
    graphics_context_set_text_color(ctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));
    graphics_draw_text(ctx, CondToDraw, FontWeatherIcons, IconNowRect, GTextOverflowModeFill, GTextAlignmentRight, NULL);

    if (settings.RainSoon) {

      GRect RainIconRect = config.RainIconRect[0];
      graphics_draw_text(ctx, "\U0000F084", FontWeatherIcons, RainIconRect, GTextOverflowModeFill, GTextAlignmentLeft, NULL);
      
    }

    #ifdef BACKLIGHTON
    GRect WarningIconRect = config.WarningIconRect[0];
    graphics_context_set_text_color(ctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));
    graphics_draw_text(ctx, "\U0000F0ED", FontWeatherIcons, WarningIconRect, GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    #else
    if (settings.WBGTLevel > 0) {
      // Three distinct glyphs, one per severity level, rather than one glyph  - F0EC (yellow), F0ED (red), F0EE (black).
      const char *warnGlyph;
      switch (settings.WBGTLevel) {
        case 1:  warnGlyph = "\U0000F0EC"; break;
        case 2:  warnGlyph = "\U0000F0ED"; break;
        default: warnGlyph = "\U0000F0EE"; break; // level 3 and any unexpected value
      }

      GRect WarningIconRect = config.WarningIconRect[0];
      graphics_context_set_text_color(ctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));
      graphics_draw_text(ctx, warnGlyph, FontWeatherIcons, WarningIconRect, GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    }
    #endif
    

    FContext fctx;
    fctx_init_context(&fctx, ctx);
    fctx_set_color_bias(&fctx, 0);
    #ifdef PBL_COLOR
    fctx_enable_aa(true);
    #endif

    fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));
            FPoint temp_pos;
            
            int font_size_temp = (config.font_size_battery) + 6 * bounds.size.h/full_bounds.size.h;
            
            //int s_battery_level = battery_state_service_peek().charge_percent;
            fctx_begin_fill(&fctx);
            fctx_set_text_em_height(&fctx, FCTX_Font, font_size_temp);

                // Formats and draws the battery percentage text
              if (settings.EnableBatteryLine) {

                  temp_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 2 ));
                  temp_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z - 2 - 1)* bounds.size.h/full_bounds.size.h);

                  char TempToDraw[6];
                  //snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);
                  snprintf(TempToDraw, sizeof(TempToDraw), "%s%s",settings.tempstring,"°");


                  fctx_set_offset(&fctx, temp_pos);
                  fctx_draw_string(&fctx, TempToDraw, FCTX_Font, GTextAlignmentLeft, FTextAnchorTop);
                  fctx_end_fill(&fctx);
                }
                else { //shift the text slightly when there's no battery line

                  temp_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 2));
                  temp_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_y - 2 - 1)* bounds.size.h/full_bounds.size.h);

                  char TempToDraw[6];
                  //snprintf(BatterytoDraw,sizeof(BatterytoDraw),"%d",s_battery_level);
                  snprintf(TempToDraw, sizeof(TempToDraw), "%s%s",settings.tempstring,"°");

                  fctx_set_offset(&fctx, temp_pos);
                  fctx_draw_string(&fctx, TempToDraw, FCTX_Font, GTextAlignmentLeft, FTextAnchorTop);
                  fctx_end_fill(&fctx);
                }
                int font_size_fore = (config.font_size_battery) +2 * bounds.size.h/full_bounds.size.h;

                fctx_begin_fill(&fctx);
                fctx_set_text_em_height(&fctx, FCTX_Font, font_size_fore);
                FPoint fore_pos;
                
                 fore_pos.x = INT_TO_FIXED((bounds.size.w / 2 + 1));
                 fore_pos.y = INT_TO_FIXED((config.BatteryYOffset + config.yOffsetFctx + config.battery_pos_z)* bounds.size.h/full_bounds.size.h + 28);


                char TempForeToDraw[14];
                snprintf(TempForeToDraw, sizeof(TempForeToDraw), "%s%s",settings.temphistring,"°");

                fctx_set_offset(&fctx, fore_pos);
                fctx_draw_string(&fctx, TempForeToDraw, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                fctx_end_fill(&fctx);

    fctx_deinit_context(&fctx);

}
#endif

///update procedure for background
static void bg_update_proc(Layer *layer, GContext *ctx) {

  GRect bounds = layer_get_unobstructed_bounds(layer);
  GRect full_bounds = layer_get_bounds(layer);

  GRect Background =
       GRect(0, 0, bounds.size.w, bounds.size.h);

   graphics_context_set_fill_color(ctx,PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1) );
   graphics_fill_rect(ctx, Background,0,GCornersAll);

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
        
        #ifdef PBL_PLATFORM_APLITE
          if (i % 6 == 0) continue;
          draw_major_tick_inner_set(ctx, angle, config.majorticklengthinner* bounds.size.h/full_bounds.size.h, PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.MajorTickColor), PBL_IF_BW_ELSE(settings.BWMajorTickColor, settings.MajorTickColor));
        #else
          if (i % 2 == 0) continue;
          draw_major_tick_inner_set(ctx, angle, config.majorticklengthinner* bounds.size.h/full_bounds.size.h, PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.MajorTickColor), PBL_IF_BW_ELSE(settings.BWMajorTickColor, settings.MajorTickColor));
        #endif
      }
    }

}


static void prv_window_load(Window *window) {

  #ifdef BACKLIGHTON
    light_enable(true);  ///for ShareX screencapture gifs.  Must comment out declaration on line 11 before publishing, otherwise the backlight will stay on!
  #endif

  #ifdef HAS_WEATHER
  s_countdown = settings.UpSlider;
  
  if (settings.UseWeather && settings.RefreshWeatherOnLaunch) {
    s_launch_weather_delay = true;
    if (s_launch_weather_timer) { app_timer_cancel(s_launch_weather_timer); }
    s_launch_weather_timer = app_timer_register(LAUNCH_WEATHER_DELAY_MS, prv_launch_weather_delay_callback, NULL);
    prv_request_weather_update();
  }

  #endif

  time_t temp = time(NULL);
  g_current_epoch = temp;
  prv_tick_time = localtime(&temp);
  current_date = prv_tick_time->tm_mday;
  s_weekday = prv_tick_time->tm_wday;
  minutes = prv_tick_time->tm_min;
  hours = prv_tick_time->tm_hour % 12;
  s_hours = prv_tick_time->tm_hour;
  s_month = prv_tick_time->tm_mon;

  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  // Load fctx ffonts
    #ifndef PBL_PLATFORM_APLITE
    FCTX_Font =  ffont_create_from_resource(RESOURCE_ID_FONT_DATE_FCTX);
    #endif
    FontBTQTIcons = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DRIPICONS_16));
    //non-fctx custom fonts for B&W screens
    #ifdef PBL_PLATFORM_APLITE
    FontDate = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_18));
    FontBattery = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_16));
    FontLogo = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_14));
    FontHour = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DATE_30));
    #endif
    #ifdef HAS_WEATHER
    FontWeatherIcons = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_WEATHERICONS_20));
    #endif
  // Subscribe to the connection service to get Bluetooth status updates.
  connection_service_subscribe((ConnectionHandlers){
    .pebble_app_connection_handler = bluetooth_vibe_icon
  });


        if (settings.SubDialChoice == 1) {
        showSeconds = true;
        start_smooth_sweep_timer();
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
        } else if (settings.SubDialChoice == 2 || settings.SubDialChoice == 6){
        showSeconds = true;
        start_smooth_sweep_timer();
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
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
  layer_add_child(window_layer, s_canvas_second_hand);  //second hand
  layer_add_child(window_layer, s_canvas_tz);  //2nd timezone
  layer_add_child(window_layer, s_canvas_bt_icon);
  layer_add_child(window_layer, s_canvas_qt_icon);
  layer_add_child(window_layer, s_date_battery_logo_layer); //fctx version of text
  #ifdef HAS_WEATHER
  layer_add_child(window_layer, s_canvas_weather);
  #endif
  layer_add_child(window_layer, s_canvas_battery); //battery line
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

}


static void prv_window_unload(Window *window) {
  #ifdef BACKLIGHTON
    light_enable(false);
  #endif

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
  #endif
  layer_destroy(s_canvas_bt_icon);
  layer_destroy(s_canvas_qt_icon);
  layer_destroy(s_date_battery_logo_layer);
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
  #ifdef HAS_WEATHER
  fonts_unload_custom_font(FontWeatherIcons);
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
  #ifdef HAS_WEATHER
  const uint32_t inbox_size = 2048;
  #else
  const uint32_t inbox_size = 1024;
  #endif
  app_message_open(inbox_size, dict_calc_buffer_size(1, sizeof(uint8_t)));
  app_message_register_inbox_received(prv_inbox_received_handler);

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