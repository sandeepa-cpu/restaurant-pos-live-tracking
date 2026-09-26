const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

if (!admin.apps.length) admin.initializeApp();

const gmailUser = defineSecret("GMAIL_USER");
const gmailPass = defineSecret("GMAIL_APP_PASSWORD");

function md5upper(text) {
  return crypto.createHash("md5").update(String(text || ""), "utf8").digest("hex").toUpperCase();
}

function money2(n) {
  return Number(n || 0).toFixed(2);
}

async function loadPayhereConfig() {
  const snap = await admin.database().ref("settings").once("value");
  const settings = snap.val() || {};
  const pub = settings.payhere || {};
  const secret = String(settings.payhere_secret || "").trim();
  return {
    enabled: pub.enabled !== false && !!String(pub.merchantId || "").trim() && !!secret,
    sandbox: pub.sandbox === true,
    merchantId: String(pub.merchantId || "").trim(),
    secret: secret,
  };
}

function payhereRequestHash(merchantId, orderId, amount, currency, secret) {
  return md5upper(merchantId + orderId + amount + currency + md5upper(secret));
}

function payhereNotifyHash(merchantId, orderId, amount, currency, statusCode, secret) {
  return md5upper(merchantId + orderId + amount + currency + String(statusCode) + md5upper(secret));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function emailOtpKey(email) {
  return normalizeEmail(email).replace(/[.#$\[\]/]/g, "_");
}

function otpHash(email, otp) {
  return crypto.createHash("sha256").update(normalizeEmail(email) + ":" + String(otp)).digest("hex");
}

function mailer() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser.value(),
      pass: gmailPass.value(),
    },
  });
}

exports.sendEmailOtp = onRequest(
    {cors: true, secrets: [gmailUser, gmailPass], invoker: "public"},
    async (req, res) => {
      try {
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ok: false, error: "POST only"});
        const email = normalizeEmail(req.body && req.body.email);
        if (!isEmail(email)) return res.status(400).json({ok: false, error: "valid email required"});
        const ref = admin.database().ref("email_otps/" + emailOtpKey(email));
        const prev = (await ref.once("value")).val() || {};
        if (prev.sentAt && Date.now() - Number(prev.sentAt) < 45000) {
          return res.status(429).json({ok: false, error: "OTP එකක් දැනටමත් යවලා තියෙනවා. ටිකක් ඉන්න."});
        }
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        await ref.set({
          hash: otpHash(email, otp),
          sentAt: Date.now(),
          exp: Date.now() + 10 * 60 * 1000,
          tries: 0,
        });
        await mailer().sendMail({
          from: `Peoples Family Restaurant <${gmailUser.value()}>`,
          to: email,
          subject: "Peoples Family Restaurant login code",
          text: "Your login code is " + otp + ". It expires in 10 minutes.\n\nඔබේ login කේතය: " + otp + "\nවිනාඩි 10කින් expire වෙනවා.",
        });
        return res.status(200).json({ok: true});
      } catch (error) {
        return res.status(500).json({ok: false, error: error.message || "OTP send failed"});
      }
    }
);

exports.verifyEmailOtp = onRequest(
    {cors: true, invoker: "public"},
    async (req, res) => {
      try {
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ok: false, error: "POST only"});
        const email = normalizeEmail(req.body && req.body.email);
        const otp = String((req.body && req.body.otp) || "").trim();
        if (!isEmail(email) || !/^\d{6}$/.test(otp)) {
          return res.status(400).json({ok: false, error: "email and 6-digit OTP required"});
        }
        const ref = admin.database().ref("email_otps/" + emailOtpKey(email));
        const snap = await ref.once("value");
        if (!snap.exists()) return res.status(400).json({ok: false, error: "OTP එකක් යවලා නැහැ. ආයෙත් Send කරන්න."});
        const row = snap.val() || {};
        if (Number(row.exp) < Date.now()) {
          await ref.remove();
          return res.status(400).json({ok: false, error: "OTP expire උනා. අලුත් කේතයක් ඉල්ලන්න."});
        }
        const tries = Number(row.tries || 0);
        if (tries >= 5) {
          await ref.remove();
          return res.status(400).json({ok: false, error: "වැරදි උත්සාහ වැඩියි. අලුත් OTP එකක් ඉල්ලන්න."});
        }
        if (row.hash !== otpHash(email, otp)) {
          await ref.update({tries: tries + 1});
          return res.status(400).json({ok: false, error: "කේතය වැරදියි."});
        }
        await ref.remove();
        return res.status(200).json({ok: true});
      } catch (error) {
        return res.status(500).json({ok: false, error: error.message || "OTP verify failed"});
      }
    }
);

