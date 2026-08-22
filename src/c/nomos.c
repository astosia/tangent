#include <pebble.h>
#include "nomos.h"
#include "utils/weekday.h"
#include "utils/month.h"
#include "utils/MathUtils.h"
#include <pebble-fctx/fctx.h>
#include <pebble-fctx/fpath.h>
#include <pebble-fctx/ffont.h>

////remember to comment out before publishing!!!!
//#define BACKLIGHTON   ///Use this for ShareX screencapture GIFs
//#define DEBUG         ///Use this for showing max size of complications
////remember to comment out before publishing!!!!
#define SECONDS_TICK_INTERVAL_MS 1000

// Main window and layers
static Window *s_window;
static Layer *s_canvas_layer;
static Layer *s_bg_layer;
static Layer *s_dial_layer;
//static Layer *s_dial_digits_layer;
static Layer *s_date_battery_logo_layer;
static Layer *s_canvas_second_hand;
static Layer *s_canvas_month_hand;
static Layer *s_canvas_comp_bg;
static Layer *s_canvas_bt_icon;
static Layer *s_canvas_qt_icon;
static Layer *s_canvas_battery;

//static Layer *s_canvas_weather;

// Fonts
static GFont
    #ifdef PBL_PLATFORM_APLITE
    FontDate,
    FontBattery,
    FontLogo,
    FontHour,
    #endif
    FontBTQTIcons;

FFont* FCTX_Font;
// Time and date variables
static struct tm *prv_tick_time;
static int current_date;
static int s_weekday;
static int minutes;
static int hours;   //12h modulo
static int s_hours; //24h version
static int s_month;
static int seconds;
static bool showSeconds;

//static int s_countdown = 30;
//static int showWeather = 0;

static ClaySettings settings;


// Date position struct for different platforms
typedef struct {
  int BottomXPosition;
  int DateBottomYPosition;
  int BTQTBottomYPosition;
  int LeftxPosition;
  int xOffset;
  int yOffset;
  int xOffsetFctxWeekday;
  int xOffsetFctxDate;
  int yOffsetFctx;
  int xWeekdayOffset;
  int yWeekdayDateOffset;
  int xDateOffset;
  int ShadowAndMaskWidth;
  int WeekdayWidth;
  int DateWidth;
  int WeekdayDateHeight;
  int BTIconYOffset;
  int QTIconYOffset;
  int BatteryYOffset;
  int BatteryYOffset2;
  int BatteryYOffset3;
  int BatteryLineYOffset;
  int BatteryLineYOffset2;
  int LogoXOffset;
  int LogoYOffset;
  int LogoYOffset2;
  int LogoYOffset3;
  int font_size_digits;
  int font_size_battery;
  int font_size_date;
  int font_size_logo;
  int six_pos_x;
  int six_pos_y;
  int twelve_pos_x;
  int twelve_pos_y;
  int date_pos_x;
  int date_pos_y;
  int battery_pos_z;
  int battery_pos_y;
  int battery_line;
  int analogue_hand_a;
  int analogue_hand_b;
  int analogue_hand_c;
  int hour_hand_a;
  int min_hand_a;
  int circle_radius_adj;
  int tick_mask_radius_adj;
  int hands_shadow;
  int QTIconXOffset2;
  int BTIconXOffset2;
  int QTIconYOffset2;
  int BTIconYOffset2;
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
  GRect dial_digits_mask_a[1];
  GRect dial_digits_mask_b[1];
  GRect dial_digits_mask_c[1];
  GRect UVDayValueRect[1];
  GRect battery_arc_bounds[1];
  GRect battery_arc_bounds_centre[1];
} UIConfig;

