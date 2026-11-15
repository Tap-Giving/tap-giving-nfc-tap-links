# Tap.Giving NFC Tap Links (Chrome extension)

A companion to the Tap.Giving Redirect Dashboard (go.tap.giving).
You are viewing a page; one click points one of your tap links at it.

## Load it in Chrome (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this directory (the repo root).
4. Pin "Tap.Giving NFC Tap Links" from the extensions menu if you like.

## Use it

1. Sign in to the Redirect Dashboard as usual
   (https://go.tap.giving/dashboard/login). The extension uses that
   sign-in; there is nothing else to set up and no token to paste.
2. Go to the page you want a tap link to open.
3. Click the extension. It shows the page's address and your links,
   each with the destination it currently points to.
4. Pick a link, confirm, and the extension sets its destination to the
   page's address, then reads it back and shows the verified result.

If you are not signed in, the popup offers a button that opens the
dashboard sign-in. Sign in, then click the extension again.

## Scope

- Reads exactly one piece of browser data: the current tab's URL
  (activeTab, only on your click).
- Reads the dashboard's session cookie for go.tap.giving only, to
  present your existing sign-in to the dashboard API. Never sees your
  password; stores nothing; no analytics.
- Writes exactly one thing: the destination of a link in your own
  dashboard, after you pick it and confirm.
- Permissions detail: see PERMISSIONS.md.

## Development notes

- API base: `https://go.tap.giving/dashboard/api/v1`
  (`GET /links?limit=1000`, `PUT /links/:id` with
  `{ "destination_url": "..." }`), the same endpoints the dashboard
  web UI uses, with the session presented as a Bearer credential.
- The server side of that contract is covered by
  `src/api/__tests__/extension-session-flow.test.ts` and
  `src/middleware/__tests__/csrf-bearer-exemption.test.ts` in this
  repository.
- Icons are rendered from `icon.svg` (brand navy #1F3A5F, NFC arcs).
