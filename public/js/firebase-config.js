window.PEOPLES_SHOP = {
  name: 'Horana shop',
  address: 'Horana, Sri Lanka',
  lat: 6.7190174,
  lng: 80.0682103
};

window.jsCallArg = function (value) {
  return JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
};

window.PFR_OTP_APP_KEY = 'pfr-horana-otp';
window.PFR_DEVICE_OTP_KEY = 'peoples_device_otp';
window.PFR_CUSTOMER_BASE_START = Date.parse('2026-09-22T00:00:00+05:30') || 0;

window.customerPhoneKey = function (phone) {
  return String(phone || '').replace(/\D/g, '').slice(-9);
};

var pfrLegacyPhoneCache = {};

window.isLegacyCustomerPhone = function (phone) {
  var key = window.customerPhoneKey(phone);
  if (!key) return Promise.resolve(false);
  if (Object.prototype.hasOwnProperty.call(pfrLegacyPhoneCache, key)) {
    return Promise.resolve(pfrLegacyPhoneCache[key]);
  }
  if (!(window.firebase && firebase.database)) return Promise.resolve(false);
  return firebase.database().ref('customer_ignore/' + key).once('value').then(function (snap) {
    var ignored = snap.val() === true;
    pfrLegacyPhoneCache[key] = ignored;
    return ignored;
  }).catch(function () {
    return false;
  });
};

window.rememberDeviceOtp = function (phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return;
  try {
    localStorage.setItem(window.PFR_DEVICE_OTP_KEY, JSON.stringify({
      phone: digits.slice(-9),
      at: Date.now()
    }));
  } catch (e) {}
};

window.deviceOtpRemembered = function (phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return false;
  try {
    var row = JSON.parse(localStorage.getItem(window.PFR_DEVICE_OTP_KEY) || 'null');
    return !!(row && row.phone === digits.slice(-9));
  } catch (e) {
    return false;
  }
};

window.callOtpScript = function (scriptUrl, params) {
  function queryString(extra) {
    var q = Object.assign({ key: window.PFR_OTP_APP_KEY }, params || {}, extra || {});
    return Object.keys(q).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(q[k] == null ? '' : String(q[k]));
    }).join('&');
  }

  function withUrl(url, extra) {
    url = String(url || '').trim();
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + queryString(extra);
  }

  function jsonpOnce(url) {
    return new Promise(function (resolve, reject) {
      if (!url) {
        reject(new Error('OTP backend URL නැහැ.'));
        return;
      }
      var cb = 'pfrOtp' + Date.now() + Math.floor(Math.random() * 1000);
      var done = false;
      var script;
      var timer = setTimeout(function () {
        finish(new Error('OTP timeout.'));
      }, 35000);
      function finish(err, data) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) {}
        if (script && script.parentNode) script.parentNode.removeChild(script);
        if (err) reject(err);
        else resolve(data);
      }
      window[cb] = function (data) {
        if (data && data.ok) finish(null, data);
        else finish(new Error((data && data.error) || 'OTP failed.'));
      };
      script = document.createElement('script');
      script.async = true;
      script.charset = 'utf-8';
      script.setAttribute('referrerpolicy', 'no-referrer');
      script.referrerPolicy = 'no-referrer';
      script.src = withUrl(url, { callback: cb });
      script.onerror = function () {
        finish(new Error('OTP backend open වුණේ නැහැ.'));
      };
      (document.body || document.documentElement).appendChild(script);
    });
  }

  function frameOnce(url) {
    return new Promise(function (resolve, reject) {
      if (!url) {
        reject(new Error('OTP backend URL නැහැ.'));
        return;
      }
      var token = 'pfr' + Date.now() + Math.floor(Math.random() * 1000);
      var iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;border:0;opacity:0;';
      var done = false;
      var timer = setTimeout(function () {
        finish(new Error('OTP timeout.'));
      }, 35000);
      function cleanup() {
        window.removeEventListener('message', onMsg);
        clearTimeout(timer);
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }
      function finish(err, data) {
        if (done) return;
        done = true;
        cleanup();
        if (err) reject(err);
        else resolve(data);
      }
      function onMsg(ev) {
        var origin = String((ev && ev.origin) || '');
        if (origin && origin.indexOf('google') < 0 && origin.indexOf('script.google') < 0) return;
        var d = ev && ev.data && ev.data.pfrOtp;
        if (!d || String(d.token || '') !== token) return;
        if (d.ok) finish(null, d);
        else finish(new Error(d.error || 'OTP failed.'));
      }
      window.addEventListener('message', onMsg);
      iframe.src = withUrl(url, { mode: 'frame', token: token });
      (document.body || document.documentElement).appendChild(iframe);
    });
  }

  var url = String(scriptUrl || '').trim();
  return jsonpOnce(url).catch(function (err) {
    var msg = String(err && err.message ? err.message : err);
    if (msg.indexOf('backend') < 0 && msg.indexOf('timeout') < 0) return Promise.reject(err);
    return new Promise(function (resolve) { setTimeout(resolve, 400); }).then(function () {
      return jsonpOnce(url);
    }).catch(function () {
      return frameOnce(url);
    });
  });
};

window.DISH_KIND_TAGS = [
  { id: 'veg', label: 'Veg' },
  { id: 'egg', label: 'Egg' },
  { id: 'chicken', label: 'Chicken' },
  { id: 'fish', label: 'Fish' },
  { id: 'prawn', label: 'Prawn' },
  { id: 'spicy', label: 'Spicy' }
];

window.escapeText = function (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.safeUrl = function (value) {
  var url = String(value == null ? '' : value).trim();
  if (!url) return '#';
  if (/^(https?:\/\/|blob:)/i.test(url)) return window.escapeText(url);
  if (/^data:(audio|image)\/[a-z0-9.+-]+;base64,/i.test(url)) return window.escapeText(url);
  if (/^\/\//.test(url) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return '#';
  return window.escapeText(url);
};

window.dishKindList = function (dish) {
  var raw = dish && dish.kinds;
  var allowed = {};
  window.DISH_KIND_TAGS.forEach(function (tag) { allowed[tag.id] = true; });
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (id) { return allowed[id]; });
};

window.dishIngredientsText = function (dish) {
  return String((dish && dish.ingredients) || '').trim();
};

window.dishContainsHtml = function (dish) {
  var kinds = window.dishKindList(dish);
  var ing = window.dishIngredientsText(dish);
  if (!kinds.length && !ing) return '';
  var chips = kinds.map(function (id) {
    var tag = null;
    window.DISH_KIND_TAGS.forEach(function (item) {
      if (item.id === id) tag = item;
    });
    var label = tag ? tag.label : id;
    return '<span class="inline-block text-[9px] font-black uppercase tracking-wide bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded-lg">' + window.escapeText(label) + '</span>';
  }).join('');
  var line = ing
    ? '<p class="text-[10px] text-slate-600 leading-snug mt-0.5">' + window.escapeText(ing) + '</p>'
    : '';
  return '<div class="mt-1 space-y-0.5">' + (chips ? '<div class="flex flex-wrap gap-1">' + chips + '</div>' : '') + line + '</div>';
};

window.normalizePayment = function (order) {
  var o = order || {};
  if (o.payment && o.payment.method) {
    return {
      method: o.payment.method,
      status: o.payment.status || 'unpaid',
      timing: o.payment.timing || 'after',
      slip: o.payment.slip || o.paymentSlip || null,
      verifiedBy: o.payment.verifiedBy || '',
      verifiedAt: o.payment.verifiedAt || 0
    };
  }
  if (o.status === 'PendingPayment') {
    return { method: 'bank', status: 'pending_verify', timing: 'before', slip: o.paymentSlip || null, verifiedBy: '', verifiedAt: 0 };
  }
  if (o.deliveryMeta && o.deliveryMeta.mode === 'doorstep') {
    var status = 'unpaid';
    if (o.status === 'Settled') status = 'paid';
    else if (o.cashCollected) status = 'collected';
    return { method: 'cash', status: status, timing: 'after', slip: o.paymentSlip || null, verifiedBy: '', verifiedAt: 0 };
  }
  return {
    method: 'shop',
    status: (o.status === 'PickedUp' || o.status === 'Settled') ? 'paid' : 'unpaid',
    timing: 'after',
    slip: o.paymentSlip || null,
    verifiedBy: '',
    verifiedAt: 0
  };
};

window.riderHoldsCash = function (order) {
  if (!order) return false;
  var p = window.normalizePayment(order);
  if (!(p.method === 'cash' || p.method === 'shop')) return false;
  if (p.status === 'paid' || p.status === 'rejected') return false;
  return !!(order.cashCollected || p.status === 'collected');
};

window.riderCashAmount = function (order) {
  if (!window.riderHoldsCash(order)) return 0;
  return Number(order && order.total) || 0;
};

window.paymentNeedsStaff = function (order) {
  var p = window.normalizePayment(order);
  var st = order && order.status;
  if (st === "PendingPayment") return true;
  if (p.method === "bank" && p.status !== "paid") return true;
  if (p.method === "payhere" && p.status !== "paid") return true;
  if ((p.method === "cash" || p.method === "shop") && (p.status === "unpaid" || p.status === "collected") && (st === "Dispatched" || st === "Arrived" || st === "PickedUp")) return true;
  return false;
};

window.paymentBlocksDispatch = function (order) {
  var p = window.normalizePayment(order);
  if (p.status === "paid") return false;
  return p.method === "bank" || p.method === "payhere";
};

window.paymentStaffPatch = function (order, status, by) {
  var p = window.normalizePayment(order);
  return {
    method: p.method,
    timing: p.timing,
    status: status,
    slip: p.slip || (order && order.paymentSlip) || null,
    verifiedBy: by || "",
    verifiedAt: Date.now()
  };
};

window.paymentLabel = function (order) {
  var p = window.normalizePayment(order);
  var method = "Pay at shop";
  if (p.method === "bank") method = p.timing === "before" ? "Bank slip (before delivery)" : "Bank after delivery";
  else if (p.method === "cash") method = "Cash on delivery";
  else if (p.method === "payhere") method = "PayHere online";
  var st = "UNPAID";
  if (p.status === "paid") st = "PAID";
  else if (p.status === "collected") st = "RIDER HAS CASH";
  else if (p.status === "pending_verify") st = "CHECK SLIP";
  else if (p.status === "rejected") st = "SLIP REJECTED";
  return method + " · " + st;
};

window.startPayHereCheckout = function (orderKey) {
  return fetch("/payhere/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderKey: orderKey })
  }).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "PayHere start failed");
      var form = document.createElement("form");
      form.method = "POST";
      form.action = data.sandbox ? "https://sandbox.payhere.lk/pay" : "https://www.payhere.lk/pay";
      var fields = data.fields || {};
      Object.keys(fields).forEach(function (k) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = fields[k] == null ? "" : String(fields[k]);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    });
  });
};

