# Kissflow favicon design

## Goal

Give the documentation site a recognizable Kissflow favicon in browser tabs and bookmarks.

## Design

- Add a standalone SVG favicon at `app/icon.svg`, using a compact Kissflow-red butterfly/K mark that remains legible at small sizes.
- Let Next.js App Router discover the conventional `app/icon.svg` asset automatically; no metadata or runtime component changes are needed.
- Include a solid white field and simple geometric paths to preserve contrast in both light and dark browser chrome.

## Verification

- Confirm the SVG is valid and uses the expected 32×32 view box.
- Run the existing type check to ensure the new conventional app asset does not affect route compilation.