exports.payhereStart = onRequest({cors: true, invoker: "public"}, async (req, res) => {
  try {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ok: false, error: "POST only"});
    const orderKey = String((req.body && req.body.orderKey) || "").trim();
    if (!orderKey) return res.status(400).json({ok: false, error: "orderKey required"});
    const cfg = await loadPayhereConfig();
    if (!cfg.enabled) {
      return res.status(503).json({ok: false, error: "PayHere තවම on කරලා නැහැ. Admin merchant ID + secret දාන්න."});
    }
    const snap = await admin.database().ref("orders/" + orderKey).once("value");
    if (!snap.exists()) return res.status(404).json({ok: false, error: "Order not found"});
    const order = snap.val() || {};
    const pay = order.payment || {};
    if (pay.method !== "payhere") return res.status(400).json({ok: false, error: "This order is not PayHere"});
    if (pay.status === "paid") return res.status(400).json({ok: false, error: "Already paid"});
    const amount = money2(order.total);
    const currency = "LKR";
    const origin = "https://peoplesfamilyrestaurant.lk";
    const name = String(order.customerName || "Customer").trim();
    const parts = name.split(/\s+/);
    const firstName = parts[0] || "Customer";
    const lastName = parts.slice(1).join(" ") || "Order";
    const items = (order.items || []).map((i) => (i.qty || 1) + "x " + (i.name || "")).join(", ").slice(0, 120) || (order.orderId || "Food order");
    const hash = payhereRequestHash(cfg.merchantId, orderKey, amount, currency, cfg.secret);
    const phone = String(order.customerPhone || "").replace(/\D/g, "");
    return res.json({
      ok: true,
      sandbox: cfg.sandbox,
      fields: {
        merchant_id: cfg.merchantId,
        return_url: origin + "/order.html?id=" + encodeURIComponent(orderKey),
        cancel_url: origin + "/order.html?id=" + encodeURIComponent(orderKey),
        notify_url: origin + "/payhere/notify",
        order_id: orderKey,
        items: items,
        currency: currency,
        amount: amount,
        first_name: firstName,
        last_name: lastName,
        email: order.customerEmail || "orders@peoplesfamilyrestaurant.lk",
        phone: phone || "0700000000",
        address: (order.deliveryMeta && (order.deliveryMeta.address || order.deliveryMeta.landmark)) || "Horana",
        city: "Horana",
        country: "Sri Lanka",
        hash: hash,
      },
    });
  } catch (err) {
    return res.status(500).json({ok: false, error: err.message || "PayHere start failed"});
  }
});

function readFormBody(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  if (typeof b === "string" && b.length) {
    return Object.fromEntries(new URLSearchParams(b));
  }
  if (req.rawBody) {
    return Object.fromEntries(new URLSearchParams(String(req.rawBody)));
  }
  return {};
}

exports.payhereNotify = onRequest({cors: false, invoker: "public"}, async (req, res) => {
  try {
    const body = readFormBody(req);
    const merchantId = String(body.merchant_id || "");
    const orderId = String(body.order_id || "");
    const amount = String(body.payhere_amount || "");
    const currency = String(body.payhere_currency || "");
    const statusCode = String(body.status_code || "");
    const md5sig = String(body.md5sig || "").toUpperCase();
    const cfg = await loadPayhereConfig();
    if (!cfg.secret || merchantId !== cfg.merchantId) {
      return res.status(403).send("invalid merchant");
    }
    const local = payhereNotifyHash(merchantId, orderId, amount, currency, statusCode, cfg.secret);
    if (local !== md5sig) return res.status(403).send("invalid signature");
    if (!orderId) return res.status(400).send("no order");
    const ref = admin.database().ref("orders/" + orderId);
    const snap = await ref.once("value");
    if (!snap.exists()) return res.status(404).send("order not found");
    const order = snap.val() || {};
    const patch = {
      payment: {
        method: "payhere",
        timing: "before",
        status: statusCode === "2" ? "paid" : (statusCode === "0" ? "pending_verify" : "unpaid"),
        payherePaymentId: body.payment_id || "",
        payhereStatus: statusCode,
        verifiedAt: Date.now(),
        verifiedBy: "payhere",
      },
    };
    if (statusCode === "2" && (order.status === "PendingPayment" || !order.status)) {
      patch.status = "Received";
    }
    await ref.update(patch);
    return res.status(200).send("OK");
  } catch (err) {
    return res.status(500).send("error");
  }
});

