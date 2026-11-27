# Tap.Giving NFC Tap Disc Links: permissions note

Future Chrome Web Store listing title: **Tap.Giving NFC Tap Disc Links**

This extension is a companion to the Tap.Giving Redirect Dashboard
(go.tap.giving). Its one job: you are looking at a web page, you click
the extension, you pick one of your tap links, and that link's redirect
destination becomes the page's address, verified by a read-back before
the popup calls it done.

## What changed in the design (2026-11-14)

The original design paired the extension with a one-time pairing token
generated in the dashboard. Ryan replaced that design before anything
shipped: **there is no pairing token.** The extension authenticates
through the existing dashboard sign-in, exactly as users log in today,
and works off that session. The dashboard gained no new surface for
this extension; its login is unchanged.

Two ways to ride the existing session were considered:

- A dashboard-side "connect" hand-off (the dashboard mints a short-lived
  artifact after login and passes it to the extension). That artifact
  is a credential by another name: new server surface, new storage, new
  revocation story, and it drifts back toward the pairing token Ryan
  removed.
- The `cookies` permission scoped strictly to the dashboard origin
  (chosen). The extension reads the dashboard's own session cookie for
  go.tap.giving and presents it to the dashboard's own API, which has
  always accepted the session that way. No new credential exists.
  Nothing is stored by the extension. Signing out of the dashboard, or
  the session expiring, ends the extension's access with it.

One narrow server change rides along (openshortlink commit, F13): the
CSRF middleware no longer demands the double-submit token from requests
that carry a non-empty `Authorization: Bearer` credential. CSRF exists
to protect ambient cookie auth; a Bearer credential is explicit and
non-ambient (a cross-origin page cannot read one, and cannot attach
one without a CORS preflight this server grants only its own origin).
Cookie-only requests, the dashboard's normal mode, keep the full CSRF
check, and the test suite pins both halves.

## What the manifest declares, and why

```json
"permissions": ["activeTab", "cookies"],
"host_permissions": ["https://go.tap.giving/*"]
```

- **activeTab**: gives the extension the current tab's URL when, and
  only when, the user clicks the extension icon. That URL is the entire
  point of the tool ("point my tap link here"). It grants no access to
  page content, history, or any other tab, and it expires with the
  click.
- **cookies**: lets the extension read the Redirect Dashboard's
  session cookie so it can present your existing sign-in to the
  dashboard's API. Scoped by the host permission below to go.tap.giving
  only; it cannot read any other site's cookies. The extension never
  sees or handles your password.
- **host_permissions, `https://go.tap.giving/*` only**: every network
  call the extension makes goes to the Redirect Dashboard's API at
  go.tap.giving, the service this extension is a companion to. No other
  host is contacted, for any reason.

## What it deliberately does not declare

- **No `tabs` permission**: activeTab already exposes the invoked tab's
  URL; the broader permission would add review surface for nothing.
- **No `storage` permission**: the extension stores nothing at all. The
  popup is stateless; the sign-in lives in the browser's cookie jar
  under the dashboard's own session rules.
- **No analytics, no third-party calls, no other browser data.** The
  only browser data read is the current tab's URL, and the only data
  written anywhere is the destination of a link in your own dashboard,
  after you pick it and confirm.

## Web Store permission justifications (ready to paste)

- activeTab: "The extension's single purpose is to point a redirect
  link at the page the user is currently viewing. activeTab provides
  the current tab's URL only when the user clicks the extension, and
  only for that invocation."
- cookies: "The extension reuses the user's existing Tap.Giving
  Redirect Dashboard sign-in. It reads the dashboard's session cookie
  for go.tap.giving only and presents it to the dashboard's own API so
  the API knows whose links to list and update. It never sees the
  user's password, reads no other site's cookies, and stores nothing;
  signing out of the dashboard signs the extension out."
- host permission (go.tap.giving): "All requests go to the Tap.Giving
  Redirect Dashboard at go.tap.giving, the service this extension
  operates. No other host is contacted and no analytics or third-party
  traffic exists."
