var STAFF_EMAIL_DOMAIN = "peoples-family-restaurant.web.app";
var STAFF_ROLES = ["admin", "cashier", "steward"];
var STAFF_PAGE_ROLES = {
  "pos.html": ["admin", "cashier", "steward"],
  "admin.html": ["admin"],
  "cashier.html": ["admin", "cashier"],
  "steward.html": ["admin", "steward"],
  "waiter.html": ["admin", "steward"]
};

var STAFF_HOME = {
  admin: "admin.html",
  cashier: "cashier.html",
  steward: "steward.html"
};

function staffHomeForRole(role) {
  return STAFF_HOME[role] || "pos.html";
}

function staffEmailForRole(role) {
  return String(role || "") + "@" + STAFF_EMAIL_DOMAIN;
}

function staffIdFromUsername(role, username) {
  var slug = String(username || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (STAFF_ROLES.indexOf(role) < 0 || slug.length < 2) return "";
  return role + "_" + slug;
}

function staffEmailForId(id) {
  return String(id || "") + "@" + STAFF_EMAIL_DOMAIN;
}

function extraStaffIdFromEmail(email) {
  var prefix = String(email || "").split("@")[0];
  if (prefix.indexOf("station_") === 0) return "";
  if (STAFF_ROLES.indexOf(prefix) >= 0) return "";
  var parts = prefix.split("_");
  var role = parts[0];
  if (STAFF_ROLES.indexOf(role) < 0 || parts.length < 2) return "";
  if (parts.length >= 3) return role + "_" + parts[1];
  return prefix;
}

function roleFromStaffEmail(email) {
  var prefix = String(email || "").split("@")[0];
  if (STAFF_ROLES.indexOf(prefix) >= 0) return prefix;
  if (prefix.indexOf("station_") === 0) {
    var stationRole = prefix.split("_")[1];
    return STAFF_ROLES.indexOf(stationRole) >= 0 ? stationRole : "";
  }
  var role = prefix.split("_")[0];
  return STAFF_ROLES.indexOf(role) >= 0 ? role : "";
}

function newStationLoginId(role) {
  return "station_" + String(role || "") + "_" + Date.now().toString(36);
}

function currentStaffPage() {
  var file = (location.pathname.split("/").pop() || "").toLowerCase();
  if (!file || file === "pos") file = "pos.html";
  if (file === "admin") file = "admin.html";
  if (file === "cashier") file = "cashier.html";
  if (file === "steward") file = "steward.html";
  if (file === "waiter") file = "waiter.html";
  return file;
}

function getStaffSession() {
  try {
    return JSON.parse(sessionStorage.getItem("peoples_staff") || "null");
  } catch (e) {
    return null;
  }
}

function setStaffSession(role, username) {
  sessionStorage.setItem("peoples_staff", JSON.stringify({
    role: role,
    username: username || role,
    at: Date.now()
  }));
  sessionStorage.setItem("auth_role", role);
}

function clearStaffSession() {
  sessionStorage.removeItem("peoples_staff");
  sessionStorage.removeItem("auth_role");
}

function riderPhoneKey(phone) {
  var digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 9) return "";
  return digits.slice(-9);
}

