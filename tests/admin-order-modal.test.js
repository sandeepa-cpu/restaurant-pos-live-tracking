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

const doorstep = {
  orderId: 'PB-1101',
  customerName: 'Nimal',
  customerPhone: '0771234567',
  status: 'Ready',
  type: 'Takeaway',
  deliveryOption: 'Deliver to doorstep',
  deliveryFee: 460,
  foodTotal: 1200,
  total: 1660,
  timestamp: Date.now(),
  items: [{ name: 'Fried Rice (Large)', qty: 2, price: 600, note: 'spicy' }],
  deliveryMeta: {
    mode: 'doorstep',
    address: 'Home Horana',
    landmark: 'Near temple',
    distanceKm: 4.7,
    coords: { lat: 6.74, lng: 80.09 },
    mapsUrl: 'https://www.google.com/maps?q=6.74,80.09',
    deliveryFee: 460
  },
  payment: { method: 'cash', status: 'unpaid' }
};
const pickup = {
  orderId: 'PB-1102',
  customerName: 'Saman',
  status: 'PickedUp',
  deliveryOption: 'Pick up myself',
  deliveryFee: 0,
  foodTotal: 500,
  total: 500,
  timestamp: Date.now(),
  items: [{ name: 'Tea', qty: 1, price: 500 }],
  deliveryMeta: { mode: 'self', deliveryFee: 0 },
  payment: { method: 'shop', status: 'paid' }
};
const table = {
  orderId: 'DN-5',
  tableId: 7,
  status: 'Settled',
  type: 'DineIn',
  foodTotal: 900,
  total: 900,
  timestamp: Date.now(),
  items: [{ name: 'Kottu', qty: 1, price: 900 }]
};

assert.strictEqual(sandbox.isDoorstepOrder(doorstep), true);
assert.strictEqual(sandbox.isDoorstepOrder(pickup), false);
assert.strictEqual(sandbox.isDineInOrder(table), true);
assert.ok(String(sandbox.orderDeliveryAddress(doorstep)).indexOf('Home') !== -1);
assert.strictEqual(sandbox.orderDistanceLabel(doorstep), '4.7 km');
assert.strictEqual(sandbox.cartFoodTotal(sandbox.orderItemRows(doorstep)), 1200);
assert.ok(sandbox.paymentLabel(doorstep).indexOf('Cash') !== -1);
assert.ok(sandbox.paymentLabel(pickup).indexOf('PAID') !== -1);

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
assert.ok(html.indexOf('id="adminOrderModal"') !== -1);
assert.ok(html.indexOf('View Details') !== -1);
assert.ok(html.indexOf('stopPropagation(); deleteOrder') !== -1);
assert.ok(html.indexOf('onclick="deleteAllOrders()"') !== -1);
assert.ok(html.indexOf('onclick="deleteAllCustomerHistory()"') !== -1);
assert.ok(/function deleteOrder\s*\(key\)/.test(html));
assert.ok(html.indexOf('db.ref(\'orders\').remove()') !== -1);

console.log('admin-order-modal helper + markup checks passed');
