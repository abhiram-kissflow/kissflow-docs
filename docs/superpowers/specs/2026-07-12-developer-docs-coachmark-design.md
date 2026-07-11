# Developer docs coachmark design

## Goal

Help first-time documentation visitors discover that the sidebar docs switcher also provides API Reference and SDK Guide destinations.

## Interaction

- On the first documentation-page visit in a browser session, show a small coachmark anchored to the switcher chevron in `PersistentDocsTabMenu`.
- Copy:

  > Looking for developer docs? Open this menu to switch to API Reference or SDK Guide.

- Include a `Got it` dismissal action.
- Persist only the current-session dismissal state in `sessionStorage`; a new browser session can show the hint again.
- Dismiss the coachmark when the visitor clicks `Got it`, opens the switcher, or selects a destination.

## Accessibility

- Make the helper trigger and dismissal control keyboard accessible.
- Provide clear accessible labels for the helper control and coachmark dismissal.
- Keep the message concise and adjacent to the control it explains.

## Tests

- Verify the session-storage helpers default to showing the coachmark, suppress it after dismissal, and do not read browser storage during server rendering.
