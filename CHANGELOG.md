# Changelog

All notable changes to OSH are listed here. Each version is published as a GitHub release.

## 0.1.1

- Fixed: skins whose `skin.ini` is saved as UTF-16 (common for skins edited in Notepad) lost all their settings on import, so combo colours, slider colours and font settings fell back to defaults and the exported `skin.ini` was broken. UTF-8 and UTF-16 (with or without BOM) are now detected; the file is always written as UTF-8.
- Preview: slider bodies have a soft centre highlight, and the slider tail circle is only drawn when the skin ships `sliderendcircle`.

## 0.1.0

First public release.

- Import skins from `.osk`, `.zip` or a folder, by file picker or drag and drop; start from a blank skin.
- Catalog of about 390 skinnable images and sounds for osu!, taiko, catch and mania, with missing elements highlighted per category.
- Image inspector: replace, download, delete, create missing 1x / `@2x` versions, animation frame support.
- Image adjustments: hue, saturation, brightness, contrast, opacity, colorize, resize, rotate, flip. Apply to one element or a whole category.
- Generators for missing elements: circle, ring, dot, glow, arrow, star, bar, text and blank, with presets for common elements.
- Sound inspector: play, replace, remove, silence.
- `skin.ini` editor with forms for General, Colours, Fonts, CatchTheBeat and Mania (all key counts) and a raw text mode. Unknown keys and comments are preserved.
- Live osu!standard gameplay preview using the skin's textures and settings.
- File manager with rename, add, delete and text editing.
- Undo for all file changes.
- Export as a new `.osk`.
