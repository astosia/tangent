#include <pebble.h>
#include "Weather.h"


static char* weather_conditions[] = {
  "\U0000F07B", // 'unknown': 0,
  "\U0000f00e", //thunderstorm with light rain: 1
  "\U0000f02c", //thunderstorm with light rain: 2
  "\U0000f010", //thunderstorm with rain: 3
  "\U0000f02d", //thunderstorm with rain: 4
  "\U0000f01e", //thunderstorm with heavy rain: 5
  "\U0000f01e", //thunderstorm with heavy rain: 6
  "\U0000f005", //light thunderstorm: 7
  "\U0000f025", //light thunderstorm: 8
  "\U0000f01e", //thunderstorm: 9
  "\U0000f01e", //thunderstorm: 10
  "\U0000f01e", //heavy thunderstorm: 11
  "\U0000f01e", //heavy thunderstorm: 12
  "\U0000f01e", //ragged thunderstorm: 13
  "\U0000f01e", //ragged thunderstorm: 14
  "\U0000f00e", //thunderstorm with light drizzle: 15
  "\U0000f02c", //thunderstorm with light drizzle: 16
  "\U0000f00e", //thunderstorm with drizzle: 17
  "\U0000f02c", //thunderstorm with drizzle: 18
  "\U0000f01d", //thunderstorm with heavy drizzle: 19
  "\U0000f01d", //thunderstorm with heavy drizzle: 20
  "\U0000f00b", //light intensity drizzle: 21
  "\U0000f02b", //light intensity drizzle: 22
  "\U0000f01c", //drizzle: 23
  "\U0000f01c", //drizzle: 24
  "\U0000f01a", //heavy intensity drizzle: 25
  "\U0000f01a", //heavy intensity drizzle: 26
  "\U0000f00b", //light intensity drizzle rain: 27
  "\U0000f02b", //light intensity drizzle rain: 28
  "\U0000f00b", //drizzle rain: 29
  "\U0000f029", //drizzle rain: 30
  "\U0000f019", //heavy intensity drizzle rain: 31
  "\U0000f019", //heavy intensity drizzle rain: 32
  "\U0000f01a", //shower rain and drizzle: 33
  "\U0000f01a", //shower rain and drizzle: 34
  "\U0000f01a", //heavy shower rain and drizzle: 35
  "\U0000f01a", //heavy shower rain and drizzle: 36
  "\U0000f00b", //shower drizzle: 37
  "\U0000f02b", //shower drizzle: 38
  "\U0000f01a", //light rain: 39
  "\U0000f01a", //light rain: 40
  "\U0000f019", //moderate rain: 41
  "\U0000f019", //moderate rain: 42
  "\U0000f019", //heavy intensity rain: 43
  "\U0000f019", //heavy intensity rain: 44
  "\U0000f019", //very heavy rain: 45
  "\U0000f019", //very heavy rain: 46
  "\U0000f018", //extreme rain: 47
  "\U0000f018", //extreme rain: 48
  "\U0000f017", //freezing rain: 49
  "\U0000f017", //freezing rain: 50
  "\U0000f01a", //light intensity shower rain: 51
  "\U0000f01a", //light intensity shower rain: 52
  "\U0000f01a", //shower rain: 53
  "\U0000f01a", //shower rain: 54
  "\U0000f01a", //heavy intensity shower rain: 55
  "\U0000f01a", //heavy intensity shower rain: 56
  "\U0000f018", //ragged shower rain: 57
  "\U0000f018", //ragged shower rain: 58
  "\U0000f00a", //light snow: 59
  "\U0000f02a", //light snow: 60
  "\U0000f01b", //Snow: 61
  "\U0000f01b", //Snow: 62
  "\U0000f076", //Heavy snow: 63
  "\U0000f076", //Heavy snow: 64
  "\U0000f017", //Sleet: 65
  "\U0000f017", //Sleet: 66
  "\U0000f0b2", //Light shower sleet: 67
  "\U0000f0b4", //Light shower sleet: 68
  "\U0000f0b5", //Shower sleet: 69
  "\U0000f0b5", //Shower sleet: 70
  "\U0000f006", //Light rain and snow: 71
  "\U0000f026", //Light rain and snow: 72
  "\U0000f017", //Rain and snow: 73
  "\U0000f017", //Rain and snow: 74
  "\U0000f00a", //Light shower snow: 75
  "\U0000f02a", //Light shower snow: 76
  "\U0000f00a", //Shower snow: 77
  "\U0000f02a", //Shower snow: 78
  "\U0000f076", //Heavy shower snow: 79
  "\U0000f076", //Heavy shower snow: 80
  "\U0000f003", //mist: 81
  "\U0000f04a", //mist: 82
  "\U0000f062", //Smoke: 83
  "\U0000f062", //Smoke: 84
  "\U0000f0b6", //Haze: 85
  "\U0000f023", //Haze: 86
  "\U0000f082", //sand/ dust whirls: 87
  "\U0000f082", //sand/ dust whirls: 88
  "\U0000f014", //fog: 89
  "\U0000f014", //fog: 90
  "\U0000f082", //sand: 91
  "\U0000f082", //sand: 92
  "\U0000f082", //dust: 93
  "\U0000f082", //dust: 94
  "\U0000f0c8", //volcanic ash: 95
  "\U0000f0c8", //volcanic ash: 96
  "\U0000f011", //squalls: 97
  "\U0000f011", //squalls: 98
  "\U0000f056", //tornado: 99
  "\U0000f056", //tornado: 100
  "\U0000f00d", //clear sky: 101
  "\U0000f02e", //clear sky: 102
  "\U0000f00c", //few clouds: 11-25%: 103
  "\U0000f081", //few clouds: 11-25%: 104
  "\U0000f002", //scattered clouds: 25-50%: 105
  "\U0000f086", //scattered clouds: 25-50%: 106
  "\U0000f041", //broken clouds: 51-84%: 107
  "\U0000f041", //broken clouds: 51-84%: 108
  "\U0000f013", //overcast clouds: 85-100%: 109
  "\U0000f013", //overcast clouds: 85-100%: 110
  "\U0000f056", //tornado: 111
  "\U0000f01d", //storm-showers: 112
  "\U0000f073", //hurricane: 113
  "\U0000f076", //snowflake-cold: 114
  "\U0000f072", //hot: 115
  "\U0000f050", //windy: 116
  "\U0000f015", //hail: 117
  "\U0000f050", //strong-wind: 118
};