window.haversineKm = function (lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

window.orderDistanceKm = function (order) {
  var meta = (order && order.deliveryMeta) || {};
  var stored = parseFloat(meta.distanceKm);
  if (isFinite(stored) && stored > 0) return stored;
  var c = meta.coords || {};
  var shop = window.PEOPLES_SHOP || {};
  if (c.lat && c.lng && shop.lat && shop.lng) {
    return window.haversineKm(Number(shop.lat), Number(shop.lng), Number(c.lat), Number(c.lng));
  }
  return 0;
};

window.orderDistanceLabel = function (order) {
  var km = window.orderDistanceKm(order);
  if (!km) return '';
  return km.toFixed(1) + ' km';
};

window.isDineInOrder = function (order) {
  var t = order && order.type;
  return t === 'DineIn' || t === 'Dine-In';
};

window.peoplesDayKey = function () {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
};

window.nextDailyOrderId = function (db, fallbackKey) {
  var fallback = 'PB-' + String(fallbackKey || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  if (!db) return Promise.resolve(fallback);
  var day = window.peoplesDayKey();
  return db.ref('order_seq/' + day).transaction(function (cur) {
    return (Number(cur) || 0) + 1;
  }).then(function (res) {
    var n = res && res.snapshot ? Number(res.snapshot.val()) : 0;
    if (!n) return fallback;
    return 'PB-' + String(n).padStart(3, '0');
  }).catch(function () {
    return fallback;
  });
};

window.ORDER_NUMBER_BASE = 1000;

window.nextOrderNumber = function (db, fallbackKey, prefix) {
  prefix = prefix || 'PB-';
  function legacy() {
    return window.nextDailyOrderId(db, fallbackKey).then(function (id) {
      return { orderId: prefix === 'PB-' ? id : String(id).replace(/^PB-/, prefix), orderNo: null };
    });
  }
  if (!db) return legacy();
  var ref = db.ref('order_counter');
  return ref.once('value').then(function (snap) {
    if (!snap.exists()) return legacy();
    var seen = Number(snap.val()) || 0;
    return ref.transaction(function (cur) {
      // cur is null when the value is not cached locally; the server rejects a stale guess and re-runs.
      return (cur === null ? seen : (Number(cur) || 0)) + 1;
    }).then(function (res) {
      var n = res && res.committed && res.snapshot ? Number(res.snapshot.val()) : 0;
      if (!n) return legacy();
      return { orderId: prefix + n, orderNo: n };
    });
  }).catch(legacy);
};

window.orderTimeMs = function (order) {
  return Number((order && (order.timestamp || order.createdAt)) || 0);
};

window.orderIdPrefix = function (order) {
  return /^DN-/i.test(String((order && order.orderId) || '')) ? 'DN-' : 'PB-';
};

window.formatOrderDateTime = function (ms) {
  var t = Number(ms || 0);
  if (!t) return '—';
  try {
    var parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(new Date(t)).forEach(function (p) { parts[p.type] = p.value; });
    return parts.day + '/' + parts.month + '/' + parts.year + ' ' + parts.hour + ':' + parts.minute + ' ' + String(parts.dayPeriod || '').toUpperCase();
  } catch (e) {
    return new Date(t).toLocaleString();
  }
};

window.planOrderNumberMigration = function (orders, base) {
  base = Number(base) || window.ORDER_NUMBER_BASE;
  var keys = Object.keys(orders || {}).filter(function (k) {
    return orders[k] && typeof orders[k] === 'object';
  });
  keys.sort(function (a, b) {
    var ta = window.orderTimeMs(orders[a]) || Number.MAX_SAFE_INTEGER;
    var tb = window.orderTimeMs(orders[b]) || Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return a < b ? -1 : (a > b ? 1 : 0);
  });
  var patch = {};
  var rows = keys.map(function (k, i) {
    var o = orders[k];
    var n = base + i + 1;
    var newId = window.orderIdPrefix(o) + n;
    var oldId = String(o.orderId || '');
    patch['orders/' + k + '/orderId'] = newId;
    patch['orders/' + k + '/orderNo'] = n;
    if (!o.legacyOrderId && oldId) patch['orders/' + k + '/legacyOrderId'] = oldId;
    return { key: k, oldId: o.legacyOrderId || oldId, newId: newId, orderNo: n, ts: window.orderTimeMs(o), total: window.safeMoney(o.total) };
  });
  var counter = base + keys.length;
  patch.order_counter = counter;
  return { rows: rows, counter: counter, patch: patch };
};

window.alertDbError = function (err) {
  alert('Update failed. ' + ((err && (err.message || err.code)) || 'Try again'));
};

window.isPickupOrder = function (order) {
  if (window.isDoorstepOrder(order)) return false;
  var meta = (order && order.deliveryMeta) || {};
  if (meta.mode === 'pickme' || meta.mode === 'self') return true;
  var opt = String((order && order.deliveryOption) || '').toLowerCase();
  if (opt.indexOf('pickme') >= 0 || opt.indexOf('pick me') >= 0) return true;
  if (opt.indexOf('pick up myself') >= 0 || opt.indexOf('pickup') >= 0) return true;
  return !!(order && order.source === 'cashier');
};

window.isDoorstepOrder = function (order) {
  var meta = (order && order.deliveryMeta) || {};
  if (meta.mode === 'doorstep') return true;
  if (meta.mode === 'self' || meta.mode === 'pickme') return false;
  var opt = String((order && order.deliveryOption) || '').toLowerCase();
  if (opt.indexOf('doorstep') >= 0 || opt.indexOf('deliver') >= 0) return true;
  if (opt.indexOf('pickme') >= 0 || opt.indexOf('pick me') >= 0 || opt.indexOf('pick up') >= 0 || opt.indexOf('pickup') >= 0) return false;
  if (meta.coords && meta.coords.lat && meta.coords.lng) return true;
  if (Number(order && order.deliveryFee) > 0) return true;
  var t = String((order && order.type) || '').toLowerCase();
  if (t.indexOf('delivery') >= 0) return true;
  return false;
};

window.orderHasAssignedRider = function (order) {
  return !!(order && (order.assignedRiderId || order.assignedRiderName));
};

window.customerCanCancelOrder = function (order) {
  if (!order) return false;
  if (window.orderHasAssignedRider(order)) return false;
  switch (String(order.status || '')) {
    case 'PendingPayment':
    case 'Received':
    case 'WaiterRequested':
      return true;
    default:
      return false;
  }
};

window.orderTrackerFlags = function (order) {
  var st = (order && order.status) || '';
  var done = st === 'PickedUp' || st === 'Settled';
  var dispatched = st === 'Dispatched' || st === 'Arrived';
  var ready = st === 'Ready' || dispatched || done;
  var kitchen = st === 'Preparing' || ready;
  var cancelled = st === 'Cancelled' || st === 'Rejected';
  return {
    ordered: !!st && !cancelled,
    kitchen: kitchen && !cancelled,
    ready: ready && !cancelled,
    delivery: (dispatched || done) && !cancelled,
    delivered: done
  };
};

window.haversineKm = function (lat1, lng1, lat2, lng2) {
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLng = (lng2 - lng1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

window.formatAgo = function (ms) {
  var s = Math.max(0, Math.round((Date.now() - Number(ms || 0)) / 1000));
  if (s < 60) return s + 's ago';
  var m = Math.round(s / 60);
  if (m < 60) return m + ' min ago';
  return Math.round(m / 60) + ' h ago';
};

window.orderDeliveryAddress = function (order) {
  var meta = (order && order.deliveryMeta) || {};
  var house = String(meta.address || meta.recipientAddress || '').trim();
  var pin = String(meta.landmark || '').trim();
  if (meta.recipientType === 'Someone Else') {
    house = String(meta.recipientAddress || meta.address || '').trim();
  }
  if (house && pin && house !== pin && pin.indexOf(house) === -1 && house.indexOf(pin) === -1) {
    return house + ' · ' + pin;
  }
  return house || pin || '';
};

window.colomboDayKey = function (ts) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(ts || Date.now()));
  } catch (e) {
    return new Date(ts || Date.now()).toISOString().slice(0, 10);
  }
};

window.colomboMonthKey = function (ts) {
  return String(window.colomboDayKey(ts) || '').slice(0, 7);
};

window.salesLocationLabel = function (order) {
  if (window.isDineInOrder && window.isDineInOrder(order)) return 'Dine-in';
  if (window.isDoorstepOrder && window.isDoorstepOrder(order)) {
    var addr = String(window.orderDeliveryAddress(order) || '').replace(/\s+/g, ' ').trim();
    if (!addr) return 'Delivery (no address)';
    var cut = addr.split(',')[0].trim();
    if (cut.length > 42) cut = cut.slice(0, 42) + '…';
    return cut || 'Delivery';
  }
  return 'Pickup (shop)';
};

window.orderItemRows = function (order) {
  var items = order && order.items;
  if (Array.isArray(items)) return items.filter(Boolean);
  if (items && typeof items === 'object') {
    return Object.keys(items).sort(function (a, b) {
      var na = Number(a);
      var nb = Number(b);
      if (isFinite(na) && isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    }).map(function (k) { return items[k] || {}; });
  }
  return [];
};

window.safeMoney = function (n) {
  var x = Number(n);
  return isFinite(x) ? x : 0;
};

window.lineTotal = function (item) {
  return window.safeMoney(item && item.price) * Math.max(0, window.safeMoney(item && item.qty));
};

window.cartFoodTotal = function (items) {
  return (items || []).reduce(function (sum, item) {
    return sum + window.lineTotal(item);
  }, 0);
};

window.normalizeCartItem = function (name, price, qty, note) {
  var count = Math.max(1, Math.round(window.safeMoney(qty) || 1));
  return {
    name: String(name || ""),
    price: window.safeMoney(price),
    qty: count,
    note: String(note || "")
  };
};

window.DEFAULT_DELIVERY_PRICING = { initCharge: 300, perKm: 80 };

window.mergeDeliveryPricing = function (raw) {
  var defaults = window.DEFAULT_DELIVERY_PRICING;
  var src = raw && typeof raw === "object" ? raw : {};
  var init = window.safeMoney(src.initCharge);
  var per = window.safeMoney(src.perKm);
  return {
    initCharge: init > 0 ? init : defaults.initCharge,
    perKm: per > 0 ? per : defaults.perKm
  };
};

window.canCancelOrder = function (order) {
  var st = String((order && order.status) || "");
  switch (st) {
    case "Dispatched":
    case "Arrived":
    case "PickedUp":
    case "Delivered":
    case "Settled":
    case "Cancelled":
    case "Rejected":
      return false;
    default:
      return true;
  }
};

window.settleDineInBill = function (db, key, order, actor) {
  if (!db || !key || !order) return Promise.reject(new Error("Order missing"));
  var items = window.orderItemRows(order).map(function (item) {
    return window.normalizeCartItem(item.name, item.price, item.qty || 1, item.note);
  });
  var foodTotal = window.cartFoodTotal(items);
  var patch = {
    items: items,
    foodTotal: foodTotal,
    total: foodTotal,
    status: "Settled",
    settledAt: Date.now(),
    clearedAt: Date.now()
  };
  if (window.paymentStaffPatch && window.normalizePayment(order).status !== "paid") {
    patch.payment = window.paymentStaffPatch(order, "paid", actor || "cashier");
  }
  return db.ref("orders/" + key).update(patch);
};

window.isDbPermissionDenied = function (err) {
  var c = String((err && (err.code || err.message)) || "");
  return /PERMISSION_DENIED/i.test(c);
};

window.onDbListenError = function (err, opts) {
  opts = opts || {};
  console.warn("DB listen failed", err);
  if (opts.optional && window.isDbPermissionDenied(err)) return;
  var bar = document.getElementById("pfrListenError");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "pfrListenError";
    bar.className = "fixed bottom-20 inset-x-3 z-[90] bg-rose-600 text-white text-[11px] font-black py-2 px-3 rounded-xl shadow";
    document.body.appendChild(bar);
  }
  bar.textContent = "Data load වුණේ නැහැ. Connection එක බලලා refresh කරන්න. " + ((err && (err.code || err.message)) || "");
  bar.classList.remove("hidden");
};

window.clearDbListenError = function () {
  var bar = document.getElementById("pfrListenError");
  if (bar) bar.classList.add("hidden");
};

window.attachOfflineBanner = function () {
  if (document.getElementById("pfrOfflineBanner")) return;
  if (!(window.firebase && firebase.database)) {
    var tries = Number(window.attachOfflineBanner._tries || 0);
    if (tries >= 20) return;
    window.attachOfflineBanner._tries = tries + 1;
    setTimeout(window.attachOfflineBanner, 250);
    return;
  }
  window.attachOfflineBanner._tries = 0;
  var bar = document.createElement("div");
  bar.id = "pfrOfflineBanner";
  bar.className = "hidden fixed top-0 inset-x-0 z-[120] bg-amber-400 text-slate-900 text-center text-xs font-black py-2 px-3 shadow";
  bar.textContent = "Offline — Reconnecting... ⚠️";
  document.body.appendChild(bar);
  var seenOnline = false;
  var hideTimer = null;
  firebase.database().ref(".info/connected").on("value", function (snap) {
    var online = snap.val() === true;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (online) {
      seenOnline = true;
      bar.classList.add("hidden");
      if (typeof window.clearDbListenError === "function") window.clearDbListenError();
      return;
    }
    if (!seenOnline) return;
    hideTimer = setTimeout(function () {
      hideTimer = null;
      bar.classList.remove("hidden");
    }, 2500);
  }, function () {});
};

window.buildSalesInsight = function (orders, period) {
  var type = period && period.type === 'month' ? 'month' : 'day';
  var key = String((period && period.key) || (type === 'month' ? window.colomboMonthKey() : window.colomboDayKey()));
  var pickup = 0;
  var delivery = 0;
  var dinein = 0;
  var ordersCount = 0;
  var cancelled = 0;
  var completed = 0;
  var sales = 0;
  var deliverySale = 0;
  var deliveryCharge = 0;
  var grossSale = 0;
  var live = 0;
  var locMap = {};
  var itemMap = {};
  Object.keys(orders || {}).forEach(function (id) {
    var o = orders[id];
    if (!o) return;
    var ts = Number(o.timestamp || o.createdAt || 0);
    if (!ts) return;
    var day = window.colomboDayKey(ts);
    if (type === 'month') {
      if (day.slice(0, 7) !== key) return;
    } else if (day !== key) return;
    ordersCount += 1;
    var st = String(o.status || '');
    if (st === 'Cancelled' || st === 'Rejected') {
      cancelled += 1;
      return;
    }
    var fee = window.safeMoney(o.deliveryFee);
    if (!fee && o.deliveryMeta) fee = window.safeMoney(o.deliveryMeta.deliveryFee);
    var tot = window.safeMoney(o.total);
    if (!tot) tot = window.safeMoney(o.foodTotal) + fee;
    grossSale += tot;
    if (window.isDoorstepOrder && window.isDoorstepOrder(o)) {
      deliverySale += tot;
      deliveryCharge += fee;
    }
    if (st === 'PickedUp' || st === 'Settled') {
      completed += 1;
      var sale = tot;
      if (sale) sales += sale;
    } else {
      live += 1;
    }
    if (window.isDineInOrder && window.isDineInOrder(o)) dinein += 1;
    else if (window.isDoorstepOrder && window.isDoorstepOrder(o)) delivery += 1;
    else pickup += 1;
    var loc = window.salesLocationLabel(o);
    locMap[loc] = (locMap[loc] || 0) + 1;
    window.orderItemRows(o).forEach(function (item) {
      var name = String((item && item.name) || 'Item').trim() || 'Item';
      var qty = Number(item && item.qty);
      if (!qty || qty < 0) qty = 1;
      itemMap[name] = (itemMap[name] || 0) + qty;
    });
  });
  function ranked(map) {
    return Object.keys(map).map(function (name) {
      return { name: name, count: map[name] };
    }).sort(function (a, b) {
      return b.count - a.count || a.name.localeCompare(b.name);
    });
  }
  var locations = ranked(locMap);
  var items = ranked(itemMap);
  return {
    type: type,
    key: key,
    orders: ordersCount,
    cancelled: cancelled,
    completed: completed,
    live: live,
    sales: sales,
    deliverySale: deliverySale,
    deliveryCharge: deliveryCharge,
    netSale: grossSale - deliveryCharge,
    pickup: pickup,
    delivery: delivery,
    dinein: dinein,
    locations: locations.slice(0, 8),
    items: items.slice(0, 8),
    topLocation: locations[0] || null,
    topItem: items[0] || null
  };
};

window.buildSalesOrderRows = function (orders, period) {
  var type = period && period.type === 'month' ? 'month' : 'day';
  var key = String((period && period.key) || (type === 'month' ? window.colomboMonthKey() : window.colomboDayKey()));
  var rows = [];
  var completedTotal = 0;
  var completedCount = 0;
  var activeTotal = 0;
  Object.keys(orders || {}).forEach(function (id) {
    var o = orders[id];
    if (!o) return;
    var ts = window.orderTimeMs(o);
    if (!ts) return;
    var day = window.colomboDayKey(ts);
    if (type === 'month') {
      if (day.slice(0, 7) !== key) return;
    } else if (day !== key) return;
    var st = String(o.status || '');
    var cancelled = st === 'Cancelled' || st === 'Rejected';
    var completed = st === 'PickedUp' || st === 'Settled';
    var fee = window.safeMoney(o.deliveryFee);
    if (!fee && o.deliveryMeta) fee = window.safeMoney(o.deliveryMeta.deliveryFee);
    var amount = window.safeMoney(o.total);
    if (!amount) amount = window.safeMoney(o.foodTotal) + fee;
    var kind = window.isDineInOrder && window.isDineInOrder(o) ? 'Dine-in'
      : (window.isDoorstepOrder && window.isDoorstepOrder(o) ? 'Delivery' : 'Pickup');
    if (completed) {
      completedTotal += amount;
      completedCount += 1;
    }
    if (!cancelled) activeTotal += amount;
    rows.push({
      key: id,
      ts: ts,
      orderId: String(o.orderId || ''),
      orderNo: Number(o.orderNo) || 0,
      legacyOrderId: String(o.legacyOrderId || ''),
      kind: kind,
      status: st,
      amount: amount,
      cancelled: cancelled,
      completed: completed
    });
  });
  rows.sort(function (a, b) {
    return a.ts - b.ts || (a.orderNo - b.orderNo) || (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0));
  });
  return { rows: rows, completedTotal: completedTotal, completedCount: completedCount, activeTotal: activeTotal };
};

