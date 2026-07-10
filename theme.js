/**
 * Theme manager — Light / Dark / Editorial / Auto (system).
 * Runs in two phases:
 *   1. Inline (<head>) — applies the saved theme before first paint (no flash).
 *   2. DOMContentLoaded — wires up the switcher UI.
 *
 * Editorial mode (Isabel Moranta-inspired editorial minimalism) is a custom
 * dark variant: it sets data-bs-theme="dark" so Bootstrap stays consistent,
 * AND sets data-ec-theme="editorial" so styles.css can override surface
 * colours, type, borders, and accents to a paper-on-black editorial system.
 */
(function () {
  var STORAGE_KEY = "ec-theme";
  var ICONS = {
    light:     "bi-sun-fill",
    dark:      "bi-moon-stars-fill",
    editorial: "bi-journal-text",
    auto:      "bi-circle-half"
  };
  var LABELS = {
    light:     "Light",
    dark:      "Dark",
    editorial: "Editorial",
    auto:      "Auto"
  };

  /* ── helpers ──────────────────────────────────────────────── */
  function saved() {
    try { return localStorage.getItem(STORAGE_KEY) || "dark"; } catch (_) { return "dark"; }
  }

  function store(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (_) {}
  }

  function resolved(mode) {
    if (mode === "auto") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark" : "light";
    }
    if (mode === "editorial") return "dark";
    return mode;
  }

  /* ── Phase 1: apply theme immediately (called inline, before DOM ready) ── */
  function applyTheme(mode) {
    var root = document.documentElement;
    root.setAttribute("data-bs-theme", resolved(mode));
    if (mode === "editorial") {
      root.setAttribute("data-ec-theme", "editorial");
    } else {
      root.removeAttribute("data-ec-theme");
    }
  }

  applyTheme(saved());

  /* ── Phase 2: wire up the UI once DOM is ready ─────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    var themeIcon  = document.getElementById("themeIcon");
    var themeLabel = document.getElementById("themeLabel");
    var checks     = document.querySelectorAll(".theme-check");
    var options    = document.querySelectorAll(".theme-option");

    function updateUI(mode) {
      if (themeIcon) {
        themeIcon.className = "bi " + (ICONS[mode] || ICONS.light) + " theme-icon";
      }
      if (themeLabel) {
        themeLabel.textContent = LABELS[mode] || "Light";
      }
      checks.forEach(function (el) {
        el.classList.toggle("visible", el.dataset.check === mode);
      });
      options.forEach(function (el) {
        el.classList.toggle("active", el.dataset.theme === mode);
      });
    }

    function setTheme(mode) {
      store(mode);
      applyTheme(mode);
      updateUI(mode);
    }

    options.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(btn.dataset.theme);
      });
    });

    // Keyboard: press T to cycle through themes
    document.addEventListener("keydown", function (e) {
      if ((e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" ||
           e.target.tagName === "SELECT") && e.target !== document.body) return;
      if (e.key === "t" || e.key === "T") {
        var cycle = ["light", "dark", "editorial", "auto"];
        var cur = saved();
        var idx = cycle.indexOf(cur);
        var next = cycle[(idx === -1 ? 0 : idx + 1) % cycle.length];
        setTheme(next);
      }
    });

    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        if (saved() === "auto") applyTheme("auto");
      });
    }

    updateUI(saved());
  });
})();
