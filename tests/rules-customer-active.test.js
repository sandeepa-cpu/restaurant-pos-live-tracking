'use strict';

/**
 * Emulator rules tests. Run with:
 *   firebase emulators:exec --only database "node tests/rules-customer-active.test.js"
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function main() {
  let testing;
  try {
    testing = require('@firebase/rules-unit-testing');
  } catch (e) {
    console.log('SKIP rules tests: install @firebase/rules-unit-testing to run emulator checks');
    return;
  }

  const rules = fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8');
  const testEnv = await testing.initializeTestEnvironment({
    projectId: 'peoples-family-restaurant',
    database: { rules: rules }
  });

  const customerA = { uid: 'custA' };
  const customerB = { uid: 'custB' };
  const cashier = {
    uid: 'staff1',
    token: { email: 'cashier@peoples-family-restaurant.web.app' }
  };

  const baseOrder = {
    customerUid: 'custA',
    orderId: 'PB-2001',
    orderNo: 2001,
    type: 'Takeaway',
    total: 100,
    foodTotal: 100,
    deliveryFee: 0,
    status: 'Received',
    timestamp: Date.now()
  };

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set(null);
  });

  const dbA = testEnv.authenticatedContext(customerA.uid).database();
  await testing.assertSucceeds(dbA.ref().update({
    'orders/ord1': Object.assign({}, baseOrder, { customerUid: 'custA' }),
    'customer_active/custA': { orderKey: 'ord1', orderId: 'PB-2001', at: Date.now() }
  }));

  await testing.assertFails(dbA.ref().update({
    'orders/ord2': Object.assign({}, baseOrder, { customerUid: 'custA', orderId: 'PB-2002', orderNo: 2002 }),
    'customer_active/custA': { orderKey: 'ord2', orderId: 'PB-2002', at: Date.now() }
  }));

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref('orders/ord1/status').set('Cancelled');
  });

  await testing.assertSucceeds(dbA.ref().update({
    'orders/ord3': Object.assign({}, baseOrder, { customerUid: 'custA', orderId: 'PB-2003', orderNo: 2003 }),
    'customer_active/custA': { orderKey: 'ord3', orderId: 'PB-2003', at: Date.now() }
  }));

  const dbStaff = testEnv.authenticatedContext(cashier.uid, cashier.token).database();
  await testing.assertSucceeds(dbStaff.ref('orders/staff1').set({
    customerUid: cashier.uid,
    orderId: 'PB-3001',
    orderNo: 3001,
    type: 'Takeaway',
    total: 50,
    foodTotal: 50,
    deliveryFee: 0,
    status: 'Received',
    timestamp: Date.now()
  }));

  const dbB = testEnv.authenticatedContext(customerB.uid).database();
  await testing.assertFails(dbB.ref('customer_active/custA').set({
    orderKey: 'hack',
    orderId: 'x',
    at: Date.now()
  }));

  await testEnv.cleanup();
  console.log('rules-customer-active emulator tests passed');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