static char* wind_direction[] = {
    "\U0000F044",//'North': 0,
    "\U0000F043", //'NNE': 1,
     "\U0000F043",//'NE': 2,
     "\U0000F043",//'ENE': 3,
     "\U0000F048",//'East': 4,
     "\U0000F087",//'ESE': 5,
     "\U0000F087",//'SE': 6,
     "\U0000F087",//'SSE': 7,
     "\U0000F058",//'South': 8,
     "\U0000F057",//'SSW': 9,
     "\U0000F057",//'SW': 10,
     "\U0000F057",//'WSW': 11,
     "\U0000F04D",//'West': 12,
     "\U0000F088",//'WNW': 13,
     "\U0000F088",//'NW': 14,
     "\U0000F088",//'NNW': 15,
     "\U0000F04B", //'Variable': 16
};

static char* rain_amount[] = {
    "\U0000F0F6",//  <1mm,
    "\U0000F0F7", // 1-2mm,
     "\U0000F0F8",//  2-3mm,
     "\U0000F0F9",// 3-4
     "\U0000F0FA",// 4-5
     "\U0000F0FB",// 5-6,
     "\U0000F0FC",// 6-7
     "\U0000F0FD",// 7-8
     "\U0000F0FE",// 8-9
     "\U0000F0FF",// 9-10
     "\U0000F100",// 10+
     "\U0000F084", //'unknown amount'
};

static char* moon_phase[] ={
  "\U0000F095",//'wi-moon-new':0,
  "\U0000F096",//'wi-moon-waxing-crescent-1',1,
  "\U0000F097",//'wi-moon-waxing-crescent-2',2,
  "\U0000F098",//'wi-moon-waxing-crescent-3',3,
  "\U0000F099",//'wi-moon-waxing-crescent-4',4,
  "\U0000F09A",//'wi-moon-waxing-crescent-5',5,
  "\U0000F09B",//'wi-moon-waxing-crescent-6',6,
  "\U0000F09C",//'wi-moon-first-quarter',7,
  "\U0000F09D",//'wi-moon-waxing-gibbous-1',8,
  "\U0000F09E",//'wi-moon-waxing-gibbous-2',9,
  "\U0000F09F",//'wi-moon-waxing-gibbous-3',10,
  "\U0000F0A0",//'wi-moon-waxing-gibbous-4',11,
  "\U0000F0A1",//'wi-moon-waxing-gibbous-5',12,
  "\U0000F0A2",//'wi-moon-waxing-gibbous-6',13,
  "\U0000F0A3",//'wi-moon-full',14,
  "\U0000F0A4",//'wi-moon-waning-gibbous-1',15,
  "\U0000F0A5",//'wi-moon-waning-gibbous-2',16,
  "\U0000F0A6",//'wi-moon-waning-gibbous-3',17,
  "\U0000F0A7",//'wi-moon-waning-gibbous-4',18,
  "\U0000F0A8",//'wi-moon-waning-gibbous-5',19,
  "\U0000F0A9",//'wi-moon-waning-gibbous-6',20,
  "\U0000F0AA",//'wi-moon-third-quarter',21,
  "\U0000F0AB",//'wi-moon-waning-crescent-1',22,
  "\U0000F0AC",//'wi-moon-waning-crescent-2',23,
  "\U0000F0AD",//'wi-moon-waning-crescent-3',24,
  "\U0000F0AE",//'wi-moon-waning-crescent-4',25,
  "\U0000F0AF",//'wi-moon-waning-crescent-5',26,
  "\U0000F0B0",//'wi-moon-waning-crescent-6',27,
  "\U0000F095",//'wi-moon-new',28,
};


const char* safe_weather_condition(int idx) {
  int max = (int)(sizeof(weather_conditions) / sizeof(weather_conditions[0]));
  if (idx < 0 || idx >= max) return weather_conditions[0]; // "unknown"
  return weather_conditions[idx];
}
const char* safe_wind_direction(int idx) {
  int max = (int)(sizeof(wind_direction) / sizeof(wind_direction[0]));
  if (idx < 0 || idx >= max) return wind_direction[16]; // "Variable"
  return wind_direction[idx];
}
const char* safe_moon_phase(int idx) {
  int max = (int)(sizeof(moon_phase) / sizeof(moon_phase[0]));
  if (idx < 0 || idx >= max) return moon_phase[0]; // new moon
  return moon_phase[idx];
}

const char* safe_rain_amount(int idx) {
  int max = (int)(sizeof(rain_amount) / sizeof(rain_amount[0]));
  if (idx < 0 || idx >= max) return rain_amount[16]; // "Variable"
  return rain_amount[idx];
}