/**
 * Free OTP mail backend — Google Apps Script.
 * Copy this into https://script.google.com → New project.
 * Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the Web app URL into Admin → Shop → OTP mail URL.
 */
var SITE_KEY = 'pfr-horana-otp';

function doGet(e) {
  var p = (e && e.parameter) || {};
  var result = { ok: false };
  try {
    if (String(p.key || '') !== SITE_KEY) {
      result.error = 'bad key';
    } else {
      var email = String(p.email || '').trim().toLowerCase();
      var otp = String(p.otp || '').trim();
      var name = String(p.name || 'Customer').trim() || 'Customer';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp)) {
        result.error = 'bad input';
      } else {
        var cache = CacheService.getScriptCache();
        var cacheKey = 'otp_' + email;
        if (cache.get(cacheKey)) {
          result.error = 'wait';
        } else {
          MailApp.sendEmail({
            to: email,
            subject: 'Peoples Family Restaurant login code',
            body: 'Hi ' + name + ',\n\nYour login code is ' + otp + '.\nIt expires in 10 minutes.\n\nඔබේ login කේතය: ' + otp + '\nවිනාඩි 10කින් expire වෙනවා.\n\nPeoples Family Restaurant, Horana'
          });
          cache.put(cacheKey, '1', 45);
          result.ok = true;
        }
      }
    }
  } catch (err) {
    result.error = String(err && err.message ? err.message : err);
  }
  var payload = JSON.stringify(result);
  var cb = String(p.callback || '').replace(/[^\w$]/g, '');
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}
