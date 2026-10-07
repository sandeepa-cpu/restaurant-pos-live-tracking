'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

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
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
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

const pricing = { initCharge: 300, perKm: 80 };
const fee = sandbox.computeDoorstepDeliveryFee;

assert.strictEqual(typeof fee, 'function', 'computeDoorstepDeliveryFee should exist');
assert.strictEqual(sandbox.DELIVERY_BASE_KM, 3);

assert.strictEqual(fee(0, pricing), 300, '0 km keeps initCharge');
assert.strictEqual(fee(2.9, pricing), 300, '2.9 km is base');
assert.strictEqual(fee(3.0, pricing), 300, '3.0 km is still base');
assert.strictEqual(fee(3.01, pricing), 380, '3.01 km = 300 + 1 extra km');
assert.strictEqual(fee(5.2, pricing), 540, '5.2 km = 300 + ceil(2.2)*80');
assert.strictEqual(fee('5.2', pricing), 540, 'string 5.2 km uses Number()');
assert.strictEqual(fee(NaN, pricing), 300, 'NaN km treated as 0 / initCharge');
assert.strictEqual(fee(-1, pricing), 300, 'negative km treated as 0 / initCharge');

assert.strictEqual(fee(5.2, null), 540, 'missing pricing uses defaults 300 + 80');
assert.strictEqual(fee(5.2, {}), 540, 'empty pricing uses defaults');
assert.strictEqual(fee(3.5, { initCharge: 250, perKm: 100 }), 350, 'custom pricing 250 + ceil(0.5)*100');

console.log('delivery-fee unit tests passed');
