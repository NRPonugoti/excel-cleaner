(function () {
  "use strict";

  // Stored SHA-256 hashes — rotate via tools/hash-password.html
  var HASH_USER = "77cdf1d9913188c8ee1cdf79b435236df99e724384403ab62efd8f3c59478dfc";
  var HASH_PASS = "4b85df16a17f41b4686bfd377dbefc4453f063ebc99ad54d91822509298b2baa";
  var SESSION_KEY = "ec-auth";

  // ── SHA-256 via Web Crypto API ───────────────────────────
  function sha256(str) {
    var buf = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", buf).then(function (hash) {
      return Array.from(new Uint8Array(hash))
        .map(function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  // ── Timing-safe string comparison (prevents timing attacks) ─
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    var result = 0;
    for (var i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  // ── If already logged in, go straight to the app ─────────
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      window.location.replace("index.html");
    }
  } catch (_) {}

  // ── DOM refs ─────────────────────────────────────────────
  var form        = document.getElementById("loginForm");
  var userInput   = document.getElementById("username");
  var passInput   = document.getElementById("password");
  var loginBtn    = document.getElementById("loginBtn");
  var btnText     = loginBtn.querySelector(".login-btn-text");
  var btnIcon     = loginBtn.querySelector(".login-btn-icon");
  var spinner     = document.getElementById("loginSpinner");
  var alertEl     = document.getElementById("loginAlert");
  var alertMsg    = document.getElementById("loginAlertMsg");
  var togglePw    = document.getElementById("togglePw");
  var toggleIcon  = document.getElementById("togglePwIcon");

  // ── Password visibility toggle ───────────────────────────
  togglePw.addEventListener("click", function () {
    var isPass = passInput.type === "password";
    passInput.type = isPass ? "text" : "password";
    toggleIcon.className = isPass ? "bi bi-eye-slash" : "bi bi-eye";
  });

  // ── Clear error styling on input ─────────────────────────
  [userInput, passInput].forEach(function (el) {
    el.addEventListener("input", function () {
      el.classList.remove("is-invalid");
      hideAlert();
    });
  });

  // ── Ripple ────────────────────────────────────────────────
  loginBtn.addEventListener("click", function (e) {
    var rect = loginBtn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var x = e.clientX - rect.left - size / 2;
    var y = e.clientY - rect.top - size / 2;
    var rip = document.createElement("span");
    rip.className = "login-btn-ripple";
    rip.style.cssText = "width:" + size + "px;height:" + size + "px;left:" + x + "px;top:" + y + "px;";
    loginBtn.appendChild(rip);
    rip.addEventListener("animationend", function () { rip.remove(); });
  });

  // ── Alert helpers ────────────────────────────────────────
  function showAlert(msg) {
    alertMsg.textContent = msg;
    alertEl.hidden = false;
    alertEl.style.animation = "none";
    void alertEl.offsetWidth;
    alertEl.style.animation = "";
  }
  function hideAlert() { alertEl.hidden = true; }

  // ── Loading state ────────────────────────────────────────
  function setLoading(on) {
    loginBtn.disabled = on;
    btnText.style.display = on ? "none" : "";
    btnIcon.style.display = on ? "none" : "";
    spinner.hidden = !on;
  }

  // ── Success → redirect ───────────────────────────────────
  function loginSuccess() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (_) {}
    loginBtn.style.background = "linear-gradient(135deg, #059669, #10b981)";
    loginBtn.style.boxShadow  = "0 8px 28px rgba(16,185,129,0.55)";
    loginBtn.disabled = false;
    btnText.textContent = "Success!";
    btnText.style.display = "";
    btnIcon.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
    btnIcon.style.display = "";
    spinner.hidden = true;
    setTimeout(function () {
      window.location.replace("index.html");
    }, 700);
  }

  // ── Form submit — async SHA-256 comparison ────────────────
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideAlert();

    var u = (userInput.value || "").trim();
    var p = passInput.value || "";

    if (!u) { userInput.classList.add("is-invalid"); userInput.focus(); }
    if (!p) { passInput.classList.add("is-invalid"); if (u) passInput.focus(); }
    if (!u || !p) {
      showAlert("Please enter both username and password.");
      return;
    }

    setLoading(true);

    // Hash both fields concurrently
    Promise.all([sha256(u), sha256(p)]).then(function (results) {
      var uHash = results[0];
      var pHash = results[1];

      if (safeEqual(uHash, HASH_USER) && safeEqual(pHash, HASH_PASS)) {
        loginSuccess();
      } else {
        setLoading(false);
        userInput.classList.add("is-invalid");
        passInput.classList.add("is-invalid");
        showAlert("Incorrect username or password. Please try again.");
        passInput.value = "";
        passInput.focus();
      }
    }).catch(function () {
      setLoading(false);
      showAlert("A cryptographic error occurred. Please try a modern browser.");
    });
  });

  // Auto-focus
  userInput.focus();
})();
