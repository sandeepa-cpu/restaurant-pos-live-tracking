'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const store = {};
const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'firebase-config.js'), 'utf8');
const sandbox = {
  console: console,
  Date: Date,
  JSON: JSON,
  Math: Math,
  Number: Number,
  String: String,
  Object: Object,
  Array: Array,
  Promise: Promise,
  Error: Error,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isFinite: isFinite,
  isNaN: isNaN,
  Infinity: Infinity,
  NaN: NaN,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  }
};
sandbox.location = { pathname: '/', href: 'http://localhost/', hostname: 'localhost' };
sandbox.window = sandbox;
sandbox.addEventListener = function () {};
sandbox.document = {
  getElementById: function () { return null; },
  createElement: function () { return { classList: { add: function () {}, remove: function () {} }, setAttribute: function () {}, textContent: '', innerHTML: '' }; },
  body: { appendChild: function () {} },
  head: { appendChild: function () {} },
  documentElement: { appendChild: function () {} },
  addEventListener: function () {},
  querySelector: function () { return null; }
};
sandbox.navigator = { userAgent: 'node' };
sandbox.firebase = {
  apps: [1],
  initializeApp: function () {},
  auth: function () {
    return { currentUser: null, onAuthStateChanged: function () { return function () {}; } };
  },
  database: function () {
    return { ref: function () { return { once: function () { return Promise.resolve({ val: function () { return null; } }); } }; } };
  }
};
vm.runInNewContext(code, sandbox, { filename: 'firebase-config.js' });

const opts = sandbox.PEOPLES_GPS_OPTIONS;
assert.strictEqual(opts.enableHighAccuracy, true);
assert.strictEqual(opts.maximumAge, 0);
assert.strictEqual(opts.timeout, 10000);

const good = sandbox.peoplesGpsFixFromCoords({ latitude: 6.719, longitude: 80.068, accuracy: 20 });
assert.strictEqual(good.lat, 6.719);
assert.strictEqual(good.lng, 80.068);
assert.strictEqual(sandbox.peoplesGpsFixIsUsable(good), true);
assert.strictEqual(sandbox.peoplesGpsFixIsPrecise(good), true);

const coarse = sandbox.peoplesGpsFixFromCoords({ latitude: 6.9, longitude: 79.85, accuracy: 8000 });
assert.strictEqual(sandbox.peoplesGpsFixIsUsable(coarse), false);
assert.strictEqual(sandbox.peoplesGpsFixIsPrecise(coarse), false);

const mid = sandbox.peoplesGpsFixFromCoords({ latitude: 6.72, longitude: 80.07, accuracy: 200 });
assert.strictEqual(sandbox.peoplesGpsFixIsUsable(mid), true);
assert.strictEqual(sandbox.peoplesGpsFixIsPrecise(mid), false);

let unsupportedErr = null;
sandbox.peoplesGetDeviceGps(function () { throw new Error('should not succeed'); }, function (err) {
  unsupportedErr = err;
});
assert.ok(unsupportedErr);
assert.strictEqual(unsupportedErr.code, 'unsupported');

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function runAsyncGpsCases() {
  let capturedOpts = null;
  sandbox.navigator.geolocation = {
    watchPosition: function (ok, _err, o) {
      capturedOpts = o;
      ok({ coords: { latitude: 6.7190174, longitude: 80.0682103, accuracy: 18 } });
      return 7;
    },
    clearWatch: function () {},
    getCurrentPosition: function () {}
  };
  const precise = await new Promise(function (resolve, reject) {
    sandbox.peoplesGetDeviceGps(resolve, reject);
  });
  assert.strictEqual(precise.lat, 6.7190174);
  assert.strictEqual(precise.lng, 80.0682103);
  assert.strictEqual(capturedOpts.enableHighAccuracy, true);
  assert.strictEqual(capturedOpts.maximumAge, 0);
  assert.strictEqual(capturedOpts.timeout, 10000);

  sandbox.PEOPLES_GPS_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 40,
    maximumAge: 0
  };
  sandbox.navigator.geolocation = {
    watchPosition: function (ok) {
      ok({ coords: { latitude: 6.93, longitude: 79.84, accuracy: 12000 } });
      return 8;
    },
    clearWatch: function () {},
    getCurrentPosition: function () {}
  };
  const coarseErr = await new Promise(function (resolve) {
    sandbox.peoplesGetDeviceGps(function () { resolve({ code: 'ok' }); }, resolve);
  });
  assert.strictEqual(coarseErr.code, 'coarse');

  sandbox.navigator.geolocation = {
    watchPosition: function (_ok, err) {
      err({ code: 1 });
      return 9;
    },
    clearWatch: function () {},
    getCurrentPosition: function () {}
  };
  const denied = await new Promise(function (resolve) {
    sandbox.peoplesGetDeviceGps(function () { resolve({ code: 'ok' }); }, resolve);
  });
  assert.strictEqual(denied.code, 'denied');

  sandbox.navigator.geolocation = {
    getCurrentPosition: function (ok, _err, o) {
      capturedOpts = o;
      ok({ coords: { latitude: 6.74, longitude: 80.09, accuracy: 30 } });
    }
  };
  const fromGet = await new Promise(function (resolve, reject) {
    sandbox.peoplesGetDeviceGps(resolve, reject);
  });
  assert.strictEqual(fromGet.lat, 6.74);
  assert.strictEqual(fromGet.lng, 80.09);
  await wait(10);
}

const takeaway = fs.readFileSync(path.join(__dirname, '..', 'public', 'takeaway.html'), 'utf8');
const table = fs.readFileSync(path.join(__dirname, '..', 'public', 'table.html'), 'utf8');
[takeaway, table].forEach(function (html, i) {
  const name = i === 0 ? 'takeaway' : 'table';
  assert.ok(html.indexOf("src === 'gps'") !== -1 && html.indexOf('useCurrentLocation()') !== -1, name + ' GPS tab fetches GPS');
  assert.ok(html.indexOf('peoplesGetDeviceGps') !== -1, name + ' uses shared GPS helper');
  assert.ok(html.indexOf('gpsMyLocation') !== -1, name + ' fallback address key');
  assert.ok(html.indexOf('My Location (Current GPS Position)') !== -1, name + ' English fallback label');
  assert.ok(html.indexOf('pfrToast') !== -1, name + ' toasts GPS errors');
  assert.ok(html.indexOf('applyPickedLocation(lat, lng, true, true)') !== -1, name + ' forces GPS address');
  assert.ok(html.indexOf('lastDeliveryCoords = { lat: lat, lng: lng }') !== -1, name + ' sets coords before map');
  assert.ok(!/timeout:\s*15000/.test(html), name + ' no old 15s GPS timeout');
});

const ensureIdx = takeaway.indexOf('function ensureDeliveryMap');
const ensureSlice = takeaway.slice(ensureIdx, ensureIdx + 450);
assert.ok(ensureSlice.indexOf('deliveryMarker.setLatLng([lastDeliveryCoords') === -1, 'ensureDeliveryMap must not snap to last pin');

runAsyncGpsCases().then(function () {
  console.log('gps-location helper + markup checks passed');
  process.exit(0);
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
