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
  setTimeout: setTimeout,
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
sandbox.clearTimeout = clearTimeout;
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

assert.strictEqual(sandbox.isCustomerOrderTerminal({ status: 'Cancelled' }), true);
assert.strictEqual(sandbox.isCustomerOrderTerminal({ status: 'Rejected' }), true);
assert.strictEqual(sandbox.isCustomerOrderTerminal({ status: 'PickedUp' }), true);
assert.strictEqual(sandbox.isCustomerOrderTerminal({ status: 'Settled' }), true);
assert.strictEqual(sandbox.isCustomerOrderTerminal({ status: 'Ready' }), false);
assert.strictEqual(sandbox.isCustomerOrderInProgress({ status: 'Ready' }), true);
assert.strictEqual(sandbox.isCustomerOrderInProgress({ status: 'Cancelled' }), false);

const uid = 'cust1';
const cache = {
  oldCancelled: { customerUid: uid, status: 'Cancelled', orderId: 'PB-1001', timestamp: 1 },
  liveReady: { customerUid: uid, status: 'Ready', orderId: 'PB-1002', timestamp: 2 },
  staffPhone: { customerUid: 'cashierX', status: 'Received', orderId: 'PB-1003', timestamp: 9, customerPhone: '0771234567' }
};
const blocking = sandbox.findBlockingCustomerOrder(cache, { uid: uid, phone: '0771234567' });
assert.ok(blocking, 'Ready order should block');
assert.strictEqual(blocking.key, 'liveReady');
assert.strictEqual(blocking.order.orderId, 'PB-1002');

const none = sandbox.findBlockingCustomerOrder({
  done: { customerUid: uid, status: 'Cancelled', orderId: 'PB-9', timestamp: 5 }
}, { uid: uid });
assert.strictEqual(none, null);

const copy = sandbox.activeOrderBlockCopy(blocking);
assert.ok(copy.en.indexOf('#PB-1002') !== -1);
assert.ok(copy.html.indexOf('order.html') !== -1);

const patch = sandbox.customerActiveCreatePatch('ordKey', {
  customerUid: uid,
  orderId: 'PB-1002',
  customerPhone: '0771234567',
  status: 'Received'
});
assert.ok(patch['orders/ordKey']);
assert.strictEqual(patch['customer_active/' + uid].orderKey, 'ordKey');
assert.strictEqual(patch['customer_active_phone/771234567'].orderKey, 'ordKey');

const clear = sandbox.customerActiveClearPatch('ordKey', { customerUid: uid, customerPhone: '0771234567' }, {
  uid: uid,
  phoneKey: '771234567',
  uidLock: { orderKey: 'ordKey' },
  phoneLock: { orderKey: 'ordKey' }
});
assert.strictEqual(clear['customer_active/' + uid], null);
assert.strictEqual(clear['customer_active_phone/771234567'], null);

const stale = sandbox.blockingOrderFromLock({ orderKey: 'oldCancelled', orderId: 'PB-1001' }, cache);
assert.strictEqual(stale, null);

console.log('active-order-limit unit tests passed');