#ifdef PBL_PLATFORM_EMERY
static const UIConfig config = {
.BottomXPosition = 46,
.DateBottomYPosition = 60, //was 168
.BTQTBottomYPosition = 119, //168-108+57 - 8,
.LeftxPosition = -5,
.xOffset = 22,
.yOffset = -8,
.xOffsetFctxWeekday = 38/2  -1,
.xOffsetFctxDate = 22/2 + 1,
.yOffsetFctx = 3,
.xWeekdayOffset = 2,
.yWeekdayDateOffset = 1 + 30- 4,
.xDateOffset = 41,
.ShadowAndMaskWidth = 64 - 20,
.WeekdayWidth = 38,
.DateWidth = 22,
.WeekdayDateHeight = 13,
.BTIconYOffset = -21,
.QTIconYOffset = 21,
.BatteryYOffset = 53-4 +3-1-2,
.BatteryYOffset2 = -9,
.BatteryYOffset3 = -9,
.BatteryLineYOffset = 66 + 6,
.BatteryLineYOffset2 = -8+114,
.LogoXOffset = 10,
.LogoYOffset = 69+1,
.LogoYOffset2 = 20,
.LogoYOffset3 = -8+114,
.font_size_digits = 40,
.digit_inset = 14,
.font_size_battery = 20,
.font_size_date = 24 + 4,
.font_size_logo = 16,
.six_pos_x = 2,
.six_pos_y = -40 + 9,
.twelve_pos_x = - 2 + 1,
.twelve_pos_y = -3,
.battery_pos_z = -2,
.battery_pos_y = 4,
.battery_line = 63, //sized to the width of the default logo 
.analogue_hand_a = 1,  //was 20
.analogue_hand_b = 0,  //was28
.analogue_hand_c = 1,
.hour_hand_a = 45,
.min_hand_a = 2,  //was 20
.circle_radius_adj = 18,
.tick_mask_radius_adj = 12,
.hands_shadow = 2,
.QTIconXOffset2 = 10,
.QTIconYOffset2 = 0,
.BTIconXOffset2 = 10,
.BTIconYOffset2 = 0,
.corner_radius_minutehand = 20,
.corner_radius_hourhand = 10,
.corner_radius_majortickrect = 20,
.corner_radius_minortickrect = 20,
.majortickrect_w = 86 + 4 + 4,
.majortickrect_h = 100 + 4 + 4,
.minortickrect_w = 90 + 4,
.minortickrect_h = 104 + 4,
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
.dial_digits_mask_a = {{{100-15,23},{39,7}}},
.dial_digits_mask_b = {{{100-19,0},{39,27}}},
.dial_digits_mask_c = {{{100-15,228-27},{31,27}}},
  .UVDayValueRect = {{{57,97},{25,25}}},     //UVI value daily forecast max
  .battery_arc_bounds = {{{51,98},{37,37}}},        //UV arc, right of centre, middle row
  .battery_arc_bounds_centre = {{{49,96},{41,41}}}    //UVI daily forecast maximum

};
#elif defined(PBL_PLATFORM_GABBRO)
static const UIConfig config = {
.BottomXPosition = 46+30,
.DateBottomYPosition = 67, //168+22+3,
.BTQTBottomYPosition = 141, //168+22+3-64-10,
.LeftxPosition = 16+2,
.xOffset = 22,
.yOffset = -8,
.xOffsetFctxWeekday = 38/2  -1,
.xOffsetFctxDate = 22/2 + 1,
.yOffsetFctx = 3,
.xWeekdayOffset = 2,
.yWeekdayDateOffset = 1 + 32 - 4,
.xDateOffset = 41,
.ShadowAndMaskWidth = 64 - 20,
.WeekdayWidth = 38,
.DateWidth = 22,
.WeekdayDateHeight = 13,
.BTIconYOffset = -21,
.QTIconYOffset = 21,
.BatteryYOffset = 53-4 +3-1 + 11 - 2,
.BatteryYOffset2 = -9,
.BatteryYOffset3 = -1,
.BatteryLineYOffset = 66 + 6 + 11,
.BatteryLineYOffset2 = -8+130,
.LogoXOffset = 22,
.LogoYOffset = 69+1+1,
.LogoYOffset2 = 21,
.LogoYOffset3 = -8+130,
.font_size_digits = 48,
.digit_inset = 31,
.font_size_battery = 20,
.font_size_date = 28 + 4,
.font_size_logo = 16,
.six_pos_x = 2,
.six_pos_y = - 40 + 9,
.twelve_pos_x = - 2 + 1,
.twelve_pos_y = -3,
.battery_pos_z = -2,
.battery_pos_y = 4,
.battery_line = 63,
.analogue_hand_a = 3+8,
.analogue_hand_b = 0,  //was 32
.hour_hand_a = 60,
.min_hand_a = 2,
.circle_radius_adj = 17,
.tick_mask_radius_adj = 12,
.hands_shadow = 2,
.QTIconXOffset2 = 10,
.QTIconYOffset2 = 0,
.BTIconXOffset2 = 10,
.BTIconYOffset2 = 0,
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
.dial_digits_mask_a = {{{130-15,23-2},{39,7+2}}},
.dial_digits_mask_b = {{{130-19,0},{39,27}}},
.dial_digits_mask_c = {{{130-15,260-27},{31,27}}},
  .UVDayValueRect = {{{57+29,98+13},{25,25}}},     //UVI value daily forecast max
  .battery_arc_bounds = {{{51+29,99+13},{37,37}}},        //UV arc, right of centre, middle row
  .battery_arc_bounds_centre = {{{49+29,97+13},{41,41}}}    //UVI daily forecast maximum

};
#elif defined(PBL_BW)
static const UIConfig config = {
.BottomXPosition = 38,
.DateBottomYPosition = 40, //126-3+5,
.BTQTBottomYPosition = 45, //126-3,
.LeftxPosition = 6 - 2,
.xOffset = 10,
.yOffset = -7,
.xOffsetFctxWeekday = 30/2 ,
.xOffsetFctxDate = 16/2 +1,
.yOffsetFctx = 2,
.xWeekdayOffset = 1,
.yWeekdayDateOffset = 18 - 2,
.xDateOffset = 31,
.ShadowAndMaskWidth = 48-12,
.WeekdayWidth = 30,
.DateWidth = 16,
.WeekdayDateHeight = 11,
.BTIconYOffset = -20,
.QTIconYOffset = 18,
.BatteryYOffset = 40-4,
.BatteryYOffset2 = -5,
.BatteryYOffset3 = -5,
.BatteryLineYOffset = 49 + 6,
.BatteryLineYOffset2 = -8+84,
.LogoXOffset = 6,
.LogoYOffset = 52+1,
.LogoYOffset2 = -5+20,
.LogoYOffset3 = -5+84,
.font_size_digits = 30,
.digit_inset = 10,
.font_size_battery = 16,
.font_size_date = 18 + 2,
.font_size_logo = 14,
.six_pos_x = 2,
.six_pos_y = - 38 + 9,
.twelve_pos_x = - 2 + 1,
.twelve_pos_y = -2,
.battery_pos_z = 0,
.battery_pos_y = 4,
.battery_line = 51,
.analogue_hand_a = 1,
.analogue_hand_b = 0,  //was22
.analogue_hand_c = 1,
.hour_hand_a = 35,
.min_hand_a = 22,
.circle_radius_adj = 18,
.tick_mask_radius_adj = 12,
.hands_shadow = 1,
.QTIconXOffset2 = 42,
.QTIconYOffset2 = 23,
.BTIconXOffset2 = -29,
.BTIconYOffset2 = 23,
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
.dial_digits_mask_a = {{{72-14,22},{36,7}}},
.dial_digits_mask_b = {{{72-18,0},{36,26}}},
.dial_digits_mask_c = {{{72-13,168-26},{28,26}}},
  .UVDayValueRect = {{{45-7+37,79-20+8+3+4-27},{20,14}}},     //UVI value daily forecast max
  .battery_arc_bounds = {{{37+39,87-20+8-27},{24,24}}},        //UV arc, right of centre, middle row
  .battery_arc_bounds_centre = {{{37-2+2+37,87-2-20+8-27},{24+4,24+4}}}    //UVI daily forecast maximum


};
#elif defined(PBL_ROUND)
static const UIConfig config = {
.BottomXPosition = 52,
.DateBottomYPosition = 48, //132,
.BTQTBottomYPosition = 95, //132 - 104+63 - 6,
.LeftxPosition = 16,
.xOffset = 14,
.yOffset = -7,
.xOffsetFctxWeekday = 30/2 -1,
.xOffsetFctxDate = 16/2 +1,
.yOffsetFctx = 2,
.xWeekdayOffset = 1,
.yWeekdayDateOffset = 1 + 24 - 4,
.xDateOffset = 31,
.ShadowAndMaskWidth = 48-16,
.WeekdayWidth = 30,
.DateWidth = 16,
.WeekdayDateHeight = 11,
.BTIconYOffset = -20,
.QTIconYOffset = 18,
.BatteryYOffset = 40-4,
.BatteryYOffset2 = -4,
.BatteryYOffset3 = -4,
.BatteryLineYOffset = 49 + 6,
.BatteryLineYOffset2 = -8+90+4,
.LogoXOffset = 14,
.LogoYOffset = 52+1,
.LogoYOffset2 = -8+23,
.LogoYOffset3 = -8+90+4,
.font_size_digits = 32,
.digit_inset = 23,
.font_size_battery = 16,
.font_size_date = 18 + 4,
.font_size_logo = 14,
.six_pos_x = 2,
.six_pos_y = - 38 + 9,
.twelve_pos_x = - 2 + 1,
.twelve_pos_y = -2,
.battery_pos_z = 0,
.battery_pos_y = 4,
.battery_line = 51,
.analogue_hand_a = 10,
.analogue_hand_b = 0, //was22
.hour_hand_a = 50,
.min_hand_a = 34,
.circle_radius_adj = 17,
.tick_mask_radius_adj = 12,
.hands_shadow = 2,
.QTIconXOffset2 = 8,
.QTIconYOffset2 = 0,
.BTIconXOffset2 = 8,
.BTIconYOffset2 = 0,
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
.dial_digits_mask_a = {{{90-14,22},{36,7}}},
.dial_digits_mask_b = {{{90-18,0},{36,26}}},
.dial_digits_mask_c = {{{90-13,180-26},{28,26}}},
  .UVDayValueRect = {{{45-7+18+1,79-20+8+3+4+4},{20,14}}},     //UVI value daily forecast max
  .battery_arc_bounds = {{{37+18,87-20+8+4},{24,24}}},        //UV arc, right of centre, middle row
  .battery_arc_bounds_centre = {{{37-2+18,87-2-20+8+4},{24+4,24+4}}}    //UVI daily forecast maximum



};
#else // Default for other platforms
static const UIConfig config = {
.BottomXPosition = 38,
.DateBottomYPosition = 40, //126-3+5,
.BTQTBottomYPosition = 45, //126-3 ,
.LeftxPosition = 7 - 2,
.xOffset = 10,
.yOffset = -7,
.xOffsetFctxWeekday = 30/2 -1,
.xOffsetFctxDate = 16/2 +1,
.yOffsetFctx = 2,
.xWeekdayOffset = 1,
.yWeekdayDateOffset = 18 - 2,
.xDateOffset = 31,
.ShadowAndMaskWidth = 48-12,
.WeekdayWidth = 30,
.DateWidth = 16,
.WeekdayDateHeight = 11,
.BTIconYOffset = -20,
.QTIconYOffset = 18,
.BatteryYOffset = 40-4,
.BatteryYOffset2 = -7,
.BatteryYOffset3 = -7,
.BatteryLineYOffset = 49 + 6,
.BatteryLineYOffset2 = -8+84+1,
.LogoXOffset = 6,
.LogoYOffset = 52+1,
.LogoYOffset2 = -8+22,
.LogoYOffset3 = -8+84,
.font_size_digits = 28,
.digit_inset = 10,
.font_size_battery = 16,
.font_size_date = 18 + 2,
.font_size_logo = 14,
.six_pos_x = 2,
.six_pos_y = - 38 + 9,
.twelve_pos_x = - 2 + 1,
.twelve_pos_y = -2,
.battery_pos_z = 0,
.battery_pos_y = 4,
.battery_line = 51,
.analogue_hand_a = 1,
.analogue_hand_b = 0, //was  22
.analogue_hand_c = 1,
.hour_hand_a = 35,
.min_hand_a = 22,
.circle_radius_adj = 18,
.tick_mask_radius_adj = 12,
.hands_shadow = 2,
.QTIconXOffset2 = 42,
.QTIconYOffset2 = 23,
.BTIconXOffset2 = -29,
.BTIconYOffset2 = 23,
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
.dial_digits_mask_a = {{{72-14,22},{36,7}}},
.dial_digits_mask_b = {{{72-18,0},{36,26}}},
.dial_digits_mask_c = {{{72-13,168-26},{28,26}}},
  .UVDayValueRect = {{{45-7,79-20+8+3+4},{20,14}}},     //UVI value daily forecast max
  .battery_arc_bounds = {{{37,87-20+8},{24,24}}},        //UV arc, right of centre, middle row
  .battery_arc_bounds_centre = {{{37-2,87-2-20+8},{24+4,24+4}}}    //UVI daily forecast maximum

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
static void bg_update_proc(Layer *layer, GContext *ctx);
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
 settings.EnableSecondsHand = true;
 settings.AlwaysShowSubDial = false;
  settings.SecondsVisibleTime = 135;
  settings.EnableDate = true;
  settings.EnableMonth = false;
  settings.EnableBattery = true;
  settings.EnableBatteryLine = true;
  settings.EnableLogo = false;
  snprintf(settings.LogoText, sizeof(settings.LogoText), "%s", "tangent");
  settings.BackgroundColor1 = GColorOxfordBlue;
  settings.SubDialColor = GColorOxfordBlue;
  settings.MinuteHandShadowColor = GColorBlack;
  settings.MinorTickColor = GColorPictonBlue;
  settings.DateColor = GColorYellow;
  settings.HourDigitsColor = GColorYellow;
  settings.HoursHandBorderColor = GColorDarkGray;
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
  settings.Font = 1;
  snprintf(settings.VibeMode, sizeof(settings.VibeMode), "%s", "0");
  snprintf(settings.DateFormat, sizeof(settings.DateFormat), "%s", "0");
  settings.AddZero12h = false;
  settings.RemoveZero24h = false;
  settings.ForegroundShape = true;  //true = round, false = rect
  settings.MinuteCentreSize = config.HourCentreOuterRadius - 2;
  settings.HourCentreSize = config.HourCentreOuterRadius;
  settings.InnerCentreSize = config.HourCentreInnerRadius;
  settings.SecondOuterCentreSize = config.SecondHandCentreOuterRadius;
  settings.SecondInnerCentreSize = config.SecondHandCentreInnerRadius;
  settings.MinuteHandThickness = 2;
  settings.HourHandThickness = 2;
  settings.DigitalHour = true;
  settings.BackSize = 4;
  settings.BackLen = config.analogue_hand_b;

////////Weather
  // settings.UVMaxColor = GColorWhite;
  // settings.UVNowColor = PBL_IF_BW_ELSE(GColorWhite,GColorRed);
  // settings.UVArcColor = GColorLightGray;
  // settings.UseWeather = false;
  // settings.UpSlider = 30;
  // settings.WeatherUnit = 0;
  
}

