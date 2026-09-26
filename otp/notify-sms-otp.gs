/**
 * Peoples Bakers / Peoples Family Restaurant — SMS OTP (Notify.lk)
 * Paste this into Google Apps Script. Do NOT put API keys in the shop website.
 *
 * Script Properties (Project Settings → Script properties):
 *   NOTIFY_USER_ID
 *   NOTIFY_API_KEY
 *   NOTIFY_SENDER_ID   = PB HORANA
 *
 * Deploy → New deployment → Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the /exec URL into Admin → Shop → SMS OTP URL
 */
var APP_KEY = 'pfr-horana-otp';
var OTP_TTL_MS = 5 * 60 * 1000;
var RESEND_MS = 60 * 1000;
var MAX_PER_HOUR = 3;
var MAX_PER_DAY = 5;
var MAX_TRIES = 5;

function doGet(e) {
  var p = (e && e.parameter) || {};
  var cb = String(p.callback || '');
  var result;
  try {
    result = handleOtp(p);
  } catch (err) {
    result = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  if (!result || typeof result !== 'object') result = { ok: false, error: 'OTP failed.' };
  if (p.token) result.token = String(p.token);
  var body = JSON.stringify(result);
  if (String(p.mode || '') === 'frame') {
    var html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>try{window.parent.postMessage({pfrOtp:' + body + '},"*");}catch(e){}</script></body></html>';
    return HtmlService.createHtmlOutput(html)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (cb && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function handleOtp(p) {
  if (String(p.key || '') !== APP_KEY) {
    return { ok: false, error: 'Invalid key' };
  }
  var action = String(p.action || '');
  if (action === 'ping') return { ok: true };
  if (action === 'send') return sendOtp(p);
  if (action === 'verify') return verifyOtp(p);
  return { ok: false, error: 'Unknown action' };
}

function phoneKey(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 9) return '';
  return digits.slice(-9);
}

function toNotifyNumber(key) {
  return '94' + key;
}

function sha256hex(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''), Utilities.Charset.UTF_8);
  return raw.map(function (b) {
    var v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function cacheGet(key) {
  var raw = CacheService.getScriptCache().get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function cachePut(key, value, seconds) {
  CacheService.getScriptCache().put(key, JSON.stringify(value), seconds);
}

function sendOtp(p) {
  var key = phoneKey(p.phone);
  if (!key) return { ok: false, error: 'Phone අංකය හරිද බලන්න.' };

  var now = Date.now();
  var hour = cacheGet('h_' + key) || { n: 0, at: now };
  var day = cacheGet('d_' + key) || { n: 0, at: now };
  if (hour.n >= MAX_PER_HOUR) return { ok: false, error: 'මේ අංකයට පැයකට කේත 3ක් විතරයි. ටිකක් ඉන්න.' };
  if (day.n >= MAX_PER_DAY) return { ok: false, error: 'මේ අංකයට අද කේත 5ක් ගියා. හෙට ආයෙත් උත්සාහ කරන්න.' };

  var prev = cacheGet('otp_' + key);
  if (prev && prev.sentAt && now - Number(prev.sentAt) < RESEND_MS) {
    var wait = Math.ceil((RESEND_MS - (now - Number(prev.sentAt))) / 1000);
    return { ok: false, error: 'OTP එකක් දැනටමත් යවලා තියෙනවා. තත්පර ' + wait + 'ක් ඉන්න.' };
  }

  var props = PropertiesService.getScriptProperties();
  var userId = String(props.getProperty('NOTIFY_USER_ID') || '').trim();
  var apiKey = String(props.getProperty('NOTIFY_API_KEY') || '').trim();
  var sender = String(props.getProperty('NOTIFY_SENDER_ID') || 'PB HORANA').trim();
  if (!userId || !apiKey) return { ok: false, error: 'Notify API Script Properties එකේ දාලා නැහැ.' };

  var otp = String(Math.floor(100000 + Math.random() * 900000));
  var message = 'PB HORANA: Your Peoples Bakers code is ' + otp + '. Valid 5 min.';
  var url = 'https://app.notify.lk/api/v1/send'
    + '?user_id=' + encodeURIComponent(userId)
    + '&api_key=' + encodeURIComponent(apiKey)
    + '&sender_id=' + encodeURIComponent(sender)
    + '&to=' + encodeURIComponent(toNotifyNumber(key))
    + '&message=' + encodeURIComponent(message);

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  var code = res.getResponseCode();
  var text = String(res.getContentText() || '');
  var json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  var status = json ? String(json.status || '').toLowerCase() : '';
  if (code < 200 || code >= 300 || status === 'error' || status === 'failed') {
    var why = (json && (json.message || json.data)) || 'SMS යවන්න බැරි වුණා. Notify balance / sender ID බලන්න.';
    return { ok: false, error: String(why) };
  }

  cachePut('otp_' + key, {
    hash: sha256hex(key + ':' + otp),
    sentAt: now,
    exp: now + OTP_TTL_MS,
    tries: 0
  }, 360);
  cachePut('h_' + key, { n: Number(hour.n || 0) + 1, at: now }, 3600);
  cachePut('d_' + key, { n: Number(day.n || 0) + 1, at: now }, 86400);
  return { ok: true };
}

function verifyOtp(p) {
  var key = phoneKey(p.phone);
  var otp = String(p.otp || '').trim();
  if (!key || !/^\d{6}$/.test(otp)) return { ok: false, error: 'Phone සහ අංක 6යි දාන්න.' };
  var row = cacheGet('otp_' + key);
  if (!row) return { ok: false, error: 'OTP එකක් යවලා නැහැ. Send ආයෙත් ඔබන්න.' };
  if (Number(row.exp) < Date.now()) {
    CacheService.getScriptCache().remove('otp_' + key);
    return { ok: false, error: 'OTP expire උනා. අලුත් කේතයක් ඉල්ලන්න.' };
  }
  var tries = Number(row.tries || 0);
  if (tries >= MAX_TRIES) {
    CacheService.getScriptCache().remove('otp_' + key);
    return { ok: false, error: 'වැරදි උත්සාහ වැඩියි. අලුත් OTP එකක් ඉල්ලන්න.' };
  }
  if (row.hash !== sha256hex(key + ':' + otp)) {
    row.tries = tries + 1;
    cachePut('otp_' + key, row, 360);
    return { ok: false, error: 'කේතය වැරදියි.' };
  }
  CacheService.getScriptCache().remove('otp_' + key);
  return { ok: true };
}