window.peoplesNotify = function (title, body, url) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var n = new Notification(title, {
      body: body || '',
      icon: '/LOGO%20NEW.jpg',
      badge: '/LOGO%20NEW.jpg',
      tag: url || 'peoples-order'
    });
    n.onclick = function () {
      try { window.focus(); } catch (e) {}
      if (url) location.href = url;
      n.close();
    };
  } catch (e) {}
};

window.peoplesNotifyOnce = function (orderKey, event, title, body, url) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  var flag = 'peoples_n_' + String(orderKey || '') + '_' + String(event || '');
  try {
    if (localStorage.getItem(flag) === '1') return false;
    localStorage.setItem(flag, '1');
  } catch (e) {}
  window.peoplesNotify(title, body, url);
  return true;
};

window.peoplesAskNotify = function () {
  if (!('Notification' in window)) return Promise.resolve('unsupported');
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
  return Notification.requestPermission().catch(function () { return 'denied'; });
};

window.peoplesNotifyCopy = function (order, event) {
  var id = (order && order.orderId) ? '#' + order.orderId : 'Order';
  if (event === 'Received') return { title: 'Order received ' + id, body: 'Shop එකට ඇණවුම ආවා. Tracker එකේ බලන්න.' };
  if (event === 'Preparing') return { title: 'Kitchen started ' + id, body: 'අපි දැන් හදනවා.' };
  if (event === 'Ready') return { title: 'Ready ' + id, body: 'Packet සූදානම්.' };
  if (event === 'Dispatched') return { title: 'On the way ' + id, body: 'Rider ගෙදරට යනවා.' };
  if (event === 'Arrived') return { title: 'Rider arrived ' + id, body: 'ගෙදර ළඟයි — doorstep එකට එන්න.' };
  if (event === 'PickedUp' || event === 'feedback') return { title: 'Delivered ' + id, body: 'Feedback එකක් දෙන්න. How was the food?' };
  if (event === 'Cancelled') return { title: 'Cancelled ' + id, body: 'ඇණවුම cancel වුණා.' };
  if (event === 'Rejected') return { title: 'Payment rejected ' + id, body: 'Slip / payment cashier reject කළා.' };
  return { title: id, body: 'Order update.' };
};

