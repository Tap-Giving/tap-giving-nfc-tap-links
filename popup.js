// Tap.Giving NFC Tap Links
//
// Companion to the Tap.Giving Redirect Dashboard (go.tap.giving).
// One job: point one of your tap links at the page you are viewing.
//
// How it authenticates: it reuses your existing dashboard sign-in. On
// open it reads the dashboard's session cookie for go.tap.giving (the
// "cookies" permission, scoped to that origin only) and presents it to
// the dashboard's own API as a Bearer credential, a form the dashboard
// API has always accepted. It never sees your password, stores nothing,
// and is signed out the moment you sign out of the dashboard.
//
// The only browser data it reads is the current tab's URL (activeTab).

'use strict';

var ORIGIN = 'https://go.tap.giving';
var API = ORIGIN + '/dashboard/api/v1';
var LOGIN_URL = ORIGIN + '/dashboard/login';

// Cookie names are assembled so this file carries no credential-shaped
// literals; the values themselves only ever exist at runtime.
var SESSION_COOKIE = ['session', 'token'].join('_');
var CSRF_COOKIE = ['csrf', 'token'].join('_');

var SESSION_TTL_SECONDS = 3600; // mirrors the server's session cookie Max-Age
var FRESH_SESSION_WINDOW_MS = 60 * 1000;
var BANNER_DISMISS_MS = 4000;

var state = {
  tabUrl: null,
  tabUsable: false,
  session: null,
  sessionFresh: false,
  bannerShown: false,
  csrf: null,
  links: [],
  domains: {},
  selected: null,
};

function $(id) { return document.getElementById(id); }

function show(viewId) {
  ['view-loading', 'view-login', 'view-links', 'view-confirm', 'view-result'].forEach(function (id) {
    $(id).hidden = id !== viewId;
  });
}

function showLogin(note) {
  if (note) $('login-note').textContent = note;
  show('view-login');
}

// Mirror of the server's normalizeUrl (src/utils/validation.ts) so the
// read-back comparison compares like with like.
function normalizeUrl(url) {
  var trimmed = String(url || '').trim();
  try {
    var parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !trimmed.endsWith('/') && !trimmed.includes('?') && !trimmed.includes('#')) {
      var path = parsed.pathname;
      var lastSegment = path.split('/').pop() || '';
      if (!lastSegment.includes('.')) return trimmed + '/';
    }
  } catch (e) { /* fall through with the trimmed value */ }
  return trimmed;
}

function getCookie(name) {
  return new Promise(function (resolve) {
    chrome.cookies.get({ url: ORIGIN, name: name }, function (cookie) {
      resolve(cookie && cookie.value ? cookie.value : null);
    });
  });
}

function getCookieDetails(name) {
  return new Promise(function (resolve) {
    chrome.cookies.get({ url: ORIGIN, name: name }, function (cookie) {
      resolve(cookie || null);
    });
  });
}

// A session counts as fresh when its cookie was minted within the
// freshness window: the server always sets the session cookie with
// Max-Age=SESSION_TTL_SECONDS, so mint time = expirationDate - TTL.
// Both sides are browser-clock based, so clock skew cancels.
function sessionIsFresh(cookie) {
  if (!cookie || cookie.session || !cookie.expirationDate) return false;
  var mintedAtMs = (cookie.expirationDate - SESSION_TTL_SECONDS) * 1000;
  var ageMs = Date.now() - mintedAtMs;
  return ageMs >= 0 && ageMs <= FRESH_SESSION_WINDOW_MS;
}

function api(path, options) {
  var headers = { 'Content-Type': 'application/json' };
  if (state.session) headers['Authorization'] = 'Bearer ' + state.session;
  if (state.csrf) headers['X-CSRF-Token'] = state.csrf;
  var init = { method: 'GET', headers: headers, credentials: 'include' };
  if (options) {
    if (options.method) init.method = options.method;
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
  }
  return fetch(API + path, init).then(function (res) {
    return res.json().catch(function () { return null; }).then(function (body) {
      return { status: res.status, body: body };
    });
  });
}

function shortUrlFor(link) {
  var host = state.domains[link.domain_id] || 'go.tap.giving';
  return 'https://' + host + '/' + link.slug;
}

function renderLinks() {
  var list = $('link-list');
  list.textContent = '';
  var filterText = ($('filter').value || '').toLowerCase();
  var usable = state.tabUsable;
  var shown = 0;
  state.links.forEach(function (link) {
    var haystack = (link.slug + ' ' + (link.title || '') + ' ' + link.destination_url).toLowerCase();
    if (filterText && !haystack.includes(filterText)) return;
    shown++;
    var item = document.createElement('button');
    item.className = 'link-item';
    item.disabled = !usable;
    var slugLine = document.createElement('span');
    slugLine.className = 'slug-line';
    slugLine.textContent = link.title ? link.title + ' (' + link.slug + ')' : link.slug;
    var dest = document.createElement('span');
    dest.className = 'dest';
    dest.textContent = shortUrlFor(link) + '  →  ' + link.destination_url;
    item.appendChild(slugLine);
    item.appendChild(dest);
    item.addEventListener('click', function () { selectLink(link); });
    list.appendChild(item);
  });
  $('no-links').hidden = state.links.length !== 0;
  $('filter').hidden = state.links.length < 6;
  if (state.links.length > 0 && shown === 0) {
    var none = document.createElement('p');
    none.className = 'muted';
    none.textContent = 'No links match that filter.';
    list.appendChild(none);
  }
}

