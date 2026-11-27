# Chrome Web Store release assets: Tap.Giving NFC Tap Disc Links

Graphical assets and listing copy for the Chrome Web Store item, built from
the v1.0.3 package (manifest name "Tap.Giving NFC Tap Disc Links", version
1.0.3, commit 69981f7). Screenshots are real captures of the real extension
on the demo church account; tiles are composed from the production brand
assets (tap-giving repo, website/assets/Logo-Crop-Large-1024x295.png) and
the site's design tokens (navy #1F3A5F, secondary #395d83, gold #E2A33C,
Poppins headings, Inter body).

## Slot map

| File | Console slot | Dimensions | Format |
| --- | --- | --- | --- |
| store-icon-128.png | Store icon | 128x128 | PNG (the package's icons/icon128.png, unchanged) |
| screenshot-1-connected-links-1280x800.png | Screenshot 1 (hero): connected popup on the links view, "Connected as demochurch" | 1280x800 | 24-bit PNG, no alpha |
| screenshot-2-set-destination-confirm-1280x800.png | Screenshot 2: set-destination confirm state | 1280x800 | 24-bit PNG, no alpha |
| screenshot-3-signed-out-1280x800.png | Screenshot 3: signed-out popup | 1280x800 | 24-bit PNG, no alpha |
| screenshot-4-dashboard-login-1280x800.png | Screenshot 4: dashboard sign-in page | 1280x800 | 24-bit PNG, no alpha |
| promo-tile-440x280.png | Small promo tile | 440x280 | 24-bit PNG, no alpha |
| marquee-promo-tile-1400x560.png | Marquee promo tile | 1400x560 | 24-bit PNG, no alpha |
| description.md | Listing detailed description (copy of record) | n/a | Markdown text, paste as-is |

The console's global promo video slot takes a YouTube URL only; it is
intentionally left empty (no video produced).

A fifth screenshot (the post-confirm "verified" result view) is not in the
set: in the capture pattern used for these shots the popup can only see
go.tap.giving pages as the current page, and the dashboard API refuses
those reserved routes as destinations (HTTP 400, infinite-redirect-loop
guard), so the confirm step cannot complete on camera. The confirm state
itself is screenshot 2.