window.firebasePasswordFrom = window.firebasePasswordFrom || function (plain) {
  var text = String(plain || "");
  if (text.length >= 6) return text;
  return text + "000000".slice(text.length);
};

window.riderEmailForId = function (id) {
  return "rider_" + String(id || "") + "@peoples-family-restaurant.web.app";
};

window.ensureCustomerAuth = function (force) {
  if (!force && window._peoplesCustomerAuth) return window._peoplesCustomerAuth;
  window._peoplesCustomerAuth = new Promise(function (resolve) {
    if (!(window.firebase && firebase.auth)) {
      window._peoplesCustomerAuth = null;
      resolve(null);
      return;
    }
    var auth = firebase.auth();
    var done = false;
    var unsub = function () {};
    function finish(user) {
      if (done) return;
      done = true;
      try { unsub(); } catch (e) {}
      if (!user) window._peoplesCustomerAuth = null;
      resolve(user || null);
    }
    function tryAnonymous() {
      auth.signInAnonymously().then(function (cred) {
        finish(cred && cred.user);
      }).catch(function (err) {
        console.warn("Anonymous auth failed", err);
        window._peoplesCustomerAuth = null;
        finish(null);
      });
    }
    unsub = auth.onAuthStateChanged(function (user) {
      if (user) {
        finish(user);
        return;
      }
      tryAnonymous();
    });
    setTimeout(function () {
      if (done) return;
      if (auth.currentUser) {
        finish(auth.currentUser);
        return;
      }
      tryAnonymous();
    }, 8000);
  });
  return window._peoplesCustomerAuth;
};