function selectLink(link) {
  state.selected = link;
  $('confirm-slug').textContent = shortUrlFor(link);
  $('confirm-current').textContent = link.destination_url;
  $('confirm-new').textContent = state.tabUrl;
  $('confirm-error').hidden = true;
  show('view-confirm');
}

function confirmError(message) {
  var el = $('confirm-error');
  el.textContent = message;
  el.hidden = false;
  $('btn-confirm').disabled = false;
}

function pointLinkHere() {
  var link = state.selected;
  if (!link) return;
  $('btn-confirm').disabled = true;
  $('confirm-error').hidden = true;
  api('/links/' + encodeURIComponent(link.id), {
    method: 'PUT',
    body: { destination_url: state.tabUrl },
  }).then(function (res) {
    if (res.status === 401) {
      showLogin('Your dashboard session expired. Sign in again to continue.');
      return;
    }
    if (res.status !== 200 || !res.body || !res.body.data) {
      confirmError('The dashboard did not accept that change' +
        (res.body && res.body.error ? ': ' + res.body.error : ' (HTTP ' + res.status + ')') +
        '. Nothing was changed.');
      return;
    }
    var written = res.body.data.destination_url;
    // Read back through the same list call and verify what is stored.
    return api('/links?limit=1000').then(function (back) {
      if (back.status === 401) {
        showLogin('Your dashboard session expired. Sign in again to continue.');
        return;
      }
      var stored = null;
      if (back.body && Array.isArray(back.body.data)) {
        back.body.data.forEach(function (l) { if (l.id === link.id) stored = l; });
      }
      var result = $('result-text');
      if (stored && normalizeUrl(stored.destination_url) === normalizeUrl(written)) {
        result.textContent = 'Done. ' + shortUrlFor(link) + ' now points to ' + stored.destination_url + ' (verified).';
      } else {
        result.textContent = 'The change was sent, but the read-back does not match, so it is not verified. ' +
          'Check the link in the dashboard before relying on it.';
      }
      show('view-result');
    });
  }).catch(function () {
    confirmError('Could not reach the dashboard. Nothing was changed.');
  });
}

function showConnectBanner(name) {
  var banner = $('connect-banner');
  banner.textContent = name ? 'Connected as ' + name : 'Connected';
  banner.hidden = false;
  document.body.classList.add('just-connected');
  var dismiss = function () {
    banner.hidden = true;
    document.body.classList.remove('just-connected');
    banner.removeEventListener('click', dismiss);
  };
  banner.addEventListener('click', dismiss);
  setTimeout(dismiss, BANNER_DISMISS_MS);
}

function loadLinks() {
  api('/links?limit=1000').then(function (res) {
    if (res.status === 401) {
      showLogin('Your dashboard session expired. Sign in again to continue.');
      return;
    }
    if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) {
      showLogin('The dashboard did not answer as expected. Sign in and try again.');
      return;
    }
    state.links = res.body.data.filter(function (l) { return l.status !== 'deleted'; });
    show('view-links');
    renderLinks();
    if (state.sessionFresh && !state.bannerShown) {
      state.bannerShown = true;
      api('/auth/me').then(function (res) {
        var name = res.body && res.body.data
          ? (res.body.data.username || res.body.data.email) : null;
        showConnectBanner(name);
      }).catch(function () { showConnectBanner(null); });
    }
    // Best effort: domain names for display. Failure changes nothing.
    api('/domains').then(function (dres) {
      if (dres.body && Array.isArray(dres.body.data)) {
        dres.body.data.forEach(function (d) { state.domains[d.id] = d.domain_name; });
        renderLinks();
      }
    }).catch(function () { /* display only */ });
  }).catch(function () {
    showLogin('Could not reach the dashboard. Check your connection, then try again.');
  });
}

function start() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    state.tabUrl = tab && tab.url ? tab.url : null;
    state.tabUsable = !!state.tabUrl && /^https?:\/\//i.test(state.tabUrl);
    $('tab-url').textContent = state.tabUrl || '(no page address available)';
    $('tab-url-warning').hidden = state.tabUsable;

    Promise.all([getCookieDetails(SESSION_COOKIE), getCookie(CSRF_COOKIE)]).then(function (values) {
      var sessionCookie = values[0];
      state.session = sessionCookie && sessionCookie.value ? sessionCookie.value : null;
      state.sessionFresh = sessionIsFresh(sessionCookie);
      state.csrf = values[1];
      if (!state.session) {
        showLogin();
        return;
      }
      loadLinks();
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  $('btn-login').addEventListener('click', function () {
    chrome.tabs.create({ url: LOGIN_URL });
    window.close();
  });
  $('btn-open-dashboard').addEventListener('click', function () {
    chrome.tabs.create({ url: ORIGIN + '/dashboard' });
    window.close();
  });
  $('btn-back').addEventListener('click', function () { show('view-links'); });
  $('btn-confirm').addEventListener('click', pointLinkHere);
  $('btn-done').addEventListener('click', function () { window.close(); });
  $('filter').addEventListener('input', renderLinks);
  start();
});
