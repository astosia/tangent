# fctx (vendored, changed for Tangent)

From [pebble-fctx](https://github.com/jrmobley/pebble-fctx) 1.6.5 by JR Mobley (MIT licence, see LICENSE),
copied here so its anti-aliased drawing could be changed:

- The anti-aliasing buffer no longer has to cover the whole screen (24-32KB on basalt and chalk,
  more than those watches usually have free). `fctx_init_context` takes as many rows as there's
  memory for (halving from the full height down to 8), and `band_y` / `band_h` / `measuring` in
  `FContext` let a fill be measured and then drawn band by band (`prv_fill_text` in nomos.c). With
  the full height it draws exactly as before.
- The buffer is always a plain 8-bit bitmap (it was the frame buffer's format, circular on
  chalk), so `fctx_end_fill_aa` gathers and clears flags left and right of a round screen's rows.
- Nothing is built for aplite, which doesn't use fctx.

The same changes as in Loupe (another watchface of the same author, built from Tangent).