// Quiet time icon handler
static void quiet_time_icon () {
    // #ifdef BACKLIGHTON
    // layer_set_hidden(s_canvas_qt_icon, quiet_time_is_active());
    // #else
    layer_set_hidden(s_canvas_qt_icon, !quiet_time_is_active());
    //#endif
}

static AppTimer *s_timeout_timer;


static void timeout_handler(void *context) {
  showSeconds = false;

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
  if (settings.EnableSecondsHand && settings.SecondsVisibleTime < 135) {
      // If a timer is already running, cancel it
      if (s_timeout_timer) {
        app_timer_cancel(s_timeout_timer);
        s_timeout_timer = NULL;
      }

      // Only subscribe to second ticks if not already subscribed
      if (!showSeconds) {
          tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
      //   layer_mark_dirty(s_canvas_second_hand);
      }
      
      showSeconds = true;
      
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

// Load settings from persistent storage
static void prv_load_settings(void) {
  prv_default_settings();
  persist_read_data(SETTINGS_KEY, &settings, sizeof(settings));
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
  Tuple *enable_seconds_t = dict_find(iter, MESSAGE_KEY_EnableSecondsHand);
  Tuple *always_sub_t = dict_find(iter, MESSAGE_KEY_AlwaysShowSubDial);
  Tuple *enable_secondsvisible_t = dict_find(iter, MESSAGE_KEY_SecondsVisibleTime);
  Tuple *seconds_color_t = dict_find(iter, MESSAGE_KEY_SecondsHandColor);
  Tuple *bwseconds_color_t = dict_find(iter, MESSAGE_KEY_BWSecondsHandColor);
  Tuple *monthhand_color_t = dict_find(iter, MESSAGE_KEY_MonthHandColor);
  Tuple *bwmonthhand_color_t = dict_find(iter, MESSAGE_KEY_BWMonthHandColor);
  Tuple *enable_date_t = dict_find(iter, MESSAGE_KEY_EnableDate);
  Tuple *enable_month_t = dict_find(iter, MESSAGE_KEY_EnableMonth);
  Tuple *enable_battery_t = dict_find(iter, MESSAGE_KEY_EnableBattery);
  Tuple *enable_battery_line_t = dict_find(iter, MESSAGE_KEY_EnableBatteryLine);
  Tuple *enable_logo_t = dict_find(iter, MESSAGE_KEY_EnableLogo);
  Tuple *logotext_t = dict_find(iter, MESSAGE_KEY_LogoText);
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
  Tuple *addzero12_t = dict_find(iter, MESSAGE_KEY_AddZero12h);
  Tuple *remzero24_t = dict_find(iter, MESSAGE_KEY_RemoveZero24h);
  Tuple *majort_t = dict_find(iter, MESSAGE_KEY_showMajorTick);
  Tuple *minort_t = dict_find(iter, MESSAGE_KEY_showMinorTick);
  Tuple *fg_shape_t = dict_find(iter, MESSAGE_KEY_ForegroundShape);
  Tuple *dig_t = dict_find(iter,MESSAGE_KEY_DigitalHour);
  Tuple *minhand_t = dict_find(iter, MESSAGE_KEY_MinuteHandThickness);
  Tuple *hrhand_t = dict_find(iter, MESSAGE_KEY_HourHandThickness);
  Tuple *minocent_t = dict_find(iter, MESSAGE_KEY_MinuteCentreSize);
  Tuple *hrocent_t = dict_find(iter, MESSAGE_KEY_HourCentreSize);
  Tuple *icent_t = dict_find(iter, MESSAGE_KEY_InnerCentreSize);
  Tuple *back_t = dict_find(iter, MESSAGE_KEY_BackSize);
  Tuple *backlen_t = dict_find(iter, MESSAGE_KEY_BackLen);

  Tuple *subdial_t = dict_find(iter, MESSAGE_KEY_SubDialColor);
  Tuple *bwsubdial_t = dict_find(iter, MESSAGE_KEY_BWSubDialColor);

  ////////Weather
  // Tuple * uvarccol_t = dict_find(iter,MESSAGE_KEY_UVArcColor);
  // Tuple * uvmaxcol_t = dict_find(iter,MESSAGE_KEY_UVMaxColor);
  // Tuple * uvnowcol_t = dict_find(iter,MESSAGE_KEY_UVNowColor);
  // Tuple * useweather_t = dict_find(iter, MESSAGE_KEY_UseWeather);
  // Tuple * frequpdate_t = dict_find(iter, MESSAGE_KEY_UpSlider);

  // if (frequpdate_t){
  //   settings.UpSlider = (int) frequpdate_t -> value -> int32;
  //   //Restart the counter
  //   s_countdown = settings.UpSlider;
  //    settings_changed = true;
  // }

  // if (useweather_t) {
  //   settings.UseWeather = useweather_t->value->int32 != 0;
  //   if(settings.UseWeather){
  //     accel_tap_service_subscribe(accel_tap_handler); 
  //     #ifdef DEBUG
  //       APP_LOG(APP_LOG_LEVEL_DEBUG, "accel subscribed weather on");
  //     #endif
  //   }
  //   settings_changed = true;
  // }

  if (fg_shape_t) {
    settings.ForegroundShape = fg_shape_t->value->int32 == 1;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
  }

  if (dig_t) {
    settings.DigitalHour = dig_t->value->int32 != 0;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (minocent_t) {
    settings.MinuteCentreSize = (int) minocent_t -> value -> int32;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (hrocent_t) {
    settings.HourCentreSize = (int) hrocent_t -> value -> int32;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (icent_t) {
    settings.InnerCentreSize = (int) icent_t -> value -> int32;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (minhand_t) {
    settings.MinuteHandThickness = (int) minhand_t -> value -> int32;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
    layer_mark_dirty(s_canvas_month_hand);
    layer_mark_dirty(s_canvas_second_hand);
  }

  if (hrhand_t) {
    settings.HourHandThickness = (int) hrhand_t -> value -> int32;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (back_t) {
    settings.BackSize = (int) back_t -> value -> int32;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (backlen_t) {
    settings.BackLen = (int) backlen_t -> value -> int32;
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
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

  if (enable_seconds_t) {
    settings.EnableSecondsHand = enable_seconds_t->value->int32 == 1;
    // Unsubscribe from any existing tick services
    tick_timer_service_unsubscribe();
    accel_tap_service_unsubscribe();
    // Always subscribe to MINUTE_UNIT by default for efficiency
    tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
    layer_mark_dirty(s_canvas_comp_bg);
    layer_mark_dirty(s_canvas_month_hand);
    layer_mark_dirty(s_canvas_second_hand);
  }

  if (vibe_t) {
    strncpy(settings.VibeMode, vibe_t->value->cstring, sizeof(settings.VibeMode)); 
    layer_mark_dirty(s_canvas_bt_icon);
  }

  if (dateform_t) {
    strncpy(settings.DateFormat, dateform_t->value->cstring, sizeof(settings.DateFormat)); 
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (addzero12_t) {
    settings.AddZero12h = addzero12_t->value->int32 != 0;
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (remzero24_t) {
    settings.RemoveZero24h = remzero24_t->value->int32 != 0;
     layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (enable_date_t) {
    settings.EnableDate = enable_date_t->value->int32 == 1;
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
  }

  if (enable_month_t) {
    settings.EnableMonth = enable_month_t->value->int32 == 1;
    layer_mark_dirty(s_canvas_comp_bg);
    layer_mark_dirty(s_canvas_month_hand);
    layer_mark_dirty(s_canvas_second_hand);
  }

  if (enable_logo_t) {
    settings.EnableLogo = enable_logo_t->value->int32 == 1;

    // Check if the logo is enabled and the custom text string is not empty
    if (settings.EnableLogo && logotext_t && strlen(logotext_t->value->cstring) > 0) {
      // If the custom text field is not blank, use the user's text
      snprintf(settings.LogoText, sizeof(settings.LogoText), "%s", logotext_t->value->cstring);
    } else if (settings.EnableLogo && strlen(logotext_t->value->cstring) == 0) {
      // If the custom text field is blank but the logo is enabled, use the default text
      snprintf(settings.LogoText, sizeof(settings.LogoText), "%s", "tangent");
    }
    else {
      snprintf(settings.LogoText, sizeof(settings.LogoText), "%s", "");
    }

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
    if (settings.SecondsVisibleTime == 135) {
      // "Always On" logic: show seconds, and don't register a timer
      showSeconds = true;
      if (settings.EnableSecondsHand) {
        tick_timer_service_unsubscribe();
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
        // Unsubscribe from accel_tap_service as it's not needed
        accel_tap_service_unsubscribe();
      }
    } else if (settings.SecondsVisibleTime > 0) {
      // "Timeout" logic: start with seconds shown, register a timer
      showSeconds = true;
      if (settings.EnableSecondsHand) {
        tick_timer_service_unsubscribe();
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
        s_timeout_timer = app_timer_register(SECONDS_TICK_INTERVAL_MS * settings.SecondsVisibleTime, timeout_handler, NULL);
        // Subscribe to accel_tap_service to reset the timer
        accel_tap_service_subscribe(accel_tap_handler);
      }
    } else {
      // "Disabled" logic: don't show seconds, ensure on minute ticks
      showSeconds = false;
      tick_timer_service_unsubscribe();
      tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
      // Unsubscribe from accel_tap_service
      accel_tap_service_unsubscribe();
    }
    layer_mark_dirty(s_canvas_second_hand);
  }


  if (bwthemeselect_t) {
          // Compare the string value received from the phone
          if (strcmp(bwthemeselect_t->value->cstring, "wh") == 0) {
              // Set the theme and other settings for "wh"
                    settings.BWDateColor = GColorBlack;
                    if (bwshadowon_t) {
                      settings.BWShadowOn = bwshadowon_t->value->int32 == 1;
                    }
                        if(settings.BWShadowOn){
                          settings.BWMinuteHandShadowColor = GColorDarkGray;
                        }
                        else {
                        settings.BWMinuteHandShadowColor = GColorWhite;
                        }
                    settings.BWBackgroundColor1 = GColorWhite;
                    settings.BWSubDialColor = GColorWhite;
                    settings.BWSecondsHandColor = GColorBlack;
                    settings.BWMonthHandColor = GColorBlack;
                    settings.BWMinHandBatLineColor = GColorBlack;
                    settings.BWHourDigitsColor = GColorBlack;
                    settings.BWMajorTickColor = GColorBlack;
                    settings.BWBTQTColor = GColorBlack;
                    // settings.UVArcColor = GColorLightGray;
                    // settings.UVMaxColor = GColorWhite;
                    // settings.UVNowColor = GColorWhite;
                      theme_settings_changed = true;
                    //    APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme white selected");
          } else if (strcmp(bwthemeselect_t->value->cstring, "bl") == 0) {
              // Set the theme and other settings for "bl"
                    settings.BWDateColor = GColorWhite;
                    settings.BWBackgroundColor1 = GColorBlack;
                    settings.BWSubDialColor = GColorBlack;
                    if (bwshadowon_t) {
                      settings.BWShadowOn = bwshadowon_t->value->int32 == 1;
                    }
                        if(settings.BWShadowOn){
                          settings.BWMinuteHandShadowColor = GColorDarkGray;
                        }
                        else {
                        settings.BWMinuteHandShadowColor = GColorBlack;
                        }
                    settings.BWSecondsHandColor = GColorWhite;
                    settings.BWMonthHandColor = GColorWhite;
                    settings.BWMinHandBatLineColor = GColorWhite;
                    settings.BWHourDigitsColor = GColorWhite;
                    settings.BWMajorTickColor = GColorWhite;
                    settings.BWBTQTColor = GColorWhite;
                    // settings.UVArcColor = GColorDarkGray;
                    // settings.UVMaxColor = GColorBlack;
                    // settings.UVNowColor = GColorBlack;
                      theme_settings_changed = true;
                    //    APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme black selected");
          } else if (strcmp(bwthemeselect_t->value->cstring, "cu") == 0) {
              // Set the theme for "cu" and handle custom colors
              settings.BWDateColor = GColorFromHEX(bwdate_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);

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
                  //  if (uvarccol_t){ settings.UVArcColor = GColorFromHEX(uvarccol_t-> value -> int32);}
                  //  if (uvmaxcol_t){settings.UVMaxColor = GColorFromHEX(uvmaxcol_t-> value -> int32);}
                  //  if (uvnowcol_t){settings.UVNowColor = GColorFromHEX(uvnowcol_t-> value -> int32);}
                  //   layer_mark_dirty(s_canvas_weather);
                  theme_settings_changed = true;
                  //  APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme custom selected");
                }
          }
/////////////////////////////////////
  if (themeselect_t) {
          // Compare the string value received from the phone
          if (strcmp(themeselect_t->value->cstring, "wh") == 0) {
              // Set the theme and other settings for "wh"
                    if (shadowon_t) {
                      settings.ShadowOn = shadowon_t->value->int32 == 1;
                    }
                        if(settings.ShadowOn){
                          settings.MinuteHandShadowColor = GColorBabyBlueEyes;
                        }
                        else {
                        settings.MinuteHandShadowColor = GColorWhite;
                        }
                    settings.BackgroundColor1 = GColorWhite;
                    settings.SubDialColor = GColorWhite;
                    settings.MinorTickColor = GColorBlack;
                    settings.DateColor = GColorBlack;
                    settings.HourDigitsColor = GColorBlack;
                    settings.MinutesHandColor = GColorCobaltBlue;
                    settings.SecondsHandColor = GColorOrange;
                    settings.MonthHandColor = GColorOrange;
                    settings.MajorTickColor = GColorBlack;
                    settings.BatteryLineColor = GColorOrange;
                    settings.BTQTColor = GColorDarkGray;
                    // settings.UVArcColor = GColorLightGray;
                    // settings.UVMaxColor = GColorWhite;
                    // settings.UVNowColor = GColorRed;
                      theme_settings_changed = true;
                    //    APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme white selected");
          } else if (strcmp(themeselect_t->value->cstring, "bl") == 0) {
              // Set the theme and other settings for "bl"

                    settings.BackgroundColor1 = GColorBlack;
                    settings.SubDialColor = GColorBlack;
                    if (shadowon_t) {
                      settings.ShadowOn = shadowon_t->value->int32 == 1;
                    }
                        if(settings.ShadowOn){
                          settings.MinuteHandShadowColor = GColorDarkGray;
                        }
                        else {
                        settings.MinuteHandShadowColor = GColorBlack;
                        }
                    settings.MinorTickColor = GColorDarkGray;
                    settings.DateColor = GColorYellow;
                    settings.HourDigitsColor = GColorYellow;
                    settings.MinutesHandColor = GColorWhite;
                    settings.SecondsHandColor = GColorWhite;
                    settings.MonthHandColor = GColorWhite;
                    settings.MajorTickColor = GColorYellow;
                    settings.BatteryLineColor = GColorYellow;
                    settings.BTQTColor = GColorLightGray;
                    // settings.UVArcColor = GColorLightGray;
                    // settings.UVMaxColor = GColorWhite;
                    // settings.UVNowColor = GColorRed;
                      theme_settings_changed = true;
                      //  APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme black selected");
          } else if (strcmp(themeselect_t->value->cstring, "bu") == 0) {
              // Set the theme and other settings for "bl"

                    settings.BackgroundColor1 = GColorOxfordBlue;
                    settings.SubDialColor = GColorOxfordBlue;
                    if (shadowon_t) {
                      settings.ShadowOn = shadowon_t->value->int32 == 1;
                    }
                        if(settings.ShadowOn){
                          settings.MinuteHandShadowColor = GColorBlack;
                        }
                        else {
                        settings.MinuteHandShadowColor = GColorOxfordBlue;
                        }
                    settings.MinorTickColor = GColorPictonBlue;
                    settings.DateColor = GColorYellow;
                    settings.HourDigitsColor = GColorYellow;
                    settings.MinutesHandColor = GColorWhite;
                    settings.SecondsHandColor = GColorRed;
                    settings.MonthHandColor = GColorRed;
                    settings.MajorTickColor = GColorYellow;
                    settings.BatteryLineColor = GColorRed;
                    settings.BTQTColor = GColorPictonBlue;
                    // settings.UVArcColor = GColorLightGray;
                    // settings.UVMaxColor = GColorWhite;
                    // settings.UVNowColor = GColorRed;
                      theme_settings_changed = true;
                      //  APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme blue selected");
          } else if (strcmp(themeselect_t->value->cstring, "pl") == 0) {
              // Set the theme and other settings for "bl"

                    settings.BackgroundColor1 = GColorPurple;
                    settings.SubDialColor = GColorPurple;
                    if (shadowon_t) {
                      settings.ShadowOn = shadowon_t->value->int32 == 1;
                    }
                        if(settings.ShadowOn){
                          settings.MinuteHandShadowColor = GColorImperialPurple;
                        }
                        else {
                        settings.MinuteHandShadowColor = GColorPurple;
                        }
                    settings.MinorTickColor = GColorImperialPurple;
                    settings.DateColor = GColorRichBrilliantLavender;
                    settings.HourDigitsColor = GColorRichBrilliantLavender;
                    settings.MinutesHandColor = GColorRichBrilliantLavender;
                    settings.SecondsHandColor = GColorBulgarianRose;
                    settings.MonthHandColor = GColorBulgarianRose;
                    settings.MajorTickColor = GColorRichBrilliantLavender;
                    settings.BatteryLineColor = GColorBulgarianRose;
                    settings.BTQTColor = GColorImperialPurple;
                    // settings.UVArcColor = GColorLightGray;
                    // settings.UVMaxColor = GColorWhite;
                    // settings.UVNowColor = GColorRed;
                      theme_settings_changed = true;
                      //  APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme purple selected");
          } else if (strcmp(themeselect_t->value->cstring, "gr") == 0) {
              // Set the theme and other settings for "gr"

                    settings.BackgroundColor1 = GColorBlack;
                    settings.SubDialColor = GColorBlack;
                    if (shadowon_t) {
                      settings.ShadowOn = shadowon_t->value->int32 == 1;
                    }
                        if(settings.ShadowOn){
                          settings.MinuteHandShadowColor = GColorDarkGreen;
                        }
                        else {
                        settings.MinuteHandShadowColor = GColorBlack;
                        }
                    settings.MinorTickColor = GColorDarkGreen;
                    settings.DateColor = GColorBrightGreen;
                    settings.HourDigitsColor = GColorBrightGreen;
                    settings.MinutesHandColor = GColorBrightGreen;
                    settings.SecondsHandColor = GColorPastelYellow;
                    settings.MonthHandColor = GColorPastelYellow;
                    settings.MajorTickColor = GColorBrightGreen;
                    settings.BatteryLineColor = GColorPastelYellow;
                    settings.BTQTColor = GColorDarkGreen;
                    // settings.UVArcColor = GColorDarkGray;
                    // settings.UVMaxColor = GColorBlack;
                    // settings.UVNowColor = GColorWhite;
                      theme_settings_changed = true;
                      //  APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme black & green selected");
          } else if (strcmp(themeselect_t->value->cstring, "cu") == 0) {
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
                   // layer_mark_dirty(s_canvas_second_hand);
                  }
                 
                  if (minutes_color_t) {
                    settings.MinutesHandColor = GColorFromHEX(minutes_color_t->value->int32);
                    layer_mark_dirty(s_canvas_layer);
                  //  layer_mark_dirty(s_canvas_second_hand);
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
                  // if (uvarccol_t){ settings.UVArcColor = GColorFromHEX(uvarccol_t-> value -> int32);}
                  // if (uvmaxcol_t){settings.UVMaxColor = GColorFromHEX(uvmaxcol_t-> value -> int32);}
                  // if (uvnowcol_t){settings.UVNowColor = GColorFromHEX(uvnowcol_t-> value -> int32);}
                  theme_settings_changed = true;
                //    APP_LOG(APP_LOG_LEVEL_DEBUG, "Theme custom selected");
                }
          }

                  ///////////////////////////////

  if (settings_changed) {
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_dial_layer);
   // layer_mark_dirty(s_dial_digits_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
    layer_mark_dirty(s_canvas_second_hand);
    layer_mark_dirty(s_canvas_month_hand);
    layer_mark_dirty(s_canvas_battery);
   // layer_mark_dirty(s_canvas_weather);
  }

  if (theme_settings_changed) {
    layer_mark_dirty(s_bg_layer);
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_dial_layer);
  //  layer_mark_dirty(s_dial_digits_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
    layer_mark_dirty(s_canvas_second_hand);
    layer_mark_dirty(s_canvas_month_hand);
    layer_mark_dirty(s_canvas_qt_icon);
    layer_mark_dirty(s_canvas_bt_icon);
    layer_mark_dirty(s_canvas_battery);
   // layer_mark_dirty(s_canvas_weather);
  }

  prv_save_settings();

}

static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  
  APP_LOG(APP_LOG_LEVEL_DEBUG, "tick_handler fired: %02d:%02d", tick_time->tm_hour, tick_time->tm_min);

  time_t temp = time(NULL);
  prv_tick_time = localtime(&temp);

  // Update hour and minute hands and the date on minute change
  if (units_changed & MINUTE_UNIT) {
    minutes = tick_time->tm_min;
    hours = tick_time->tm_hour % 12;
    s_hours = tick_time->tm_hour;
    layer_mark_dirty(s_canvas_layer);
    layer_mark_dirty(s_date_battery_logo_layer);
    if(settings.EnableMonth && tick_time->tm_mon != s_month){
      s_month = tick_time->tm_mon;
    }
    if (settings.EnableDate && tick_time->tm_mday != current_date) {
      current_date = tick_time->tm_mday;
      s_weekday = tick_time->tm_wday;
      s_month = tick_time->tm_mon;
    }
  }
// Update seconds hand on second change, but only if it's visible
  if (showSeconds && (units_changed & SECOND_UNIT)) {
    seconds = tick_time->tm_sec;
    layer_mark_dirty(s_canvas_second_hand);
  }

  // hide or show the seconds hand layer
  //layer_set_hidden(s_canvas_second_hand, !(showSeconds && settings.EnableSecondsHand));

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

  //draw a thin circle in digits colour if hands shadow is off
  // if(!settings.ShadowOn){
  // graphics_context_set_stroke_color(ctx, settings.MinorTickColor); //settings.HourDigitsColor);
  // graphics_context_set_stroke_width(ctx, 1); // Same width as the hand
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius );

  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 4);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 8);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 12);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 16);
  // #if defined (PBL_PLATFORM_EMERY) || defined (PBL_PLATFORM_GABBRO)
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 20);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 24);
  // #endif

  // graphics_context_set_stroke_color(ctx, GColorBlack);

  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 2);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 6);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 10);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 14);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 18);
  // #if defined (PBL_PLATFORM_EMERY) || defined (PBL_PLATFORM_GABBRO)
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 22);
  // graphics_draw_circle(ctx, origin, config.seconds_circle_radius - 26);
  // #endif
  //}

  
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
  //graphics_fill_circle(ctx, origin_offset_centre_shadow, settings.MinuteCentreSize); //started as 4

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

 // graphics_context_set_fill_color(ctx, outer_color);
 // graphics_fill_circle(ctx, origin, settings.MinuteCentreSize); //started as 4
  
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


