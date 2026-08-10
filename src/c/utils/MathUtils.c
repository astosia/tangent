#include <pebble.h>

// Quick integer square root.
uint32_t isqrt(uint32_t n) {
  if (n == 0) {
    return 0;
  }
  uint32_t root = 0;
  uint32_t bit = 1 << 30;

  while (bit > n) {
    bit >>= 2;
  }

  while (bit != 0) {
    if (n >= root + bit) {
      n -= root + bit;
      root += 2 * bit;
    }
    root >>= 1;
    bit >>= 2;
  }
  return root;
}

// Distance between two points.
uint32_t two_point_distance(uint32_t x1, uint32_t y1, uint32_t x2, uint32_t y2) {
  return isqrt(((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2-y1)));
}

GPoint add_points(GPoint a, GPoint b) {
  return GPoint(a.x + b.x, a.y + b.y);
}

// Converts an angle and a distance to a cartesian point.
GPoint polar_to_point(int angle, int distance) {
  int x = distance * ((double)cos_lookup(DEG_TO_TRIGANGLE(angle)) / ((double)TRIG_MAX_ANGLE));
  int y = distance * ((double)sin_lookup(DEG_TO_TRIGANGLE(angle)) / ((double)TRIG_MAX_ANGLE));
  return GPoint(x, y);
}

GPoint polar_to_point_offset(GPoint offset, int angle, int distance) {
  return add_points(offset, polar_to_point(angle, distance));
}

double slope_from_two_points(GPoint a, GPoint b) {
  return (double)(b.y - a.y) / (double)(b.x - a.x);
}

// ---------------------------------------------------------------------------
// Geometry calcs for rectangular screens
// ---------------------------------------------------------------------------



GPoint angle_to_rect_edge(GPoint center, int angle_deg, GRect r) {
  int32_t angle = DEG_TO_TRIGANGLE(angle_deg);
  int32_t dx = cos_lookup(angle);
  int32_t dy = sin_lookup(angle);
  int32_t t = INT32_MAX;
  if (dx > 0) { int32_t v = ((r.origin.x + r.size.w - 1 - center.x) * TRIG_MAX_RATIO) / dx; if (v < t) t = v; }
  else if (dx < 0) { int32_t v = ((r.origin.x - center.x) * TRIG_MAX_RATIO) / dx; if (v < t) t = v; }
  if (dy > 0) { int32_t v = ((r.origin.y + r.size.h - 1 - center.y) * TRIG_MAX_RATIO) / dy; if (v < t) t = v; }
  else if (dy < 0) { int32_t v = ((r.origin.y - center.y) * TRIG_MAX_RATIO) / dy; if (v < t) t = v; }
  return GPoint(center.x + (dx * t / TRIG_MAX_RATIO),
                center.y + (dy * t / TRIG_MAX_RATIO));
}

GPoint angle_to_rounded_rect_edge(GPoint center, int angle_deg, int half_w, int half_h, int r) {
  int32_t angle = DEG_TO_TRIGANGLE(angle_deg);
  int32_t dx = cos_lookup(angle);
  int32_t dy = sin_lookup(angle);

  int32_t dx16 = (dx + 32) >> 6;
  int32_t dy16 = (dy + 32) >> 6;
  int32_t ratio = TRIG_MAX_RATIO >> 6;

  int32_t t = INT32_MAX;
  if (dx16 > 0) { int32_t v = ( half_w - 1) * ratio / dx16; if (v < t) t = v; }
  else if (dx16 < 0) { int32_t v = (-half_w    ) * ratio / dx16; if (v < t) t = v; }
  if (dy16 > 0) { int32_t v = ( half_h - 1) * ratio / dy16; if (v < t) t = v; }
  else if (dy16 < 0) { int32_t v = (-half_h    ) * ratio / dy16; if (v < t) t = v; }

  // px = dx16 * t / ratio, with rounding
  int32_t px = (dx16 * t + (ratio / 2)) / ratio;
  int32_t py = (dy16 * t + (ratio / 2)) / ratio;

  // Corner projection
  int32_t inner_w = half_w - r;
  int32_t inner_h = half_h - r;
  if ((px > inner_w || px < -inner_w) && (py > inner_h || py < -inner_h)) {
    int32_t cx = (px > 0) ? inner_w : -inner_w;
    int32_t cy = (py > 0) ? inner_h : -inner_h;
    int32_t ex = px - cx;
    int32_t ey = py - cy;

    // Scale ex/ey up by 16 for sub-pixel precision in isqrt, stays in 32-bit.
    int32_t ex16s = ex << 4;
    int32_t ey16s = ey << 4;
    uint32_t len16 = isqrt((uint32_t)(ex16s * ex16s + ey16s * ey16s));

    if (len16 > 0) {
      // ex * r * 16 / len16 = ex * r / len, with rounding
      px = cx + (ex * r * 16 + (int32_t)(len16 / 2)) / (int32_t)len16;
      py = cy + (ey * r * 16 + (int32_t)(len16 / 2)) / (int32_t)len16;
    }
  }

  return GPoint(center.x + px, center.y + py);
}

GPoint point_from_edge(GPoint origin, int angle_deg, GRect r, int inset) {
    GPoint edge = angle_to_rect_edge(origin, angle_deg, r);
    int32_t angle = DEG_TO_TRIGANGLE(angle_deg);
    return GPoint(edge.x - (int)((cos_lookup(angle) * inset) / TRIG_MAX_RATIO), 
                  edge.y - (int)((sin_lookup(angle) * inset) / TRIG_MAX_RATIO));
}