window.getStoredOrderKeys = function () {
  try {
    var keys = JSON.parse(localStorage.getItem("peoples_my_order_keys") || "[]");
    return Array.isArray(keys) ? keys.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
};

window.rememberOrderKey = function (key) {
  if (!key) return;
  var keys = window.getStoredOrderKeys();
  if (keys.indexOf(key) === -1) keys.push(key);
  if (keys.length > 50) keys = keys.slice(-50);
  try { localStorage.setItem("peoples_my_order_keys", JSON.stringify(keys)); } catch (e) {}
  try { localStorage.setItem("peoples_last_order_key", key); } catch (e) {}
  try {
    var user = firebase.auth && firebase.auth().currentUser;
    if (user) firebase.database().ref("customer_orders/" + user.uid + "/" + key).set(true);
  } catch (e) {}
};

window.forgetOrderKey = function (key) {
  if (!key) return;
  var keys = window.getStoredOrderKeys().filter(function (k) { return k !== key; });
  try { localStorage.setItem("peoples_my_order_keys", JSON.stringify(keys)); } catch (e) {}
  try {
    if (localStorage.getItem("peoples_last_order_key") === key) {
      localStorage.removeItem("peoples_last_order_key");
    }
  } catch (e2) {}
};

window.chatRoleOf = function (msg) {
  var raw = String((msg && (msg.from || msg.sender)) || '').toLowerCase();
  if (raw === 'cashier') return 'cashier';
  if (raw === 'rider') return 'rider';
  return 'customer';
};

window.chatRoleLabel = function (msg) {
  var role = window.chatRoleOf(msg);
  if (role === 'cashier') return 'Cashier';
  if (role === 'rider') return String((msg && msg.name) || 'Rider');
  return String((msg && msg.name) || 'Customer');
};

window.chatPush = function (role, name, text, type) {
  var sender = 'Customer';
  if (role === 'cashier') sender = 'Cashier';
  else if (role === 'rider') sender = 'Rider';
  return {
    from: role,
    sender: sender,
    name: name || sender,
    text: type === 'audio' ? '' : text,
    message: text,
    type: type || 'text',
    timestamp: Date.now()
  };
};

window.chatEscape = function (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
};

window.chatBubbleHtml = function (msg, myRole) {
  var role = window.chatRoleOf(msg);
  var mine = role === myRole;
  var label = window.chatRoleLabel(msg);
  var text = (msg && (msg.text || msg.message)) || '';
  var isAudio = msg && msg.type === 'audio' && text;
  var tone = 'bg-white border text-slate-800';
  if (role === 'cashier') tone = mine ? 'bg-violet-700 text-white' : 'bg-violet-50 border border-violet-200 text-violet-950';
  else if (role === 'rider') tone = mine ? 'bg-slate-900 text-white' : 'bg-rose-50 border border-rose-200 text-rose-950';
  else if (mine) tone = 'bg-purple-900 text-white';
  var audioSrc = isAudio ? window.safeUrl(text) : '#';
  var body;
  if (isAudio) {
    body = audioSrc !== '#'
      ? '<audio controls class="w-48 h-8 mt-1"><source src="' + audioSrc + '"></audio>'
      : '<p class="mt-0.5">Audio unavailable</p>';
  } else {
    body = '<p class="mt-0.5">' + window.chatEscape(text) + '</p>';
  }
  return '<div class="flex flex-col ' + (mine ? 'items-end' : 'items-start') + '">' +
    '<div class="max-w-[80%] px-3 py-2 rounded-2xl text-[11px] font-bold ' + tone + '">' +
    '<span class="block text-[9px] font-black opacity-80">' + window.chatEscape(label) + '</span>' +
    body + '</div></div>';
};

var pfrChatAudioCtx = null;
var pfrChatLastPing = 0;
var pfrChatHeard = {};

function pfrChatAudio() {
  if (pfrChatAudioCtx) return pfrChatAudioCtx;
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { pfrChatAudioCtx = new Ctx(); } catch (e) { pfrChatAudioCtx = null; }
  return pfrChatAudioCtx;
}

if (typeof document !== 'undefined') {
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      var ctx = pfrChatAudio();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    }, { passive: true, capture: true });
  });
  var pfrBadgeStyle = document.createElement('style');
  pfrBadgeStyle.textContent = '.pfr-chat-badge{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 5px;border-radius:9999px;background:#e11d48;color:#fff;font-size:10px;font-weight:900;line-height:18px;text-align:center;box-shadow:0 0 0 2px #fff;pointer-events:none;z-index:5}';
  (document.head || document.documentElement).appendChild(pfrBadgeStyle);
  var pfrMenuStyle = document.createElement('style');
  pfrMenuStyle.textContent =
    '.pfr-menu-card{cursor:pointer;transition:border-color .15s,background-color .15s,box-shadow .15s}' +
    '.pfr-menu-card.is-selected{border-color:#7e22ce;background:#faf5ff;box-shadow:0 0 0 2px rgba(126,34,206,.22)}' +
    '@keyframes pfrCardAdded{0%{transform:scale(1)}35%{transform:scale(1.04);background:#dcfce7;border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.3)}100%{transform:scale(1)}}' +
    '.pfr-menu-card.is-added{animation:pfrCardAdded .5s ease-out}' +
    'button.pfr-add-done{background:#059669!important;color:#fff!important}' +
    '@media (prefers-reduced-motion:reduce){@keyframes pfrCardAdded{0%,100%{transform:none}35%{transform:none;background:#dcfce7;border-color:#16a34a}}}' +
    'button.pfr-busy{opacity:.65;cursor:not-allowed}' +
    '.mode-choice.is-locked{opacity:.55;cursor:not-allowed;background:#f8fafc;border-style:dashed}' +
    '.mode-choice.is-locked .pfr-lock-note{color:#b45309}' +
    '.pfr-toast{position:fixed;left:50%;bottom:96px;transform:translate(-50%,12px);max-width:min(92vw,420px);padding:12px 16px;border-radius:14px;background:#1e1b4b;color:#fff;font-size:12px;font-weight:800;line-height:1.45;text-align:center;white-space:pre-line;box-shadow:0 12px 28px -10px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:9999}' +
    '.pfr-toast.is-on{opacity:1;transform:translate(-50%,0)}' +
    'body.has-cart-bar .pfr-toast{bottom:128px}' +
    'body.has-cart-expanded .pfr-toast{bottom:13.5rem}' +
    '#categorySlider{scrollbar-width:none;scroll-padding-inline:36px}#categorySlider::-webkit-scrollbar{display:none}' +
    '.pfr-cat-fade{position:absolute;top:0;bottom:4px;width:44px;pointer-events:none;opacity:0;transition:opacity .2s;z-index:1}' +
    '.pfr-cat-fade.is-left{left:0;background:linear-gradient(to left,rgba(255,255,255,0),#fff 80%)}' +
    '.pfr-cat-fade.is-right{right:0;background:linear-gradient(to right,rgba(255,255,255,0),#fff 80%)}' +
    '.pfr-cat-arrow{position:absolute;top:50%;margin-top:-16px;width:28px;height:28px;border-radius:9999px;border:1px solid #e9d5ff;background:#fff;color:#581c87;font-size:15px;font-weight:900;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px -4px rgba(88,28,135,.45);opacity:0;pointer-events:none;transition:opacity .2s;z-index:2}' +
    '.pfr-cat-arrow.is-left{left:0}.pfr-cat-arrow.is-right{right:0}' +
    '.pfr-cat-fade.is-on,.pfr-cat-arrow.is-on{opacity:1}.pfr-cat-arrow.is-on{pointer-events:auto}' +
    '.pfr-next-cat{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding:13px 16px;border-radius:16px;background:linear-gradient(135deg,#581c87,#7e22ce);color:#fff;font-size:13px;font-weight:900;text-align:left;box-shadow:0 10px 22px -12px rgba(88,28,135,.8)}' +
    '.pfr-next-cat:active{transform:scale(.98)}.pfr-next-cat small{display:block;font-size:10px;font-weight:800;opacity:.75;text-transform:uppercase;letter-spacing:.06em}';
  (document.head || document.documentElement).appendChild(pfrMenuStyle);
}

var pfrSelectedMenuId = null;

function pfrMenuCards(id) {
  return Array.prototype.filter.call(document.querySelectorAll('.pfr-menu-card'), function (el) {
    return el.getAttribute('data-menu-id') === String(id);
  });
}

window.selectMenuCard = function (el) {
  if (!el) return;
  pfrSelectedMenuId = el.getAttribute('data-menu-id');
  document.querySelectorAll('.pfr-menu-card.is-selected').forEach(function (c) {
    if (c !== el) c.classList.remove('is-selected');
  });
  el.classList.add('is-selected');
};

