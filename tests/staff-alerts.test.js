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

assert.strictEqual(sandbox.shouldAlertStartupRiderJob('mine', 'Dispatched'), true);
assert.strictEqual(sandbox.shouldAlertStartupRiderJob('mine', 'Arrived'), true);
assert.strictEqual(sandbox.shouldAlertStartupRiderJob('unclaimed', 'Dispatched'), false);
assert.strictEqual(sandbox.shouldAlertStartupRiderJob('taken', 'Dispatched'), false);
assert.strictEqual(sandbox.shouldAlertStartupRiderJob('mine', 'Ready'), false);

assert.strictEqual(sandbox.shouldAlertRiderStaffCancel({
  firstSnapshot: true, prevClaim: 'mine', nextClaim: 'mine', prevStatus: 'Dispatched', nextStatus: 'Cancelled'
}), false);
assert.strictEqual(sandbox.shouldAlertRiderStaffCancel({
  firstSnapshot: false, prevClaim: 'mine', nextClaim: 'mine', prevStatus: 'Dispatched', nextStatus: 'Cancelled'
}), true);
assert.strictEqual(sandbox.shouldAlertRiderStaffCancel({
  firstSnapshot: false, prevClaim: 'mine', nextClaim: 'unclaimed', prevStatus: 'Preparing', nextStatus: 'Cancelled'
}), true);
assert.strictEqual(sandbox.shouldAlertRiderStaffCancel({
  firstSnapshot: false, prevClaim: 'unclaimed', nextClaim: 'unclaimed', prevStatus: 'Received', nextStatus: 'Cancelled'
}), false);

assert.strictEqual(sandbox.canCommitCashierDispatch({ status: 'Ready' }, '077123456'), true);
assert.strictEqual(sandbox.canCommitCashierDispatch({ status: 'Ready', assignedRiderId: '077123456' }, '077123456'), true);
assert.strictEqual(sandbox.canCommitCashierDispatch({ status: 'Ready', assignedRiderId: '077999999' }, '077123456'), false);
assert.strictEqual(sandbox.canCommitCashierDispatch({ status: 'Preparing' }, '077123456'), false);

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
assert.ok(cashier.indexOf('cashier-manifest.json') !== -1);
assert.ok(cashier.indexOf('apple-mobile-web-app-capable') !== -1);
assert.ok(cashier.indexOf("addEventListener('load'") !== -1);
assert.ok(cashier.indexOf('assignedRiderId = wantId') !== -1);
assert.ok(cashier.indexOf('.transaction(function (current)') !== -1);
assert.ok(cashier.indexOf('canCommitCashierDispatch') !== -1);
assert.ok(cashier.indexOf('function pickApprovedRider') !== -1);

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
assert.ok(rider.indexOf('peoplesAskNotify') !== -1);
assert.ok(rider.indexOf('startStaffAlertLoop') !== -1);
assert.ok(rider.indexOf('rider_assign') !== -1);
assert.ok(rider.indexOf('claimApprovedRider().then') !== -1);
assert.ok(rider.indexOf('riderOrdersListenTries') !== -1);
assert.ok(rider.indexOf('justDispatched') !== -1);
assert.ok(rider.indexOf("navigator.vibrate([250, 80, 250, 80, 250, 80, 320])") !== -1);
assert.ok(rider.indexOf('shouldAlertStartupRiderJob') !== -1);
assert.ok(rider.indexOf('riderAssigned: null') !== -1);
assert.ok(rider.indexOf('id="riderCancelAlert"') !== -1);
assert.ok(rider.indexOf('showRiderCancelledAlert') !== -1);
assert.ok(rider.indexOf('shouldAlertRiderStaffCancel') !== -1);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'rider-manifest.json'), 'utf8'));
assert.strictEqual(manifest.start_url, '/rider.html');
assert.strictEqual(manifest.display, 'standalone');

const cashierManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'cashier-manifest.json'), 'utf8'));
assert.strictEqual(cashierManifest.name, 'Peoples Family Restaurant - Cashier Station');
assert.strictEqual(cashierManifest.short_name, 'PFR Cashier');
assert.strictEqual(cashierManifest.start_url, '/cashier.html');
assert.strictEqual(cashierManifest.display, 'standalone');
assert.strictEqual(cashierManifest.theme_color, '#7c3aed');
assert.strictEqual(cashierManifest.background_color, '#f8fafc');

const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
assert.ok(sw.indexOf("addEventListener('fetch'") !== -1);
assert.ok(sw.indexOf("openWindow('/rider.html')") !== -1);
assert.ok(sw.indexOf("indexOf('/rider.html')") !== -1);
assert.ok(sw.indexOf('riderClick') !== -1);

const cfg = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'firebase-config.js'), 'utf8');
assert.ok(cfg.indexOf('vibrate: [200, 100, 200, 100, 200]') !== -1);
assert.ok(cfg.indexOf('showNotification') !== -1);

console.log('staff-alerts overlay + notify helper checks passed');
process.exit(0);
