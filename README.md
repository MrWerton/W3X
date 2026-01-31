# W3X

Simple extension to control video playback speed with shortcuts:

- D: increase speed
- A: decrease speed
- S: toggle between 1.0x and the last non‑default speed

Limits:

- Minimum: 0.25x
- Maximum: 5.0x
- Step: 0.25x

## Install (Chrome / Chromium)

1. Open `chrome://extensions`.
2. Enable "Developer mode".
3. Click "Load unpacked" and select this folder.

## Notes

- Shortcuts do not work while focused on inputs/textarea or editable fields.
- The speed is global and shared across all tabs (including newly opened ones).
- A small label with the current speed appears in the top-left of each video.
- The extension badge shows the current speed.