window.restoreMenuSelection = function () {
  if (pfrSelectedMenuId === null) return;
  pfrMenuCards(pfrSelectedMenuId).forEach(function (c) { c.classList.add('is-selected'); });
};

window.flashMenuCard = function (id) {
  pfrMenuCards(id).forEach(function (card) {
    window.selectMenuCard(card);
    card.classList.remove('is-added');
    void card.offsetWidth;
    card.classList.add('is-added');
    card.addEventListener('animationend', function done() {
      card.classList.remove('is-added');
      card.removeEventListener('animationend', done);
    });
  });
};

window.cartQtyCount = function (items) {
  return (items || []).reduce(function (n, item) {
    return n + Math.max(0, window.safeMoney(item && item.qty));
  }, 0);
};

window.cartBarPreview = function (items, lastAddedName) {
  items = items || [];
  var lines = [];
  var i;
  for (i = 0; i < items.length; i++) {
    if (window.safeMoney(items[i] && items[i].qty) > 0) lines.push(items[i]);
  }
  var qty = window.cartQtyCount(lines);
  if (!qty) {
    return { text: "", name: "", lineQty: 0, more: 0, unique: 0, qty: 0 };
  }
  var want = String(lastAddedName || "").trim();
  var hit = null;
  if (want) {
    for (i = lines.length - 1; i >= 0; i--) {
      if (String(lines[i].name || "") === want) {
        hit = lines[i];
        break;
      }
    }
  }
  if (!hit) hit = lines[lines.length - 1];
  var name = String((hit && hit.name) || "Item").trim() || "Item";
  var lineQty = Math.round(window.safeMoney(hit && hit.qty));
  var unique = lines.length;
  var more = Math.max(0, unique - 1);
  var text = more
    ? name + " (" + lineQty + ") + " + more + " more"
    : name + " (" + lineQty + ")";
  return { text: text, name: name, lineQty: lineQty, more: more, unique: unique, qty: qty };
};

window.syncCheckoutBar = function (opts) {
  opts = opts || {};
  var bar = document.getElementById("cartBottomBar");
  var countEl = document.getElementById("cartCountLabel");
  var totalEl = document.getElementById("cartTotal");
  var lines = document.getElementById("cartItems");
  var qty = Math.round(window.safeMoney(opts.qty));
  var has = qty > 0;
  document.body.classList.toggle("has-cart-bar", has);
  document.body.classList.toggle("has-cart-expanded", has);
  if (countEl) {
    var label = (opts.previewText != null && String(opts.previewText) !== "")
      ? String(opts.previewText)
      : (opts.countText || (qty === 1 ? "1 item" : qty + " items"));
    countEl.textContent = label;
    if (label) countEl.setAttribute("title", label);
  }
  if (totalEl && opts.totalText != null) totalEl.textContent = opts.totalText;
  if (lines) {
    if (has) lines.classList.remove("hidden");
    else lines.classList.add("hidden");
  }
  if (!bar) return;
  var wasOn = bar.classList.contains("is-on");
  bar.classList.remove("hidden");
  bar.setAttribute("aria-hidden", has ? "false" : "true");
  bar.setAttribute("aria-expanded", has ? "true" : "false");
  if (!has) {
    bar.classList.remove("is-on");
    bar.classList.remove("is-pop");
    bar.classList.remove("is-expanded");
    return;
  }
  function slideOn() {
    if (wasOn) {
      bar.classList.add("is-on");
      return;
    }
    bar.classList.remove("is-on");
    void bar.offsetWidth;
    bar.classList.add("is-on");
  }
  function popBar() {
    if (bar._pfrPopDone) {
      bar.removeEventListener("animationend", bar._pfrPopDone);
      bar._pfrPopDone = null;
    }
    bar.classList.remove("is-pop");
    void bar.offsetWidth;
    bar.classList.add("is-pop");
    bar._pfrPopDone = function popDone(ev) {
      if (ev && ev.animationName && ev.animationName !== "pfrBarPop") return;
      bar.classList.remove("is-pop");
      bar.removeEventListener("animationend", popDone);
      if (bar._pfrPopDone === popDone) bar._pfrPopDone = null;
    };
    bar.addEventListener("animationend", bar._pfrPopDone);
  }
  bar.classList.add("is-expanded");
  slideOn();
  if (opts.justAdded && wasOn) popBar();
};

window.flashAddFeedback = function (id, name, qty, labels) {
  labels = labels || {};
  if (typeof window.flashMenuCard === "function") window.flashMenuCard(id);
  if (typeof window.playTapSound === "function") window.playTapSound();
  if (navigator.vibrate) {
    try { navigator.vibrate(12); } catch (e) {}
  }
  var n = Math.round(window.safeMoney(qty));
  var item = String(name || "Item");
  var toast = labels.toast || (item + " added" + (n ? " · " + n + (n === 1 ? " item" : " items") + " in cart" : ""));
  if (typeof window.pfrToast === "function") window.pfrToast(toast, 2200);
  pfrMenuCards(id).forEach(function (card) {
    var btn = card.querySelector("button");
    if (!btn || btn.dataset.busyAdd) return;
    var prev = btn.textContent;
    btn.dataset.busyAdd = "1";
    btn.textContent = labels.addedBtn || "Added ✓";
    btn.classList.add("pfr-add-done");
    setTimeout(function () {
      btn.textContent = prev;
      btn.classList.remove("pfr-add-done");
      delete btn.dataset.busyAdd;
    }, 900);
  });
};

window.lockButton = function (btn, label) {
  if (!btn || btn.disabled) return false;
  btn.dataset.idleLabel = btn.innerHTML;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.classList.add('pfr-busy');
  btn.textContent = label || 'Processing...';
  return true;
};

window.unlockButton = function (btn) {
  if (!btn || !btn.classList.contains('pfr-busy')) return;
  if (btn.dataset.idleLabel !== undefined) btn.innerHTML = btn.dataset.idleLabel;
  btn.disabled = false;
  btn.removeAttribute('aria-busy');
  btn.classList.remove('pfr-busy');
};

window.DELIVERY_OPEN_HOUR = 18;
window.DELIVERY_LOCK_NOTE = 'Available after 6:00 PM / සවස 6:00 න් පසු ලබා ගත හැක';
window.DELIVERY_LOCK_MSG = 'ඩිලිවරි පහසුකම සවස 6:00 න් පසු පමණක් සක්‍රීය වේ. කරුණාකර Pickup හෝ PickMe තෝරන්න.\nDelivery is available only after 6:00 PM.';

window.sriLankaHour = function (now) {
  var d = now || new Date();
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Colombo' }).format(d));
  } catch (e) {
    return d.getHours();
  }
};

window.deliveryUnlocked = function (now) {
  return window.sriLankaHour(now) >= window.DELIVERY_OPEN_HOUR;
};

window.updateCategoryArrows = function () {
  var slider = document.getElementById('categorySlider');
  if (!slider) return;
  var max = slider.scrollWidth - slider.clientWidth;
  var canLeft = slider.scrollLeft > 4;
  var canRight = slider.scrollLeft < max - 4;
  [['catPrevBtn', canLeft], ['catFadeLeft', canLeft], ['catNextBtn', canRight], ['catFadeRight', canRight]].forEach(function (p) {
    var el = document.getElementById(p[0]);
    if (el) el.classList.toggle('is-on', p[1]);
  });
};

window.scrollCategories = function (dir) {
  var slider = document.getElementById('categorySlider');
  if (!slider) return;
  slider.scrollBy({ left: dir * Math.max(120, slider.clientWidth * 0.7), behavior: 'smooth' });
};

window.centerActiveCategory = function (smooth) {
  var slider = document.getElementById('categorySlider');
  var active = slider && slider.querySelector('.cat-btn.is-active');
  if (!active) return window.updateCategoryArrows();
  var target = active.offsetLeft - (slider.clientWidth - active.offsetWidth) / 2;
  slider.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
  window.updateCategoryArrows();
};

window.scrollToMenuTop = function () {
  var list = document.getElementById('menuList');
  var bar = document.getElementById('categorySlider');
  var sticky = bar && bar.closest('.sticky');
  if (!list) return;
  var offset = sticky ? (parseFloat(getComputedStyle(sticky).top) || 0) + sticky.offsetHeight : 0;
  var y = list.getBoundingClientRect().top + window.pageYOffset - offset - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
};

if (typeof window !== 'undefined') {
  window.addEventListener('resize', function () { window.updateCategoryArrows(); });
}

