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

assert.strictEqual(typeof sandbox.loadSavedDeliveryPlaces, 'function');
assert.strictEqual(typeof sandbox.upsertSavedDeliveryPlace, 'function');
assert.strictEqual(sandbox.loadSavedDeliveryPlaces().length, 0);

const home = sandbox.upsertSavedDeliveryPlace({
  id: 'home',
  label: 'Home',
  address: 'Horana Home',
  lat: 6.72,
  lng: 80.07
});
assert.strictEqual(home.length, 1);
assert.strictEqual(home[0].id, 'home');
assert.strictEqual(home[0].label, 'Home');

sandbox.upsertSavedDeliveryPlace({
  id: 'office',
  label: 'Office',
  address: 'Horana Office',
  lat: 6.719,
  lng: 80.068
});
let list = sandbox.loadSavedDeliveryPlaces();
assert.strictEqual(list[0].id, 'office', 'newest first');
assert.strictEqual(list[1].id, 'home');

sandbox.upsertSavedDeliveryPlace({
  id: 'home',
  label: 'Home 2',
  address: 'Moved',
  lat: 6.73,
  lng: 80.08
});
list = sandbox.loadSavedDeliveryPlaces();
assert.strictEqual(list.length, 2);
assert.strictEqual(list[0].id, 'home');
assert.strictEqual(list[0].label, 'Home 2');

for (let i = 0; i < 10; i++) {
  sandbox.upsertSavedDeliveryPlace({
    id: 'p' + i,
    label: 'P' + i,
    lat: 6.7 + i * 0.01,
    lng: 80.06
  });
}
list = sandbox.loadSavedDeliveryPlaces();
assert.strictEqual(list.length, 8, 'cap at 8');

sandbox.removeSavedDeliveryPlace(list[0].id);
assert.strictEqual(sandbox.loadSavedDeliveryPlaces().length, 7);

Object.keys(store).forEach(function (k) { delete store[k]; });
const seeded = sandbox.seedLastUsedDeliveryPlace({ lat: 6.719, lng: 80.068 }, 'Last street');
assert.strictEqual(seeded.length, 1);
assert.strictEqual(seeded[0].id, 'last_used');
assert.strictEqual(seeded[0].label, 'Last used');
const seededAgain = sandbox.seedLastUsedDeliveryPlace({ lat: 6.8, lng: 80.1 }, 'Other');
assert.strictEqual(seededAgain.length, 1, 'does not seed if book exists');
assert.strictEqual(seededAgain[0].id, 'last_used');

const shop = { lat: 6.7190174, lng: 80.0682103 };
const near = { lat: 6.7191, lng: 80.0683 };
const far = { lat: 6.74, lng: 80.09 };
assert.strictEqual(sandbox.deliveryPinsDiffer(shop, near, 250), false, 'nearby GPS is same drop-off');
assert.strictEqual(sandbox.deliveryPinsDiffer(shop, far, 250), true, 'far pin differs from GPS');
assert.ok(sandbox.haversineMeters(shop, far) > 250);

const missing = sandbox.normalizeSavedDeliveryPlace({ label: 'X' });
assert.strictEqual(missing, null);

console.log('delivery-places unit tests passed');
