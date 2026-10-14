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

assert.strictEqual(sandbox.isUsableMapCoord(6.719, 80.068), true);
assert.strictEqual(sandbox.isUsableMapCoord(0, 0), false);
assert.strictEqual(sandbox.isUsableMapCoord(NaN, 80), false);
assert.strictEqual(sandbox.isUsableMapCoord(undefined, 80.06), false);
assert.strictEqual(sandbox.isUsableMapCoord(91, 80), false);
assert.ok(isNaN(sandbox.haversineKm(undefined, 80, 6.7, 80.06)));
assert.ok(isFinite(sandbox.haversineKm(6.719, 80.068, 6.72, 80.07)));

assert.strictEqual(sandbox.isLiveRiderLocFresh(Date.now(), Date.now()), true);
assert.strictEqual(sandbox.isLiveRiderLocFresh(Date.now() - 120000, Date.now()), false);
assert.strictEqual(sandbox.isLiveRiderLocFresh(0, Date.now()), false);
assert.strictEqual(sandbox.isLiveRiderLocFresh(null, Date.now()), false);

assert.strictEqual(sandbox.shouldRestartLiveLocationWatch({
  visible: true, hasKeys: true, denied: false
}), true);
assert.strictEqual(sandbox.shouldRestartLiveLocationWatch({
  visible: false, hasKeys: true, denied: false
}), false);
assert.strictEqual(sandbox.shouldRestartLiveLocationWatch({
  visible: true, hasKeys: true, denied: true
}), false);
assert.strictEqual(sandbox.shouldRestartLiveLocationWatch({
  visible: true, hasKeys: false, denied: false
}), false);

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

const rider = fs.readFileSync(path.join(__dirname, '..', 'public', 'rider.html'), 'utf8');
assert.ok(rider.indexOf('function restartLiveLocationWatch') !== -1);
assert.ok(rider.indexOf("addEventListener('pageshow'") !== -1);
assert.ok(rider.indexOf('liveLocDegraded') !== -1);
assert.ok(rider.indexOf('err.code === 2 || err.code === 3') !== -1);
assert.ok(rider.indexOf('liveLocKeys.forEach(clearLiveLocation)') !== -1);
assert.ok(rider.indexOf('liveLocLastSent = fix') !== -1);
assert.ok(rider.indexOf('.update(patch).then(function ()') !== -1);
assert.ok(rider.indexOf('isUsableMapCoord') !== -1);

const cashier = fs.readFileSync(path.join(__dirname, '..', 'public', 'cashier.html'), 'utf8');
assert.ok(cashier.indexOf('syncCashierRiderLocs') !== -1);
assert.ok(cashier.indexOf("db.ref('rider_locations/' + k)") !== -1);
assert.ok(cashier.indexOf('Waiting for rider GPS') !== -1);
assert.ok(cashier.indexOf('cashierRiderLiveHtml') !== -1);

const order = fs.readFileSync(path.join(__dirname, '..', 'public', 'order.html'), 'utf8');
assert.ok(order.indexOf('isUsableMapCoord') !== -1);
assert.ok(order.indexOf('isLiveRiderLocFresh') !== -1);
assert.ok(order.indexOf('!Number(c.lat)') === -1);

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
