#pragma once
#include <pebble.h>

uint32_t two_point_distance(uint32_t x1, uint32_t y1, uint32_t x2, uint32_t y2);
uint32_t isqrt(uint32_t n);
GPoint polar_to_point(int angle, int distance);
GPoint add_points(GPoint a, GPoint b);
GPoint polar_to_point_offset(GPoint offset, int angle, int distance);
double slope_from_two_points(GPoint a, GPoint b);

GPoint angle_to_rect_edge(GPoint center, int angle_deg, GRect r);
GPoint angle_to_rounded_rect_edge(GPoint center, int angle_deg, int half_w, int half_h, int r);
GPoint point_from_edge(GPoint origin, int angle_deg, GRect r, int inset);