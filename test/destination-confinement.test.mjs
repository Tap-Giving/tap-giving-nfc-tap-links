// Destination confinement regression test for Tap.Giving NFC Tap Links.
//
// The extension's core security promise: the dashboard session cookie is
// only ever transmitted to https://go.tap.giving. This test statically
// scans the shipped extension source and fails if any URL literal, fetch
// target, or host permission points anywhere else, so a future change
// cannot quietly widen the destination set.
//
// Run: node --test test/destination-confinement.test.mjs
// Optional: EXT_ROOT=/path/to/tree node --test test/destination-confinement.test.mjs
// (EXT_ROOT scans another copy of the tree, e.g. a proposed change.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.EXT_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_ORIGIN = 'https://go.tap.giving';

const RUNTIME_FILES = ['manifest.json', 'popup.js', 'popup.html', 'popup.css', 'icon.svg'];

function read(name) {
  return readFileSync(join(ROOT, name), 'utf8');
}

// Every absolute URL literal in the runtime files. The SVG xmlns value is
// an XML namespace identifier, not a network address, so xmlns attributes
// are removed before scanning.
function findUrls() {
  const found = [];
  for (const name of RUNTIME_FILES) {
    const text = read(name).replace(/xmlns="[^"]*"/g, '');
    for (const m of text.matchAll(/https?:\/\/[^\s"'`<>)\]]+/g)) {
      found.push({ file: name, url: m[0] });
    }
    // Protocol-relative URLs would inherit the page scheme; none may exist.
    for (const m of text.matchAll(/(?:^|["'\s])\/\/[a-z0-9.-]+\//gi)) {
      found.push({ file: name, url: 'protocol-relative:' + m[0] });
    }
  }
  return found;
}

test('every URL literal in the extension points at go.tap.giving', () => {
  const urls = findUrls();
  assert.ok(urls.length > 0, 'scan found no URLs at all; the scanner is broken');
  for (const { file, url } of urls) {
    assert.ok(
      url === ALLOWED_ORIGIN || url.startsWith(ALLOWED_ORIGIN + '/'),
      `${file} contains a URL outside ${ALLOWED_ORIGIN}: ${url}`,
    );
  }
});

test('manifest host permissions are exactly the dashboard origin', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.deepEqual(manifest.host_permissions, ['https://go.tap.giving/*']);
  assert.deepEqual(manifest.permissions, ['activeTab', 'cookies']);
});

test('the single fetch call site targets the API base built from ORIGIN', () => {
  const js = read('popup.js');
  const fetches = js.match(/fetch\(/g) || [];
  assert.equal(fetches.length, 1, `expected exactly 1 fetch( call, found ${fetches.length}`);
  assert.ok(js.includes("var ORIGIN = 'https://go.tap.giving';"), 'ORIGIN literal changed');
  assert.ok(js.includes("var API = ORIGIN + '/dashboard/api/v1';"), 'API base changed');
  assert.ok(js.includes('fetch(API + path, init)'), 'fetch no longer targets API + path');
  // Every api() call passes a same-origin path, never a full URL.
  for (const m of js.matchAll(/\bapi\('([^']+)'/g)) {
    assert.ok(m[1].startsWith('/'), `api() called with a non-path argument: ${m[1]}`);
  }
  // Navigation targets opened in tabs are built from ORIGIN too.
  assert.ok(js.includes("var LOGIN_URL = ORIGIN + '/dashboard/login';"), 'LOGIN_URL changed');
});

test('no other network or exfiltration APIs are present', () => {
  const js = read('popup.js');
  const html = read('popup.html');
  for (const banned of ['XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource',
                        'chrome.storage', 'localStorage', 'sessionStorage', 'indexedDB']) {
    assert.ok(!js.includes(banned), `popup.js must not use ${banned}`);
    assert.ok(!html.includes(banned), `popup.html must not use ${banned}`);
  }
  // The popup document loads only its own packaged files.
  assert.ok(html.includes('<script src="popup.js"></script>'), 'popup.html script tag changed');
  assert.ok(!/<script[^>]+src="https?:/i.test(html), 'popup.html loads a remote script');
  assert.ok(!/<link[^>]+href="https?:/i.test(html), 'popup.html loads a remote stylesheet');
  assert.ok(!/<img[^>]+src="https?:/i.test(html), 'popup.html loads a remote image');
});

test('cookie reads are scoped to the dashboard origin', () => {
  const js = read('popup.js');
  assert.ok(js.includes('chrome.cookies.get({ url: ORIGIN, name: name }'),
    'chrome.cookies.get is no longer scoped to ORIGIN');
});
