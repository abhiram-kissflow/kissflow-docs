# Time-aware theme design

## Goal

Use the visitor's local system clock to select the default site theme: dark from 18:00 (inclusive) until 06:00, and light otherwise. A visitor can explicitly select light, dark, or Auto; explicit choices persist and take priority over the schedule.

## Design

- Introduce one site-wide theme controller responsible for resolving and applying `light` or `dark` to the document root.
- Store the user choice as `light`, `dark`, or `auto` in local storage. Missing or invalid data resolves to Auto.
- In Auto mode, derive the resolved theme from the browser's local `Date` hour. The device's configured time zone is therefore used naturally.
- Schedule an update for the next 06:00 or 18:00 boundary. Also recalculate when the page becomes visible, so a sleeping device or backgrounded tab catches up immediately.
- An explicit light or dark choice cancels automatic updates. Selecting Auto restores the scheduled behavior immediately.
- Run a small bootstrap script before content paints, using the same resolution rules, to avoid a flash of the incorrect theme.

## User interface

- Add a theme control that exposes Light, Dark, and Auto.
- Auto is the initial state unless an explicit stored preference exists.
- The control communicates the selected preference, not merely the currently resolved theme.

## Error handling

- Treat unavailable local storage, malformed values, and browser API failures as Auto mode without preventing rendering.
- Use browser APIs defensively for server rendering and older browsers.

## Tests

- Verify 06:00 is light and 18:00 is dark, including the overnight boundary.
- Verify an explicit choice overrides the schedule.
- Verify returning to Auto restores the scheduled result.
- Verify the next transition timing is calculated correctly.
