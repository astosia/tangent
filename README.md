
# tangent
pebble watchface inspired by the nomos tangente analogue watch 

APLITE (OG and Pebble Steel)


<img width="144" height="168" alt="aplite1 8" src="https://github.com/user-attachments/assets/7f0bc9d9-e868-4f4b-8afc-5d5875ea9e56" />



DIORITE & FLINT (Pebble 2 and Pebble 2 Duo)


<img width="144" height="168" alt="diorite_1 8" src="https://github.com/user-attachments/assets/8f91ad07-c570-45d9-ac0b-c4ff068cd1f1" />



BASALT (Pebble Time and Pebble Time Steel)


<img width="144" height="168" alt="basalt_1 8" src="https://github.com/user-attachments/assets/9f6aba07-8fe2-4894-b01e-a830119a4614" />



CHALK (Pebble Time Round)


<img width="180" height="180" alt="chalk_1 8" src="https://github.com/user-attachments/assets/6b0defd7-6cb5-47d4-a0e1-a926a5d004fd" />



EMERY (Pebble Time 2)


<img width="200" height="228" alt="emery1 8" src="https://github.com/user-attachments/assets/026088a5-badf-40f0-b6ce-9e8266b883ee" />


GABBRO (Pebble Round 2)


<img width="260" height="260" alt="gabbro_1 8" src="https://github.com/user-attachments/assets/39196a3a-6ccc-43d8-a337-4c4ed3705ce6" />

## Building

The text is drawn anti-aliased by fctx, kept in `src/c/fctx` (pebble-fctx 1.6.5, MIT licence) and changed so its anti-aliasing buffer can cover just a band of the screen when there isn't memory for all of it, as on basalt and chalk, where the full 24-32KB buffer often doesn't fit: each piece of text is then drawn band by band, with the same result. Before this, those watches fell back to drawing text without anti-aliasing (see `src/c/fctx/README.md`). The project depends on `pebble-utf8` (which fctx uses) rather than `pebble-fctx`, so run `npm install` before building.