async function hashPassword(text) {
  if (!text || !window.crypto || !crypto.subtle) return text;
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(function (b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
}

async function passwordsMatch(stored, input) {
  if (!stored || !input) return false;
  if (stored === input) return true;
  return stored === (await hashPassword(input));
}

function showStaffPage() {
  document.documentElement.style.visibility = "";
}

function hideStaffPage() {
  document.documentElement.style.visibility = "hidden";
}

function redirectToStaffLogin() {
  var next = currentStaffPage();
  location.replace("staff-login.html?next=" + encodeURIComponent(next));
}

function roleIsAllowed(role, allowedRoles) {
  if (!role) return false;
  if (!allowedRoles || !allowedRoles.length) return true;
  return allowedRoles.indexOf(role) >= 0;
}

function firebasePasswordFrom(plain) {
  var text = String(plain || "");
  if (text.length >= 6) return text;
  return text + "000000".slice(text.length);
}

function togglePasswordField(inputId, btn) {
  var el = document.getElementById(inputId);
  if (!el) return;
  var show = el.type === "password";
  el.type = show ? "text" : "password";
  if (btn) btn.innerText = show ? "Hide" : "Show";
}

function notifyDbError(err) {
  var msg = (err && (err.message || err.code)) || "Permission denied";
  alert("Save failed. Staff login ආයෙන්ම කරන්න.\n" + msg);
}

function applyStaffNavLinks() {
  var session = getStaffSession();
  var role = (session && session.role) || "";
  var page = currentStaffPage();
  var isAdmin = role === "admin";
  var canCashier = isAdmin || role === "cashier";
  document.querySelectorAll("[data-nav-admin]").forEach(function (el) {
    el.classList.toggle("hidden", !isAdmin || page === "admin.html");
  });
  document.querySelectorAll("[data-nav-cashier]").forEach(function (el) {
    el.classList.toggle("hidden", !canCashier || page === "cashier.html");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyStaffNavLinks);
} else {
  applyStaffNavLinks();
}

function guardStaffPage(allowedRoles) {
  hideStaffPage();
  var page = currentStaffPage();
  var allowed = allowedRoles || STAFF_PAGE_ROLES[page] || [];

  function accept(role) {
    if (!roleIsAllowed(role, allowed)) {
      redirectToStaffLogin();
      return;
    }
    showStaffPage();
  }

  if (!(window.firebase && firebase.auth)) {
    redirectToStaffLogin();
    return false;
  }

  firebase.auth().onAuthStateChanged(function (user) {
    var role = user ? roleFromStaffEmail(user.email) : "";
    if (!role) {
      clearStaffSession();
      redirectToStaffLogin();
      return;
    }
    var session = getStaffSession();
    setStaffSession(role, (session && session.username) || role);
    applyStaffNavLinks();
    var extraId = user ? extraStaffIdFromEmail(user.email) : "";
    if (extraId && firebase.database) {
      firebase.database().ref("staff/" + extraId + "/status").on("value", function (snap) {
        if (snap.val() !== "approved") {
          logoutStaff();
          return;
        }
        accept(role);
      });
      return;
    }
    accept(role);
  });
  return true;
}

function saveStationLoginMap(key, loginId, username) {
  if (!key || !loginId || !(window.firebase && firebase.database)) return Promise.resolve();
  return firebase.database().ref("settings/station_logins/" + key).set({
    loginId: String(loginId),
    username: String(username || "")
  });
}

async function lookupStationLogin(key) {
  if (!key || !(window.firebase && firebase.database)) return null;
  try {
    var snap = await firebase.database().ref("settings/station_logins/" + key).once("value");
    return snap.val() || null;
  } catch (e) {
    return null;
  }
}

function nextExtraStaffLoginId(preferredLoginId) {
  var parts = String(preferredLoginId || "").split("_");
  if (parts.length >= 2 && STAFF_ROLES.indexOf(parts[0]) >= 0) {
    return parts[0] + "_" + parts[1] + "_" + Date.now().toString(36);
  }
  return String(preferredLoginId || "staff") + "_" + Date.now().toString(36);
}

async function ensureStaffAuthUser(role, password, preferredLoginId) {
  var pass = firebasePasswordFrom(password);
  if (!role || !pass) throw new Error("Role / password missing");
  var app;
  try {
    app = firebase.app("staffProvision");
  } catch (e) {
    app = firebase.initializeApp(window.PEOPLES_FIREBASE_CONFIG, "staffProvision");
  }
  var ids = [];
  if (preferredLoginId) ids.push(String(preferredLoginId));
  var extra = preferredLoginId && STAFF_ROLES.indexOf(preferredLoginId) < 0 && String(preferredLoginId).indexOf("station_") !== 0;
  if (extra) {
    var suffixed = nextExtraStaffLoginId(preferredLoginId);
    if (ids.indexOf(suffixed) < 0) ids.push(suffixed);
  } else {
    var stationId = newStationLoginId(role);
    if (ids.indexOf(stationId) < 0) ids.push(stationId);
  }
  var lastErr = null;
  try {
    for (var i = 0; i < ids.length; i++) {
      var loginId = ids[i];
      var email = staffEmailForId(loginId);
      try {
        await app.auth().createUserWithEmailAndPassword(email, pass);
        ensureStaffAuthUser.lastUid = (app.auth().currentUser && app.auth().currentUser.uid) || "";
        return loginId;
      } catch (err) {
        lastErr = err;
        if (((err && err.code) || "") === "auth/email-already-in-use") {
          try {
            await app.auth().signInWithEmailAndPassword(email, pass);
            ensureStaffAuthUser.lastUid = (app.auth().currentUser && app.auth().currentUser.uid) || "";
            return loginId;
          } catch (e2) {
            lastErr = e2;
            continue;
          }
        }
        throw err;
      }
    }
    throw lastErr || new Error("Staff Auth failed");
  } finally {
    try { await app.auth().signOut(); } catch (e) {}
  }
}

async function provisionStaffAuthUser(role, password, id) {
  var email = id ? staffEmailForId(id) : staffEmailForRole(role);
  var pass = firebasePasswordFrom(password);
  if (!email || !pass) return "skip";
  var app;
  try {
    app = firebase.app("staffProvision");
  } catch (e) {
    app = firebase.initializeApp(window.PEOPLES_FIREBASE_CONFIG, "staffProvision");
  }
  try {
    await app.auth().createUserWithEmailAndPassword(email, pass);
    return "created";
  } catch (err) {
    var code = (err && err.code) || "";
    if (code === "auth/email-already-in-use") {
      try {
        await app.auth().signInWithEmailAndPassword(email, pass);
        return "updated";
      } catch (e2) {
        return "exists";
      }
    }
    throw err;
  } finally {
    try { await app.auth().signOut(); } catch (e) {}
  }
}

function riderAuthEmail(loginId) {
  return String(loginId || "") + "@" + STAFF_EMAIL_DOMAIN;
}

function riderEmailMatchesPhone(email, phoneId) {
  var prefix = String(email || "").split("@")[0];
  var id = String(phoneId || "");
  return prefix === "rider_" + id || prefix.indexOf("rider_" + id + "_") === 0;
}

async function signInExistingRider(id, password) {
  var pass = firebasePasswordFrom(password);
  if (!id || !pass) throw new Error("Phone / password missing");
  var auth = firebase.auth();
  var current = auth.currentUser;
  if (current && !riderEmailMatchesPhone(current.email, id)) {
    await auth.signOut();
    current = auth.currentUser;
  }
  var candidates = [];
  var stored = await lookupRiderLoginId(id);
  if (stored) candidates.push(stored);
  if (current && riderEmailMatchesPhone(current.email, id)) {
    var currentId = String(current.email).split("@")[0];
    if (candidates.indexOf(currentId) < 0) candidates.push(currentId);
  }
  var def = "rider_" + id;
  if (candidates.indexOf(def) < 0) candidates.push(def);
  var worstErr = null;
  for (var i = 0; i < candidates.length; i++) {
    try {
      await auth.signInWithEmailAndPassword(riderAuthEmail(candidates[i]), pass);
      return candidates[i];
    } catch (err) {
      if (!worstErr || riderAuthErrorRank(err) > riderAuthErrorRank(worstErr)) worstErr = err;
    }
  }
  throw worstErr || new Error("Rider login failed");
}

function riderAuthErrorRank(err) {
  var code = (err && err.code) || "";
  if (code === "auth/too-many-requests") return 4;
  if (code === "auth/user-disabled") return 3;
  if (code === "auth/network-request-failed") return 2;
  if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") return 1;
  return 0;
}

function riderAuthErrorMessage(err) {
  var code = (err && err.code) || "";
  switch (code) {
    case "auth/too-many-requests":
      return "වැරදි උත්සාහ ගොඩක් නිසා මේ account එක තාවකාලිකව lock වෙලා. විනාඩි 15-30කින් ආයෙත් try කරන්න. (Too many failed attempts — temporarily locked.)";
    case "auth/user-disabled":
      return "මේ rider login එක Firebase එකේ disable කරලා. Admin ට කතා කරන්න. (Account disabled.)";
    case "auth/network-request-failed":
      return "Internet connection එක නැහැ / weak. Network එක check කරලා ආයෙත් try කරන්න. (Network error.)";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
      return "Phone හෝ password වැරදියි. Admin එකෙන් Password button එකෙන් අලුත් password එකක් දාගන්න. (Wrong phone or password.)";
    case "auth/invalid-email":
      return "Phone number එක හරි නැහැ. අංක 9-10ක් දාන්න. (Invalid phone.)";
    default:
      return "Login වුණේ නැහැ" + (code ? " (" + code + ")" : "") + ": " + ((err && err.message) || "Unknown error");
  }
}

async function lookupRiderLoginId(id) {
  try {
    var snap = await firebase.database().ref("rider_logins/" + id).once("value");
    var val = String(snap.val() || "");
    return riderEmailMatchesPhone(val + "@", id) ? val : "";
  } catch (e) {
    return "";
  }
}

function saveRiderLoginId(id, loginId) {
  return firebase.database().ref("rider_logins/" + id).set(String(loginId));
}

function newRiderLoginId(phoneId) {
  return "rider_" + String(phoneId || "") + "_" + Date.now().toString(36);
}

async function ensureRiderAuthUser(id, password, preferredLoginId, staySignedIn) {
  var pass = firebasePasswordFrom(password);
  if (!id || !pass) throw new Error("Phone / password missing");
  var app;
  if (staySignedIn) {
    app = firebase.app();
  } else {
    try {
      app = firebase.app("riderProvision");
    } catch (e) {
      app = firebase.initializeApp(window.PEOPLES_FIREBASE_CONFIG, "riderProvision");
    }
  }
  var ids = [];
  if (preferredLoginId) ids.push(String(preferredLoginId));
  var def = "rider_" + id;
  if (ids.indexOf(def) < 0) ids.push(def);
  ids.push(newRiderLoginId(id));
  var lastErr = null;
  for (var i = 0; i < ids.length; i++) {
    var loginId = ids[i];
    var email = riderAuthEmail(loginId);
    try {
      await app.auth().createUserWithEmailAndPassword(email, pass);
      ensureRiderAuthUser.lastUid = (app.auth().currentUser && app.auth().currentUser.uid) || "";
      if (!staySignedIn) {
        try { await app.auth().signOut(); } catch (e) {}
      }
      return loginId;
    } catch (err) {
      lastErr = err;
      var code = (err && err.code) || "";
      if (code === "auth/email-already-in-use") {
        try {
          await app.auth().signInWithEmailAndPassword(email, pass);
          ensureRiderAuthUser.lastUid = (app.auth().currentUser && app.auth().currentUser.uid) || "";
          if (!staySignedIn) {
            try { await app.auth().signOut(); } catch (e2) {}
          }
          return loginId;
        } catch (e3) {
          lastErr = e3;
          continue;
        }
      }
      throw err;
    }
  }
  throw lastErr || new Error("Rider Auth failed");
}

function logoutStaff() {
  clearStaffSession();
  if (window.firebase && firebase.auth) {
    firebase.auth().signOut().catch(function () {});
  }
  location.replace("staff-login.html");
}
