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
  Intl: Intl,
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
  hidden: true,
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

assert.strictEqual(sandbox.shouldShowCashierNewOrderOverlay({
  firstSnapshot: true, selfPlaced: false, isLive: true, needsAck: true
}), false, 'first snapshot must not overlay');
assert.strictEqual(sandbox.shouldShowCashierNewOrderOverlay({
  firstSnapshot: false, selfPlaced: true, isLive: true, needsAck: true
}), false, 'same-tab POS must not overlay');
assert.strictEqual(sandbox.shouldShowCashierNewOrderOverlay({
  firstSnapshot: false, selfPlaced: false, isLive: true, needsAck: false
}), false, 'already acked must not overlay');
assert.strictEqual(sandbox.shouldShowCashierNewOrderOverlay({
  firstSnapshot: false, selfPlaced: false, isLive: true, needsAck: true
}), true, 'new ack-needed order overlays after hydrate');

assert.strictEqual(sandbox.shouldShowRiderAssignOverlay('', 'mine', true), false, 'first snapshot skip rider overlay');
assert.strictEqual(sandbox.shouldShowRiderAssignOverlay('unclaimed', 'mine', false), true);
assert.strictEqual(sandbox.shouldShowRiderAssignOverlay('mine', 'mine', false), false);
assert.strictEqual(sandbox.shouldShowRiderAssignOverlay('taken', 'mine', false), true);
assert.strictEqual(sandbox.shouldShowRiderAssignOverlay('mine', 'unclaimed', false), false);

const cashier = fs.readFileSync(path.join(__dirname, '..', 'public', 'cashier.html'), 'utf8');
assert.ok(cashier.indexOf('id="cashierNewOrderOverlay"') !== -1);
assert.ok(cashier.indexOf('NEW ORDER ARRIVED') !== -1);
assert.ok(cashier.indexOf('ackCashierNewOrder') !== -1);
assert.ok(cashier.indexOf('acceptCashierNewOrder') !== -1);
assert.ok(cashier.indexOf('printCashierNewOrder') !== -1);
assert.ok(cashier.indexOf("updateOrderStatus(key, 'Preparing')") !== -1);
assert.ok(cashier.indexOf('cashierOrdersHydrated') !== -1);
assert.ok(cashier.indexOf('cashierSelfOrderKeys') !== -1);
assert.ok(cashier.indexOf('peoplesStaffHiddenNotify') !== -1);
assert.ok(cashier.indexOf('registerStaffServiceWorker') !== -1);
assert.ok(cashier.indexOf('cashier_new') !== -1);

const rider = fs.readFileSync(path.join(__dirname, '..', 'public', 'rider.html'), 'utf8');
assert.ok(rider.indexOf('id="riderAssignOverlay"') !== -1);
assert.ok(rider.indexOf('NEW DELIVERY ASSIGNED') !== -1);
assert.ok(rider.indexOf('rider-manifest.json') !== -1);
assert.ok(rider.indexOf('registerStaffServiceWorker') !== -1);
assert.ok(rider.indexOf('riderOverlayPickup') !== -1);
assert.ok(rider.indexOf('riderOverlayDelivered') !== -1);
assert.ok(rider.indexOf("updateJobStatus(key, 'PickedUp')") !== -1);
assert.ok(rider.indexOf('takeThisOrder(key)') !== -1);
assert.ok(!/updateJobStatus\([^)]*Settled/.test(rider), 'rider must not write Settled');
assert.ok(rider.indexOf('class="rider-tap') !== -1);
assert.ok(rider.indexOf('apple-mobile-web-app-capable') !== -1);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'rider-manifest.json'), 'utf8'));
assert.strictEqual(manifest.start_url, '/rider.html');
assert.strictEqual(manifest.display, 'standalone');

console.log('staff-alerts overlay + notify helper checks passed');
process.exit(0);