var pfrToastTimer = null;
window.pfrToast = function (msg, ms) {
  var el = document.getElementById('pfrToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pfrToast';
    el.className = 'pfr-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(pfrToastTimer);
  pfrToastTimer = setTimeout(function () { el.classList.remove('is-on'); }, ms || 5200);
};

window.chatSoundMuted = false;

window.PFR_ALERT_VOL_KEY = "pfr_staff_alert_volume";
var pfrStaffAlertLoops = {};
var pfrStaffAlertPrimed = {};
var pfrStaffUnlocking = {};
var pfrAlertBusyUntil = 0;

window.getStaffAlertVolume = function () {
  try {
    var raw = localStorage.getItem(window.PFR_ALERT_VOL_KEY);
    if (raw == null || raw === "") return 1;
    var n = Number(raw);
    if (!isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
  } catch (e) {
    return 1;
  }
};

window.refreshStaffVolumeUi = function () {
  var n = Math.round(window.getStaffAlertVolume() * 100);
  document.querySelectorAll("[data-pfr-vol-pct]").forEach(function (node) {
    node.textContent = n + "%";
  });
  document.querySelectorAll("[data-pfr-vol-slider]").forEach(function (node) {
    if (document.activeElement !== node) node.value = String(n);
  });
};

window.setStaffAlertVolume = function (n) {
  n = Math.max(0, Math.min(1, Number(n)));
  if (!isFinite(n)) n = 1;
  try { localStorage.setItem(window.PFR_ALERT_VOL_KEY, String(n)); } catch (e) {}
  window.refreshStaffVolumeUi();
  return n;
};

window.isStaffAudioReady = function () {
  var ctx = pfrChatAudio();
  return !!ctx && ctx.state === "running";
};

window.unlockStaffAudio = function (cb) {
  var ctx = pfrChatAudio();
  if (!ctx) {
    if (cb) cb(false);
    return;
  }
  if (ctx.state === "suspended") {
    ctx.resume().then(function () { if (cb) cb(true); }).catch(function () { if (cb) cb(false); });
    return;
  }
  if (cb) cb(true);
};

window.playStaffAlertChime = function (force) {
  var ctx = pfrChatAudio();
  if (!ctx) return;
  if (force) pfrAlertBusyUntil = 0;
  function blast() {
    var vol = window.getStaffAlertVolume();
    if (vol <= 0.01 || ctx.state !== "running") return;
    var nowMs = Date.now();
    if (nowMs < pfrAlertBusyUntil) return;
    pfrAlertBusyUntil = nowMs + 1150;
    try {
      var t0 = ctx.currentTime;
      var master = ctx.createGain();
      var boost = ctx.createGain();
      var comp = ctx.createDynamicsCompressor();
      var tornDown = false;
      function teardown() {
        if (tornDown) return;
        tornDown = true;
        try { master.disconnect(); boost.disconnect(); comp.disconnect(); } catch (e) {}
      }
      master.gain.setValueAtTime(Math.max(0.0001, vol), t0);
      boost.gain.setValueAtTime(6.5, t0);
      comp.threshold.setValueAtTime(-30, t0);
      comp.knee.setValueAtTime(2, t0);
      comp.ratio.setValueAtTime(18, t0);
      comp.attack.setValueAtTime(0.001, t0);
      comp.release.setValueAtTime(0.12, t0);
      master.connect(boost);
      boost.connect(comp);
      comp.connect(ctx.destination);
      // Insistent two-tone alarm ring: bright high-low beeps, loud + attention-grabbing
      var notes = [1319, 988, 1319, 988, 1319, 988, 1568];
      var step = 0.15;
      var lastOsc = null;
      notes.forEach(function (freq, i) {
        var start = t0 + i * step;
        [0, 14].forEach(function (cents) {
          var osc = ctx.createOscillator();
          var g = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, start);
          if (cents) osc.detune.setValueAtTime(cents, start);
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(0.95, start + 0.01);
          g.gain.setValueAtTime(0.95, start + step * 0.62);
          g.gain.exponentialRampToValueAtTime(0.0001, start + step * 0.92);
          osc.connect(g);
          g.connect(master);
          osc.start(start);
          osc.stop(start + step);
          lastOsc = osc;
        });
      });
      if (lastOsc) lastOsc.onended = teardown;
      setTimeout(teardown, 1600);
    } catch (e) {}
    if (navigator.vibrate) {
      try { navigator.vibrate([250, 80, 250, 80, 250, 80, 320]); } catch (e2) {}
    }
  }
  if (ctx.state === "suspended") {
    ctx.resume().then(blast).catch(function () {});
    return;
  }
  blast();
};

window.startStaffAlertLoop = function (key, intervalMs) {
  key = key || "orders";
  intervalMs = Math.max(1500, Number(intervalMs) || 2000);
  if (!pfrStaffAlertLoops[key]) {
    pfrStaffAlertLoops[key] = setInterval(function () {
      window.playStaffAlertChime();
    }, intervalMs);
  }
  if (pfrStaffAlertPrimed[key] || pfrStaffUnlocking[key]) return;
  pfrStaffUnlocking[key] = true;
  window.unlockStaffAudio(function (ok) {
    pfrStaffUnlocking[key] = false;
    if (!ok || !pfrStaffAlertLoops[key] || pfrStaffAlertPrimed[key]) return;
    pfrStaffAlertPrimed[key] = true;
    window.playStaffAlertChime();
  });
};

window.stopStaffAlertLoop = function (key) {
  key = key || "orders";
  if (pfrStaffAlertLoops[key]) {
    clearInterval(pfrStaffAlertLoops[key]);
    delete pfrStaffAlertLoops[key];
  }
  delete pfrStaffAlertPrimed[key];
  delete pfrStaffUnlocking[key];
};

window.mountStaffVolumeControl = function (el, theme) {
  if (!el) return;
  var dark = theme === "dark";
  if (el.dataset.pfrVolMounted === "1") {
    var wrap = el.querySelector(".pfr-vol");
    if (wrap) {
      wrap.classList.toggle("is-dark", dark);
      wrap.classList.toggle("is-light", !dark);
    }
    window.refreshStaffVolumeUi();
    return;
  }
  el.dataset.pfrVolMounted = "1";
  var pct = Math.round(window.getStaffAlertVolume() * 100);
  el.innerHTML =
    '<div class="pfr-vol ' + (dark ? "is-dark" : "is-light") + '">' +
      '<div class="pfr-vol-row">' +
        '<span class="pfr-vol-title">🔔 Order alert volume</span>' +
        '<span class="pfr-vol-pct" data-pfr-vol-pct>' + pct + '%</span>' +
      '</div>' +
      '<input type="range" min="0" max="100" step="1" value="' + pct + '" data-pfr-vol-slider class="pfr-vol-slider" aria-label="Order alert volume">' +
      '<div class="pfr-vol-row">' +
        '<span class="pfr-vol-hint">Saved on this device. 100% is max kitchen volume.</span>' +
        '<button type="button" data-pfr-vol-test class="pfr-vol-test">Test</button>' +
      '</div>' +
    '</div>';
  var slider = el.querySelector("[data-pfr-vol-slider]");
  var testBtn = el.querySelector("[data-pfr-vol-test]");
  if (slider) {
    slider.addEventListener("input", function () {
      window.setStaffAlertVolume(Number(slider.value) / 100);
    });
  }
  if (testBtn) {
    testBtn.addEventListener("click", function () {
      window.unlockStaffAudio(function () { window.playStaffAlertChime(true); });
    });
  }
};

if (typeof document !== "undefined") {
  var pfrVolStyle = document.createElement("style");
  pfrVolStyle.textContent =
    ".pfr-vol{border-radius:18px;padding:12px 14px}" +
    ".pfr-vol.is-light{background:#fff;border:1px solid #e2e8f0;color:#0f172a}" +
    ".pfr-vol.is-dark{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#f8fafc}" +
    ".pfr-vol-row{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    ".pfr-vol-title{font-size:12px;font-weight:900}" +
    ".pfr-vol-pct{font-size:12px;font-weight:900;color:#d97706}" +
    ".pfr-vol.is-dark .pfr-vol-pct{color:#fbbf24}" +
    ".pfr-vol-hint{font-size:10px;font-weight:700;opacity:.7;line-height:1.35}" +
    ".pfr-vol-slider{width:100%;margin:10px 0 8px;accent-color:#7c3aed}" +
    ".pfr-vol-test{flex-shrink:0;border-radius:10px;padding:6px 10px;font-size:10px;font-weight:900;background:#7c3aed;color:#fff}" +
    ".pfr-vol.is-dark .pfr-vol-test{background:#fbbf24;color:#3b0764}" +
    "body.has-cart-bar #pfrListenError{bottom:6.5rem}" +
    "body.has-cart-expanded #pfrListenError{bottom:13rem}" +
    ".pfr-checkout-bar.is-pop{will-change:transform}";
  (document.head || document.documentElement).appendChild(pfrVolStyle);
}

window.playTapSound = function () {
  var ctx = pfrChatAudio();
  if (!ctx) return;
  function ping() {
    if (ctx.state !== "running") return;
    try {
      var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(740, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    } catch (e) {}
    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (e2) {}
    }
  }
  if (ctx.state === "suspended") {
    ctx.resume().then(ping).catch(function () {});
    return;
  }
  ping();
};

window.showExperienceFeedbackModal = function (info, onDone) {
  info = info || {};
  var doneOnce = false;
  function finish() {
    if (doneOnce) return;
    doneOnce = true;
    try {
      var node = document.getElementById("experienceFeedbackModal");
      if (node && node.parentNode) node.parentNode.removeChild(node);
    } catch (e) {}
    if (typeof onDone === "function") onDone();
  }
  try {
    var old = document.getElementById("experienceFeedbackModal");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!document.body) {
      finish();
      return;
    }
    var wrap = document.createElement("div");
    wrap.id = "experienceFeedbackModal";
    wrap.className = "fixed inset-0 z-[90] bg-slate-900/55 flex items-end sm:items-center justify-center p-4";
    wrap.innerHTML =
      '<div class="bg-white w-full max-w-md rounded-t-3xl sm:rounded-[28px] shadow-2xl border border-slate-200 p-5 space-y-3">' +
        '<h3 class="text-base font-black text-slate-900 leading-snug">How was your ordering experience?</h3>' +
        '<p class="text-[13px] font-bold text-slate-600 leading-relaxed">Is there anything we should improve to make it easier for you?</p>' +
        '<textarea id="expFbText" maxlength="800" rows="4" placeholder="Your suggestions…" class="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-violet-500"></textarea>' +
        '<button type="button" id="expFbSubmit" class="w-full bg-violet-700 text-white font-black py-3.5 rounded-2xl text-sm">Submit</button>' +
        '<button type="button" id="expFbClose" class="w-full min-h-[52px] bg-slate-100 text-slate-800 font-black py-3.5 rounded-2xl text-sm">Close</button>' +
      '</div>';
    document.body.appendChild(wrap);
    var closeBtn = wrap.querySelector("#expFbClose");
    var submitBtn = wrap.querySelector("#expFbSubmit");
    var textBox = wrap.querySelector("#expFbText");
    if (closeBtn) closeBtn.onclick = finish;
    if (!submitBtn) {
      finish();
      return;
    }
    submitBtn.onclick = function () {
      var text = String((textBox && textBox.value) || "").trim();
      if (!text) return alert("Please type a suggestion, or tap Close to skip.");
      var uid = window.firebase && firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.uid;
      if (!uid || !firebase.database) {
        finish();
        return;
      }
      submitBtn.disabled = true;
      firebase.database().ref("feedback").push({
        text: text.slice(0, 800),
        at: Date.now(),
        uid: uid,
        orderKey: String(info.orderKey || ""),
        orderId: String(info.orderId || ""),
        name: String(info.name || ""),
        phone: String(info.phone || ""),
        source: String(info.source || "takeaway")
      }).then(finish).catch(function (err) {
        if (!doneOnce) submitBtn.disabled = false;
        if (typeof window.alertDbError === "function") window.alertDbError(err);
        else alert("Feedback save failed.");
      });
    };
  } catch (err) {
    finish();
  }
};