#ifdef PBL_PLATFORM_APLITE //DON'T use FCTX a second time on Aplite: also use on Diorite and Flint as fctx is less efficient
static void update_logo_date_battery_fctx_layer (Layer *layer, GContext *ctx) {
  
  GRect bounds = layer_get_unobstructed_bounds(s_date_battery_logo_layer);

  GRect TwelveRect = GRect(1,6,bounds.size.w, 28);
  GRect SixRect = GRect(1,bounds.size.h-28-11,bounds.size.w, 28);
  graphics_context_set_text_color(ctx, settings.BWHourDigitsColor);
  graphics_draw_text(ctx, "12", FontHour, TwelveRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  if(!settings.EnableDate){
    graphics_draw_text(ctx, "6", FontHour, SixRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
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

                // GRect battery_arc_bounds = config.battery_arc_bounds[0];
                
                //     graphics_context_set_fill_color(ctx, settings.UVArcColor);
                //     int32_t angle_start = DEG_TO_TRIGANGLE(30);
                //     int32_t angle_end = DEG_TO_TRIGANGLE(180);
                //     uint16_t inset_thickness = 8;
                //     graphics_fill_radial(ctx,battery_arc_bounds,GOvalScaleModeFitCircle,inset_thickness,angle_start,angle_end);

                //     graphics_context_set_fill_color(ctx, settings.UVMaxColor);// GColorBlack);
                //     //graphics_fill_rect(ctx, UVMaxRect, 0, GCornerNone);
                                    
                //     int32_t angle_start_max = DEG_TO_TRIGANGLE(30 + (150* (100-s_battery_level))/100);
                //     int32_t angle_end_max = DEG_TO_TRIGANGLE(180);
                //     uint16_t inset_thickness_max = 8;
                //     graphics_fill_radial(ctx,battery_arc_bounds,GOvalScaleModeFitCircle,inset_thickness_max,angle_start_max,angle_end_max);

   
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
            char weekday[5];
            fetchwday(s_weekday, sys_locale, weekday);

            char weekdaydraw[10];
            snprintf(weekdaydraw, sizeof(weekdaydraw), "%s", weekday);

            char daynow[5];
            snprintf(daynow, sizeof(daynow), "%d", current_date);

            char monthnow[5];
            fetchmonth(s_month, sys_locale, monthnow);

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
           
      #ifdef DEBUG
            //  graphics_draw_text(ctx, "24", FontDate, DateRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
            //  graphics_draw_text(ctx, "WED", FontDate, WeekdayRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      #else
                graphics_draw_text(ctx, datenow, FontDate, FullDateRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
      #endif
                   
  }

//////////draw logo 
  if (settings.EnableLogo) {

   
      //draw logo text
      GRect LogoRect = GRect(4, bounds.size.h/2 - 20 , bounds.size.w / 2, 40);

      char logodraw [20];
      snprintf(logodraw, sizeof(logodraw), "%s", settings.LogoText);

      graphics_context_set_text_color(ctx, settings.BWDateColor);
      graphics_draw_text(ctx, logodraw, FontLogo, LogoRect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  

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
        fctx_set_text_em_height(&fctx, FCTX_Font, config.font_size_digits* bounds.size.h/full_bounds.size.h);
        fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWHourDigitsColor, settings.HourDigitsColor));
        char digit_string[3];
        int32_t digit_angle = i * 30 ;
        int32_t digit_angle_trig = (TRIG_MAX_ANGLE * digit_angle) / 360;
        int32_t digit_rotation; // = digit_angle_trig; // if you want rotation to match position angle

        if(i < 4 || i > 9){
              digit_rotation = digit_angle_trig;//  TRIG_MAX_ANGLE / 2;
            }
            else{
              digit_rotation = digit_angle_trig + TRIG_MAX_ANGLE / 2;
            }

        fixed_t text_radius = INT_TO_FIXED((bounds.size.w/2 * bounds.size.h/full_bounds.size.h) - config.digit_inset);
        
        snprintf(digit_string, sizeof digit_string, "%d", i);
        FPoint center_digits = FPointI(bounds.size.w / 2 + 1, bounds.size.h / 2);
        FPoint p = clockToCartesian(center_digits, text_radius, digit_angle_trig);
       // FPoint p = clockToCartesian(center_digits, text_radius, digit_angle);
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
        fctx_set_text_em_height(&fctx, FCTX_Font, config.font_size_digits* bounds.size.h/full_bounds.size.h);
        fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWHourDigitsColor, settings.HourDigitsColor));
        char digit_string[3];
        int32_t digit_angle = i * 30 ;
        int32_t digit_angle_trig = (TRIG_MAX_ANGLE * digit_angle) / 360;
        int32_t digit_rotation; // = digit_angle_trig; // if you want rotation to match position angle

        if(i < 4 || i > 9){
              digit_rotation = digit_angle_trig;//  TRIG_MAX_ANGLE / 2;
            }
            else{
              digit_rotation = digit_angle_trig + TRIG_MAX_ANGLE / 2;
            }

        fixed_t text_radius = INT_TO_FIXED((bounds.size.w/2 * bounds.size.h/full_bounds.size.h) - config.digit_inset );
        
        snprintf(digit_string, sizeof digit_string, "%d", i);
        FPoint center_digits = FPointI(bounds.size.w / 2 + 1, bounds.size.h / 2);
        FPoint p = clockToCartesian(center_digits, text_radius, digit_angle_trig);
       // FPoint p = clockToCartesian(center_digits, text_radius, digit_angle);
        fctx_set_rotation(&fctx, digit_rotation);
        fctx_set_offset(&fctx, p);
        fctx_draw_string(&fctx, digit_string, FCTX_Font, GTextAlignmentCenter, FTextAnchorMiddle);
        fctx_end_fill(&fctx);
      
      }
     }
    }


  

  //draw battery value
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
    char weekday[5];
    fetchwday(s_weekday, sys_locale, weekday);

    char weekdaydraw[10];
    snprintf(weekdaydraw, sizeof(weekdaydraw), "%s", weekday);

    char monthnow[5];
    fetchmonth(s_month, sys_locale, monthnow);


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


    if (settings.EnableLogo && grect_equal(&full_bounds, &bounds)) {  //draw logo text
    

          #ifdef PBL_PLATFORM_EMERY
            #define LOGO_WRAP_AT 8
          #elif defined (PBL_PLATFORM_GABBRO)
            #define LOGO_WRAP_AT 18
          #else
            #define LOGO_WRAP_AT 12
          #endif

          fctx_set_fill_color(&fctx, PBL_IF_BW_ELSE(settings.BWDateColor, settings.DateColor));
          FPoint logo_pos;
          logo_pos.x = INT_TO_FIXED((bounds.size.w / 4 + config.LogoXOffset));
          logo_pos.y = INT_TO_FIXED(bounds.size.h / 2 - config.LogoYOffset2);
            int font_size_logo = config.font_size_logo;
            char logodraw[20];
            snprintf(logodraw, sizeof(logodraw), "%s", settings.LogoText);

            char *line2 = NULL;
            if (strlen(logodraw) > LOGO_WRAP_AT) {
                char *split = NULL;
                for (int i = LOGO_WRAP_AT; i >= 0; i--) {
                    if (logodraw[i] == ' ') { split = &logodraw[i]; break; }
                }
                if (split) { *split = '\0'; line2 = split + 1; }
            }
            if (line2) {
                fctx_begin_fill(&fctx);
                fctx_set_text_em_height(&fctx, FCTX_Font, font_size_logo);
                fctx_set_offset(&fctx, logo_pos);
                fctx_draw_string(&fctx, logodraw, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                fctx_end_fill(&fctx);
                logo_pos.y = INT_TO_FIXED(bounds.size.h / 2 - config.LogoYOffset2/2 + font_size_logo + 2);
                fctx_begin_fill(&fctx);
                fctx_set_text_em_height(&fctx, FCTX_Font, font_size_logo);
                fctx_set_offset(&fctx, logo_pos);
                fctx_draw_string(&fctx, line2, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                fctx_end_fill(&fctx);
            } else {
                fctx_begin_fill(&fctx);
                fctx_set_text_em_height(&fctx, FCTX_Font, font_size_logo);
                fctx_set_offset(&fctx, logo_pos);
                fctx_draw_string(&fctx, logodraw, FCTX_Font, GTextAlignmentCenter, FTextAnchorTop);
                fctx_end_fill(&fctx);
            }
     
    }

    fctx_deinit_context(&fctx);
      
}
#endif

// Update procedure for the seconds hand layer
static void layer_update_proc_seconds_hand(Layer *layer, GContext *ctx) {
    
    if(!settings.EnableSecondsHand){
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
  

  seconds = prv_tick_time->tm_sec;
  //for test & screenshots
  //int
  // seconds = 8;

  // if (!settings.EnableSecondsHand || !showSeconds) {
  //   seconds = 0;
  // }

  int seconds_angle = ((double)seconds / 60 * 360) - 90;

 // draw_seconds_month_background(ctx);
  draw_second_hand(ctx, seconds_angle, config.second_hand_a, config.second_hand_b,  PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor));
  draw_seconds_center(ctx,  PBL_IF_BW_ELSE(settings.BWBackgroundColor1, settings.BackgroundColor1), PBL_IF_BW_ELSE(settings.BWSecondsHandColor, settings.SecondsHandColor));
}

static void layer_update_proc_complication(Layer *layer, GContext *ctx) {

  
    if(!settings.EnableMonth && !settings.EnableSecondsHand && !settings.AlwaysShowSubDial){
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

    if(!settings.EnableMonth){
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

      int xPosition;
      int yPosition;
      int textboxwidth;
      int BTIconYOffset;

     
      #ifdef PBL_BW 
              xPosition = config.BottomXPosition + 2;
              yPosition = bounds.size.h - config.BTQTBottomYPosition;
              textboxwidth = config.ShadowAndMaskWidth/2;
              BTIconYOffset = config.BTIconYOffset;
      #elif defined (PBL_PLATFORM_BASALT)
              xPosition = config.BottomXPosition + 2;
              yPosition = bounds.size.h - config.BTQTBottomYPosition;
              textboxwidth = config.ShadowAndMaskWidth/2;
              BTIconYOffset = config.BTIconYOffset;
      #else
            if(quiet_time_is_active()){
              xPosition = config.BottomXPosition + 2;
              yPosition = bounds.size.h - config.BTQTBottomYPosition;
              textboxwidth = config.ShadowAndMaskWidth/2;
              BTIconYOffset = config.BTIconYOffset;
            }
            else{
              xPosition = config.BottomXPosition;
              yPosition = bounds.size.h - config.BTQTBottomYPosition;
              textboxwidth = config.ShadowAndMaskWidth;
              BTIconYOffset = config.BTIconYOffset;
            }
        #endif
     

  GRect BTIconRect =
    GRect(xPosition + config.xOffset + config.BTIconXOffset2, yPosition + config.yOffset + BTIconYOffset + config.BTIconYOffset2, textboxwidth, 20);


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


      int xPosition;
      int yPosition;
      int textboxwidth;
      int QTIconYOffset;


   
       
      #ifdef PBL_BW
        xPosition = config.BottomXPosition;
        yPosition = bounds.size.h - config.BTQTBottomYPosition;
        textboxwidth = config.ShadowAndMaskWidth;
        QTIconYOffset = 0 - config.QTIconYOffset;
      #elif defined (PBL_PLATFORM_BASALT)
        xPosition = config.BottomXPosition;
        yPosition = bounds.size.h - config.BTQTBottomYPosition;
        textboxwidth = config.ShadowAndMaskWidth;
        QTIconYOffset = 0 - config.QTIconYOffset;
      #else
       if(connection_service_peek_pebble_app_connection()){

        xPosition = config.BottomXPosition;
        yPosition = bounds.size.h - config.BTQTBottomYPosition -1;
        textboxwidth = config.ShadowAndMaskWidth;
        QTIconYOffset = 0 - config.QTIconYOffset;
       }
      else{
        xPosition = config.BottomXPosition + config.ShadowAndMaskWidth/2 - 2;
        yPosition = bounds.size.h - config.BTQTBottomYPosition -1 ;
        textboxwidth = config.ShadowAndMaskWidth/2;
        QTIconYOffset = 0 - config.QTIconYOffset;
      }
      #endif
     

  GRect QTIconRect =
    GRect(xPosition + config.xOffset + config.QTIconXOffset2, yPosition + config.yOffset + QTIconYOffset + config.QTIconYOffset2, textboxwidth, 20);

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

  time_t temp = time(NULL);
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

  // Subscribe to the connection service to get Bluetooth status updates.
  connection_service_subscribe((ConnectionHandlers){
    .pebble_app_connection_handler = bluetooth_vibe_icon
  });

   // Subscribe to the correct tick service based on settings
    if (settings.EnableSecondsHand) {
        if (settings.SecondsVisibleTime == 135) {
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
        } else {
        tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
        s_timeout_timer = app_timer_register(1000*settings.SecondsVisibleTime, timeout_handler,NULL);
        accel_tap_service_subscribe(accel_tap_handler);
        }
    }
    else {
    tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
    }
    showSeconds = settings.EnableSecondsHand;
   
  //create layers
  s_bg_layer = layer_create(bounds);
  s_dial_layer = layer_create(bounds);
  s_canvas_second_hand = layer_create(bounds);
  s_canvas_month_hand = layer_create(bounds);
  s_canvas_comp_bg = layer_create(bounds);
  s_canvas_qt_icon = layer_create(bounds);
     quiet_time_icon();
  s_canvas_bt_icon = layer_create(bounds);
    bool is_connected = connection_service_peek_pebble_app_connection();
  //  #ifdef BACKLIGHTON
  //  layer_set_hidden(s_canvas_bt_icon, !is_connected);
  //  #else
    layer_set_hidden(s_canvas_bt_icon, is_connected);
  //  #endif
  s_canvas_battery = layer_create(bounds);
  s_canvas_layer = layer_create(bounds);
  s_date_battery_logo_layer = layer_create(bounds);

  // Change the order here
  layer_add_child(window_layer, s_bg_layer); //backforound, circles, major tick shoadow &tickmask
  layer_add_child(window_layer, s_canvas_comp_bg);
  layer_add_child(window_layer, s_canvas_month_hand);  //month hand
  layer_add_child(window_layer, s_canvas_second_hand);  //second hand
  layer_add_child(window_layer, s_canvas_bt_icon);
  layer_add_child(window_layer, s_canvas_qt_icon);
  layer_add_child(window_layer, s_date_battery_logo_layer); //fctx version of text
  layer_add_child(window_layer, s_canvas_battery); //battery line
  layer_add_child(window_layer, s_canvas_layer);  //hour and minute hands
 
  bluetooth_vibe_icon(connection_service_peek_pebble_app_connection());

  layer_set_update_proc(s_bg_layer, bg_update_proc);
  layer_set_update_proc(s_canvas_bt_icon, layer_update_proc_bt);
  layer_set_update_proc(s_canvas_qt_icon, layer_update_proc_qt);
  layer_set_update_proc(s_date_battery_logo_layer, update_logo_date_battery_fctx_layer);
  layer_set_update_proc(s_canvas_battery, layer_update_proc_battery_line);
  layer_set_update_proc(s_canvas_layer, hour_min_hands_canvas_update_proc);
  layer_set_update_proc(s_canvas_comp_bg,layer_update_proc_complication);
  layer_set_update_proc(s_canvas_second_hand, layer_update_proc_seconds_hand);
  layer_set_update_proc(s_canvas_month_hand, layer_update_proc_month_hand);

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
  layer_destroy(s_canvas_comp_bg);
  layer_destroy(s_canvas_battery);
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
  if (s_timeout_timer) {
  app_timer_cancel(s_timeout_timer);
  s_timeout_timer = NULL;
  }
}

static void prv_init(void) {
  prv_load_settings();

  // Open AppMessage and set the message handler
  app_message_open(512, 512);
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