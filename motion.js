/**
 * motion.js — Excel Cleaner animation coordinator
 * Hooks into app.js DOM events without modifying app.js logic.
 */
(function () {
  "use strict";

  /* ── Helpers ─────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }

  function revealCard(el) {
    if (!el || !el.hidden) return;
    el.hidden = false;
    el.classList.remove("animate-card");
    void el.offsetWidth; // force reflow
    el.classList.add("animate-card");
  }

  function flashStat(el) {
    if (!el) return;
    el.classList.remove("stat-flash");
    void el.offsetWidth;
    el.classList.add("stat-flash");
    el.addEventListener("animationend", () => el.classList.remove("stat-flash"), { once: true });
  }

  function addAlertAnim(el) {
    if (!el) return;
    el.classList.remove("alert-anim");
    void el.offsetWidth;
    el.classList.add("alert-anim");
  }

  /* ── Ripple on buttons ────────────────────────────────────── */
  document.querySelectorAll(".anim-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top  - size / 2;
      const ripple = document.createElement("span");
      ripple.className = "btn-ripple";
      ripple.style.cssText = "width:" + size + "px;height:" + size + "px;left:" + x + "px;top:" + y + "px;";
      btn.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    });
  });

  /* ── Generate button: spin icon, then animate stat numbers ── */
  var generateBtn  = $("generateBtn");
  var generateIcon = $("generateIcon");
  var statIds = ["sumTotal", "sumKept", "sumDropped", "sumIssues"];

  if (generateBtn) {
    generateBtn.addEventListener("click", function () {
      if (generateIcon) {
        generateIcon.classList.remove("icon-spin");
        void generateIcon.offsetWidth;
        generateIcon.classList.add("icon-spin");
        generateIcon.addEventListener("animationend", () => generateIcon.classList.remove("icon-spin"), { once: true });
      }
      // Delay stat flash until after app.js builds the output (~50ms)
      setTimeout(function () {
        statIds.forEach(function (id) { flashStat($(id)); });
        // Animate the issue banner if visible
        var banner = $("issueBanner");
        if (banner && !banner.hidden) addAlertAnim(banner);
        // Stagger preview table rows
        animatePreviewRows();
      }, 80);
    });
  }

  /* ── Download button: bounce icon + show toast ───────────── */
  var downloadBtn  = $("downloadBtn");
  var downloadIcon = $("downloadIcon");

  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      if (downloadIcon) {
        downloadIcon.classList.remove("icon-download-bounce");
        void downloadIcon.offsetWidth;
        downloadIcon.classList.add("icon-download-bounce");
        downloadIcon.addEventListener("animationend", () => downloadIcon.classList.remove("icon-download-bounce"), { once: true });
      }
      // Show success toast
      var toastEl = $("downloadToast");
      if (toastEl && window.bootstrap) {
        var toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3000 });
        toast.show();
      }
    });
  }

  /* ── Stagger preview table rows ───────────────────────────── */
  function animatePreviewRows() {
    var tbody = document.querySelector("#previewTable tbody");
    if (!tbody) return;
    var rows = tbody.querySelectorAll("tr");
    rows.forEach(function (tr, i) {
      tr.classList.remove("preview-row-anim");
      tr.style.animationDelay = (i * 28) + "ms";
      void tr.offsetWidth;
      tr.classList.add("preview-row-anim");
      tr.addEventListener("animationend", function () {
        tr.classList.remove("preview-row-anim");
        tr.style.animationDelay = "";
      }, { once: true });
    });
  }

  /* ── Stagger mapping table rows ──────────────────────────── */
  function animateMappingRows() {
    var tbody = $("mappingTbody");
    if (!tbody) return;
    var rows = tbody.querySelectorAll("tr");
    rows.forEach(function (tr, i) {
      tr.classList.remove("map-row-anim");
      tr.style.animationDelay = (i * 40) + "ms";
      void tr.offsetWidth;
      tr.classList.add("map-row-anim");
      tr.addEventListener("animationend", function () {
        tr.classList.remove("map-row-anim");
        tr.style.animationDelay = "";
      }, { once: true });
    });
  }

  /* ── Watch step cards appear (MutationObserver) ─────────── */
  var stepsToWatch = ["stepMapping", "stepFixed", "stepPreview"];
  stepsToWatch.forEach(function (id) {
    var el = $(id);
    if (!el) return;
    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.attributeName === "hidden" && !el.hidden) {
          el.classList.remove("animate-card");
          void el.offsetWidth;
          el.classList.add("animate-card");
          if (id === "stepMapping") {
            // slight delay so rows are in the DOM
            setTimeout(animateMappingRows, 60);
          }
        }
      });
    });
    obs.observe(el, { attributes: true });
  });

  /* ── Mapping rows re-animate when tbody is repopulated ───── */
  var mappingTbody = $("mappingTbody");
  if (mappingTbody) {
    var tbodyObs = new MutationObserver(function () {
      setTimeout(animateMappingRows, 30);
    });
    tbodyObs.observe(mappingTbody, { childList: true });
  }

  /* ── Auto-match banner animation ────────────────────────── */
  var mapSummary = $("mapSummary");
  if (mapSummary) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.attributeName === "hidden" && !mapSummary.hidden) {
          addAlertAnim(mapSummary);
        }
      });
    }).observe(mapSummary, { attributes: true });
  }

  /* ── Scroll-reveal for footer ────────────────────────────── */
  var footer = document.querySelector("footer");
  if (footer) {
    footer.classList.add("reveal");
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      io.observe(footer);
    } else {
      footer.classList.add("visible");
    }
  }

  /* ── Navbar: highlight active on scroll ──────────────────── */
  var navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", function () {
    if (navbar) {
      navbar.classList.toggle("shadow", window.scrollY > 10);
    }
  }, { passive: true });

  /* ── Loading overlay API (used by app.js shimming) ──────── */
  window.ecMotion = {
    showLoader: function (msg) {
      var ov = $("loadingOverlay");
      var txt = $("overlayMsg");
      if (!ov) return;
      if (txt) txt.textContent = msg || "Processing…";
      ov.hidden = false;
    },
    hideLoader: function () {
      var ov = $("loadingOverlay");
      if (!ov) return;
      ov.style.opacity = "0";
      ov.style.transition = "opacity 0.25s ease";
      setTimeout(function () {
        ov.hidden = true;
        ov.style.opacity = "";
        ov.style.transition = "";
      }, 260);
    },
  };

  /* Intercept file processing to show/hide loader */
  var fileInput = $("fileInput");
  var dropzone  = $("dropzone");

  function onFileStart() { window.ecMotion.showLoader("Reading file…"); }
  function onFileEnd()   {
    // app.js is synchronous with SheetJS; hide after it's done painting
    setTimeout(window.ecMotion.hideLoader, 400);
  }

  if (fileInput) fileInput.addEventListener("change", function () { onFileStart(); setTimeout(onFileEnd, 50); });
  if (dropzone)  dropzone.addEventListener("drop",   function () { onFileStart(); setTimeout(onFileEnd, 50); });

})();