window.chatPing = function () {
  if (window.chatSoundMuted) return;
  var now = Date.now();
  if (now - pfrChatLastPing < 1200) return;
  var ctx = pfrChatAudio();
  if (!ctx || ctx.state !== 'running') return;
  pfrChatLastPing = now;
  try {
    [880, 1320].forEach(function (freq, i) {
      var t = ctx.currentTime + i * 0.13;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch (e) {}
};

function pfrChatSeenKey(role, orderKey) {
  return 'pfr_chat_seen:' + role + ':' + orderKey;
}

window.chatSeenAt = function (role, orderKey) {
  try { return Number(localStorage.getItem(pfrChatSeenKey(role, orderKey))) || 0; } catch (e) { return 0; }
};

window.chatIncomingTimes = function (chats, myRole) {
  var times = [];
  Object.keys(chats || {}).forEach(function (id) {
    var msg = chats[id];
    if (!msg || window.chatRoleOf(msg) === myRole) return;
    times.push(Number(msg.timestamp) || 0);
  });
  return times;
};

window.chatUnreadCount = function (orderKey, chats, myRole) {
  var seen = window.chatSeenAt(myRole, orderKey);
  return window.chatIncomingTimes(chats, myRole).filter(function (t) { return t > seen; }).length;
};

window.chatMarkSeen = function (orderKey, chats, myRole) {
  if (!orderKey) return;
  var latest = 0;
  Object.keys(chats || {}).forEach(function (id) {
    var t = Number((chats[id] || {}).timestamp) || 0;
    if (t > latest) latest = t;
  });
  if (latest > window.chatSeenAt(myRole, orderKey)) {
    try { localStorage.setItem(pfrChatSeenKey(myRole, orderKey), String(latest)); } catch (e) {}
  }
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-chat-badge]').forEach(function (el) {
    if (el.getAttribute('data-chat-badge') === String(orderKey)) el.remove();
  });
};

window.chatBadgeHtml = function (orderKey, count) {
  if (!count) return '';
  return '<span class="pfr-chat-badge" data-chat-badge="' + window.escapeText(orderKey) + '">' + (count > 9 ? '9+' : count) + '</span>';
};

window.chatWatch = function (orderKey, chats, myRole, isOpen) {
  var id = myRole + ':' + orderKey;
  var latest = Math.max.apply(null, [0].concat(window.chatIncomingTimes(chats, myRole)));
  var prev = pfrChatHeard[id];
  pfrChatHeard[id] = Math.max(prev || 0, latest);
  if (prev !== undefined && latest > prev) window.chatPing();
  if (isOpen) {
    window.chatMarkSeen(orderKey, chats, myRole);
    return 0;
  }
  return window.chatUnreadCount(orderKey, chats, myRole);
};

window.renderChatThread = function (container, chats, myRole) {
  if (!container) return;
  var keys = Object.keys(chats || {}).sort();
  if (!keys.length) {
    container.innerHTML = '<div class="text-center text-slate-400 text-[10px] italic py-4">Customer, cashier සහ rider එකම chat එකේ.</div>';
    return;
  }
  container.innerHTML = keys.map(function (id) {
    return window.chatBubbleHtml(chats[id] || {}, myRole);
  }).join('');
  container.scrollTop = container.scrollHeight;
};

window.PEOPLES_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDfdg_tH3ecdUJBIIgvjHD5_0lM34oXAoc",
  authDomain: "peoples-family-restaurant.firebaseapp.com",
  databaseURL: "https://peoples-family-restaurant-default-rtdb.firebaseio.com",
  projectId: "peoples-family-restaurant",
  storageBucket: "peoples-family-restaurant.firebasestorage.app",
  messagingSenderId: "172667359435",
  appId: "1:172667359435:web:d8454f2989d7ac0d43cb4e",
  measurementId: "G-1SVY3CKLR4"
};

if (window.firebase && !firebase.apps.length) {
  firebase.initializeApp(window.PEOPLES_FIREBASE_CONFIG);
}

(function bootOfflineBanner() {
  var parts = String(location.pathname || "").toLowerCase().split("/").filter(Boolean);
  var file = parts[parts.length - 1] || "";
  if (!file) return;
  if (file === "pos") file = "pos.html";
  if (file === "admin") file = "admin.html";
  if (file === "cashier") file = "cashier.html";
  if (file === "steward") file = "steward.html";
  if (file === "waiter") file = "waiter.html";
  if (file === "rider") file = "rider.html";
  if (file === "staff-login") file = "staff-login.html";
  var staffPages = ["pos.html", "admin.html", "cashier.html", "steward.html", "waiter.html", "rider.html", "staff-login.html"];
  if (staffPages.indexOf(file) < 0) return;
  function start() { window.attachOfflineBanner(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
