/* ============================================================
   Excel Cleaner — Knowledge Chatbot (offline, 100% client-side)

   Features:
   - Self-bootstraps on load (builds its own DOM, no HTML changes
     needed beyond <link> + <script>).
   - Knowledge base of ~25 topics about the Excel Cleaner app.
   - Smart keyword/intent matcher with synonym expansion + fuzzy
     scoring. Suggests related topics when no good match.
   - Persists chat history + open state across page navigation
     via sessionStorage.
   - Theme-aware (light / dark / editorial).
   - Quick-action chips for navigation (e.g. open password helper).

   No external dependencies. No API keys. No network calls.
   ============================================================ */

(function () {
  "use strict";

  // ── 1. Knowledge base ────────────────────────────────────
  // Each entry: id, keywords, answer (HTML allowed), actions[] (optional)
  // Keywords are case-insensitive. Multi-word phrases get a higher score
  // when matched as a unit.
  var KB = [
    {
      id: "greeting",
      keywords: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "yo", "greetings"],
      answer: "Hi! I'm the <strong>Excel Cleaner</strong> assistant. Ask me anything about uploading files, mapping columns, downloading cleaned data, themes, or resetting your password.",
      actions: [
        { label: "What does this app do?", ask: "What does Excel Cleaner do?" },
        { label: "How do I upload a file?", ask: "How do I upload a file?" },
        { label: "Forgot my password", ask: "How do I reset my password?" }
      ]
    },

    {
      id: "about",
      keywords: ["what is", "what does", "what's this", "purpose", "excel cleaner", "this app", "this tool", "what can you do", "explain", "about"],
      answer: "<strong>Excel Cleaner</strong> is a private, browser-based tool that cleans, maps, and standardises client lead data. You drop in an Excel/CSV file, the app auto-detects columns, you confirm the mapping plus any per-campaign defaults, then download a clean, standardised <code>.xlsx</code> ready for downstream use. <strong>Everything runs in your browser</strong> — no upload, no server, no tracking."
    },

    {
      id: "workflow",
      keywords: ["how to use", "workflow", "steps", "how does it work", "how do i use", "process", "instructions", "guide", "tutorial"],
      answer: "It's a 3-page flow:<ul><li><strong>Upload</strong> — drop one or more Excel/CSV files. Multiple files are merged automatically into a single dataset.</li><li><strong>Map &amp; Clean</strong> — confirm auto-detected columns and set per-campaign defaults (Lead Status, Product).</li><li><strong>Preview &amp; Download</strong> — review the cleaned data, then click <strong>Download .xlsx</strong> to get a single combined output sheet.</li></ul>After download you're returned to the Upload page automatically.",
      actions: [
        { label: "Open Upload", href: "index.html" }
      ]
    },

    {
      id: "upload",
      keywords: ["upload", "drop", "drag", "open file", "add file", "select file", "load file", "import", "multiple files", "multi file", "many files", "merge", "combine", "consolidate"],
      answer: "On the Upload page you can <strong>drag &amp; drop one or more files</strong> onto the dashed area, or click <strong>Browse</strong> to pick them (Ctrl-click for multi-select). Supported formats: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>.<br/><br/>Each file appears in the <strong>Files to merge</strong> list with its own sheet picker (the first non-empty sheet is auto-selected) and a remove button. When you click <strong>Process Files</strong>, all rows from all files are merged into a single dataset and the column dropdowns on the next page show every detected column across all files.",
      actions: [{ label: "Open Upload", href: "index.html" }]
    },

    {
      id: "merge_logic",
      keywords: ["merge", "combine", "consolidate", "different columns", "different headers", "union", "intersection", "files have different"],
      answer: "When you upload multiple files, Excel Cleaner takes the <strong>union</strong> of their columns — every distinct header from every file is preserved, in first-seen order. Rows from a file that doesn't have a particular column get a blank for that cell. Rows are concatenated in the order the files were added.<br/><br/>If your files all have the same headers (the common case), the merge is seamless: you just see the combined row count.<br/><br/>If headers differ between files (e.g. <em>'Phone'</em> in one and <em>'Mobile Number'</em> in another), both columns appear in the mapping dropdown — pick the one that matches the output you want."
    },

    {
      id: "formats",
      keywords: ["format", "supported", "supported formats", "xlsx", "xls", "csv", "file type", "type of file", "accepts", "what files"],
      answer: "Excel Cleaner accepts <code>.xlsx</code>, <code>.xls</code>, and <code>.csv</code> files. They're parsed locally with SheetJS — never uploaded anywhere."
    },

    {
      id: "mapping",
      keywords: ["map", "mapping", "column", "columns", "match", "auto map", "auto-map", "auto-mapping", "header", "headers"],
      answer: "On the <strong>Map &amp; Clean</strong> page each output column has a dropdown of your file's columns. The app tries to <strong>auto-detect</strong> matches by header name (e.g. <em>'first name'</em>, <em>'fname'</em>, <em>'given name'</em> all map to <code>FirstName</code>). You can override any auto-pick. Sample values appear next to each dropdown so you can confirm the mapping is right."
    },

    {
      id: "fixed_values",
      keywords: ["campaign", "default", "default value", "lead status", "product", "fixed", "per-campaign", "per campaign", "constant"],
      answer: "<strong>Per-campaign / default values</strong> let you stamp every row with the same value for fields that are constant for this batch — typically <strong>Lead Status</strong> and <strong>Product</strong>. Fill them once on the Map &amp; Clean page and they apply to every row in the output."
    },

    {
      id: "preview",
      keywords: ["preview", "see", "check", "before download", "review", "look at"],
      answer: "On the <strong>Preview &amp; Download</strong> page you'll see: how many rows were kept, how many were dropped (empty rows), how many had warnings, an issue banner if something needs your attention, and a sample of the first rows of the cleaned table. If it all looks right, click <strong>Download .xlsx</strong>."
    },

    {
      id: "download",
      keywords: ["download", "save", "export", "xlsx output", "download xlsx", "get file", "save file", "output"],
      answer: "Click the big <strong>Download .xlsx</strong> button on the Preview page. The cleaned file is generated entirely in your browser and saved to your downloads folder. After download you'll be returned to the Upload page automatically so you can process the next file."
    },

    {
      id: "privacy",
      keywords: ["privacy", "private", "secure", "security", "data", "send", "upload to server", "where does data go", "is it safe", "tracking", "cloud", "stored", "leak"],
      answer: "<strong>Your data never leaves your browser.</strong> All parsing, mapping, cleaning, and export happens locally with the SheetJS library. There is no server-side processing, no tracking, no cookies, no analytics. You can disconnect from the internet after the page loads and the entire app still works."
    },

    {
      id: "themes",
      keywords: ["theme", "dark", "light", "appearance", "mode", "editorial", "color", "colour", "look", "switch theme", "auto theme"],
      answer: "Click the <strong>theme toggle</strong> in the top-right of any page. Four modes are available:<ul><li><strong>Light</strong> — clean white surfaces.</li><li><strong>Dark</strong> — neutral charcoal with purple brand accents.</li><li><strong>Auto</strong> — follows your system preference.</li><li><strong>Editorial</strong> — minimalist serif typography for focused work.</li></ul>You can also press <strong>T</strong> to cycle through them."
    },

    {
      id: "password_reset",
      keywords: ["password", "reset", "forgot", "change password", "rotate password", "new password", "lost password", "reset password", "forgot password", "credentials"],
      answer: "Excel Cleaner has no self-service password reset (it has no backend, no email, no user database). The login uses a <strong>single shared credential</strong> for the team. If you've forgotten the password, please <strong>contact your BCX-Telkom administrator</strong> — they can rotate it and share the new one with you."
    },

    {
      id: "login",
      keywords: ["login", "log in", "sign in", "signin", "authenticate", "credentials"],
      answer: "Sign-in uses a single shared username + password whose <strong>SHA-256 hashes</strong> are baked into <code>login.js</code>. The plaintext password is never stored anywhere. The app remembers your session in <code>sessionStorage</code> until you sign out or close the tab."
    },

    {
      id: "signout",
      keywords: ["sign out", "signout", "logout", "log out", "exit", "leave"],
      answer: "Click the <strong>Sign out</strong> button in the top-right of any page (next to the theme toggle). It clears your session and any in-progress data (<code>ec-data</code>, <code>ec-form</code>, <code>ec-output</code>) and returns you to the login page."
    },

    {
      id: "sheets",
      keywords: ["sheet", "tab", "multi sheet", "multi-sheet", "multiple sheets", "workbook", "which sheet"],
      answer: "When a workbook has multiple sheets, Excel Cleaner <strong>auto-picks the first non-empty sheet</strong>. If that's wrong, every file in the <strong>Files to merge</strong> list has its own <em>Sheet:</em> dropdown — switch it and the row/column counts update immediately."
    },

    {
      id: "comma_split",
      keywords: ["comma", "split", "packed", "single cell", "comma separated in cell", "auto split", "concatenated"],
      answer: "If a single cell contains comma-packed data (e.g. <em>'John, Smith, john@x.com, 555-1234'</em> all crammed into one cell), Excel Cleaner detects it and offers to <strong>auto-split</strong> those values across the right columns. You can decline and map normally if you'd rather."
    },

    {
      id: "cleaning",
      keywords: ["clean", "cleaning", "trim", "whitespace", "empty rows", "remove", "strip", "blank rows", "what does cleaning do"],
      answer: "During processing the app:<ul><li><strong>Trims</strong> leading and trailing whitespace from every cell.</li><li><strong>Drops</strong> fully empty rows.</li><li><strong>Splits full names</strong> into First / Last when only one combined column exists.</li><li><strong>Normalises mobile numbers</strong> to international format (e.g. <code>0821234567</code> → <code>+27821234567</code>); spaces, dashes and brackets are stripped.</li><li><strong>Reorders</strong> columns into a standardised output schema.</li><li><strong>Stamps</strong> per-campaign defaults onto every row.</li></ul>"
    },

    {
      id: "names",
      keywords: ["name", "full name", "first name", "last name", "split name", "given name", "surname", "fname", "lname"],
      answer: "If your file has only a single <strong>Full Name</strong> column, Excel Cleaner splits it on the first space — everything before is the first name, everything after is the last name. If you already have separate <code>FirstName</code> and <code>LastName</code> columns, those are used as-is."
    },

    {
      id: "browser",
      keywords: ["browser", "chrome", "firefox", "edge", "safari", "support", "compatible", "which browser", "ie", "internet explorer"],
      answer: "Excel Cleaner works in any modern browser: <strong>Chrome, Edge, Firefox, Safari</strong> (last 2 years of releases). It uses the Web Crypto API for password hashing, which is not available in Internet Explorer. Mobile browsers work too but the desktop experience is recommended for larger files."
    },

    {
      id: "tech",
      keywords: ["tech", "stack", "built", "technology", "javascript", "sheetjs", "bootstrap", "framework", "what is it built with", "language"],
      answer: "Built by <strong>BCX-Telkom</strong> using plain HTML, CSS, and JavaScript (no build step), with <strong>Bootstrap 5</strong> for layout and <strong>SheetJS</strong> for Excel/CSV parsing and writing. Auth uses the browser's Web Crypto API for SHA-256."
    },

    {
      id: "issues",
      keywords: ["error", "bug", "problem", "broken", "not working", "issue", "trouble", "failed", "crash", "stuck", "wont", "won't"],
      answer: "Quick checks:<ul><li>File too large? Excel Cleaner runs in your browser's memory — files over ~50 MB may be slow.</li><li>Wrong sheet? Re-upload and pick the correct sheet.</li><li>Mapping looks off? Manually override the dropdowns on the Map &amp; Clean page.</li><li>Stale UI? Press <strong>Ctrl + F5</strong> for a hard refresh.</li><li>Stuck mid-flow? Click <strong>Use a different file</strong> on any page to reset.</li></ul>"
    },

    {
      id: "limit",
      keywords: ["limit", "size", "rows", "max", "maximum", "large file", "how big", "memory"],
      answer: "There's no hard row limit — it's bounded by your browser's available memory. Files with up to ~100,000 rows process comfortably on a modern laptop. For very large files (500k+ rows) consider splitting them first."
    },

    {
      id: "reset",
      keywords: ["start over", "reset", "new file", "different file", "clear", "restart", "begin again"],
      answer: "Click <strong>Use a different file</strong> on the Process or Preview page. That clears your session data and sends you back to the Upload page so you can start fresh.",
      actions: [{ label: "Open Upload", href: "index.html" }]
    },

    {
      id: "shortcut",
      keywords: ["shortcut", "keyboard", "hotkey", "key", "keys"],
      answer: "Handy shortcuts:<ul><li><strong>T</strong> — cycle theme (Light → Dark → Editorial → Auto).</li><li><strong>Esc</strong> — close this chat panel.</li><li><strong>Enter</strong> — submit your message in the chat or sign-in form.</li><li><strong>Ctrl + F5</strong> — hard refresh if anything looks stale.</li></ul>"
    },

    {
      id: "who_made",
      keywords: ["who made", "who built", "author", "company", "vendor", "support", "contact", "help me", "credits"],
      answer: "Excel Cleaner is built and maintained by <strong>BCX-Telkom</strong> as an internal tool for cleaning lead data. For support or feature requests, reach out to your BCX-Telkom contact."
    },

    {
      id: "thanks",
      keywords: ["thanks", "thank you", "thx", "ty", "appreciated", "cheers"],
      answer: "Anytime. Anything else you'd like to know about Excel Cleaner?"
    }
  ];

  // ── 2. Stopwords (ignored when matching) ─────────────────
  var STOPWORDS = {
    "a":1,"an":1,"the":1,"is":1,"are":1,"was":1,"were":1,"be":1,"been":1,
    "to":1,"of":1,"in":1,"on":1,"at":1,"for":1,"with":1,"by":1,"from":1,
    "and":1,"or":1,"but":1,"so":1,"if":1,"then":1,"than":1,
    "i":1,"you":1,"me":1,"my":1,"your":1,"we":1,"us":1,"our":1,"it":1,"its":1,
    "do":1,"does":1,"did":1,"doing":1,"done":1,
    "can":1,"could":1,"would":1,"should":1,"may":1,"might":1,"will":1,"shall":1,
    "have":1,"has":1,"had":1,"having":1,
    "this":1,"that":1,"these":1,"those":1,
    "what":1,"how":1,"why":1,"when":1,"where":1,"which":1,"who":1,
    "please":1,"just":1,"about":1,"some":1,"any":1,"all":1,"there":1,"here":1
  };

  // ── 3. Suggested questions (also shown on first open) ────
  var SUGGESTIONS = [
    "What does this app do?",
    "How do I upload a file?",
    "How does column mapping work?",
    "Where is my data sent?",
    "How do I reset my password?",
    "How do I change the theme?"
  ];

  // ── 4. Intent matching ───────────────────────────────────
  function tokenize(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^\w\s']/g, " ")
      .split(/\s+/)
      .filter(function (t) { return t && !STOPWORDS[t]; });
  }

  function scoreEntry(query, entry) {
    var q = (query || "").toLowerCase();
    var qTokens = tokenize(query);
    var qSet = {};
    qTokens.forEach(function (t) { qSet[t] = true; });

    var score = 0;
    for (var i = 0; i < entry.keywords.length; i++) {
      var kw = entry.keywords[i].toLowerCase();
      // Phrase keyword: bonus if the whole phrase appears in the query.
      if (kw.indexOf(" ") !== -1) {
        if (q.indexOf(kw) !== -1) score += 6;
        // Also count token overlap so partial phrase wins something.
        var kwTokens = tokenize(kw);
        var hits = 0;
        for (var j = 0; j < kwTokens.length; j++) {
          if (qSet[kwTokens[j]]) hits++;
        }
        score += hits * 2;
      } else {
        if (qSet[kw]) score += 3;
        // Substring fallback for things like "logging" → "log".
        else if (kw.length >= 4 && q.indexOf(kw) !== -1) score += 2;
      }
    }
    return score;
  }

  function bestMatch(query) {
    if (!query || !query.trim()) return null;
    var best = null, bestScore = 0;
    for (var i = 0; i < KB.length; i++) {
      var s = scoreEntry(query, KB[i]);
      if (s > bestScore) { bestScore = s; best = KB[i]; }
    }
    if (best && bestScore >= 3) return best;
    return null;
  }

  function suggestRelated(query) {
    // Return the top-3 entries by score even when below the threshold,
    // so we can offer them as "did you mean…" chips.
    var ranked = KB.map(function (e) {
      return { e: e, s: scoreEntry(query, e) };
    }).filter(function (r) { return r.s > 0 && r.e.id !== "greeting" && r.e.id !== "thanks"; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 3)
      .map(function (r) { return r.e; });
    return ranked;
  }

  // ── 5. Persistence ───────────────────────────────────────
  var STATE_KEY  = "ec-bot-state";    // { open: bool }
  var HIST_KEY   = "ec-bot-history";  // [{ role: "bot"|"user", text, actions? }]

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(HIST_KEY);
      if (!raw) return null;
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch (_) { return null; }
  }
  function saveHistory(h) {
    try { sessionStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (_) {}
  }
  function loadOpen() {
    try { return sessionStorage.getItem(STATE_KEY) === "1"; } catch (_) { return false; }
  }
  function saveOpen(v) {
    try { sessionStorage.setItem(STATE_KEY, v ? "1" : "0"); } catch (_) {}
  }

  // ── 6. DOM helpers ───────────────────────────────────────
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k === "html") e.innerHTML = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (html != null) e.innerHTML = html;
    return e;
  }

  // Light HTML sanitiser for user input (we only echo their text).
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── 7. Build & manage the widget ─────────────────────────
  function buildWidget() {
    if (document.getElementById("ecBotBubble")) return; // already built

    // Bubble
    var bubble = el("button", {
      id: "ecBotBubble",
      class: "ec-bot-bubble",
      type: "button",
      "aria-label": "Open Excel Cleaner assistant"
    });
    bubble.innerHTML =
      '<span class="ec-bot-bubble-pulse"></span>' +
      '<i class="bi bi-chat-dots-fill ec-bot-bubble-icon"></i>' +
      '<i class="bi bi-x-lg ec-bot-bubble-close"></i>';

    // Panel
    var panel = el("div", {
      id: "ecBotPanel",
      class: "ec-bot-panel",
      role: "dialog",
      "aria-label": "Excel Cleaner assistant",
      "aria-hidden": "true"
    });
    panel.innerHTML =
      '<div class="ec-bot-header">' +
        '<div class="ec-bot-avatar"><i class="bi bi-robot"></i></div>' +
        '<div class="ec-bot-title">' +
          '<h3>Excel Cleaner Assistant</h3>' +
          '<p>Online · Ask me anything</p>' +
        '</div>' +
        '<div class="ec-bot-header-actions">' +
          '<button type="button" class="ec-bot-header-btn" id="ecBotReset" title="Clear chat" aria-label="Clear chat">' +
            '<i class="bi bi-arrow-counterclockwise"></i>' +
          '</button>' +
          '<button type="button" class="ec-bot-header-btn" id="ecBotClose" title="Close" aria-label="Close">' +
            '<i class="bi bi-dash-lg"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ec-bot-messages" id="ecBotMessages" aria-live="polite"></div>' +
      '<div class="ec-bot-chips" id="ecBotChips"></div>' +
      '<div class="ec-bot-input-wrap">' +
        '<form class="ec-bot-input-row" id="ecBotForm" autocomplete="off">' +
          '<input type="text" class="ec-bot-input" id="ecBotInput" placeholder="Ask about Excel Cleaner…" aria-label="Type your question" />' +
          '<button type="submit" class="ec-bot-send" id="ecBotSend" aria-label="Send" title="Send">' +
            '<i class="bi bi-send-fill"></i>' +
          '</button>' +
        '</form>' +
        '<div class="ec-bot-footer-note">Runs locally · Trained on Excel Cleaner docs</div>' +
      '</div>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    // Wire interactions
    var msgsEl   = panel.querySelector("#ecBotMessages");
    var chipsEl  = panel.querySelector("#ecBotChips");
    var formEl   = panel.querySelector("#ecBotForm");
    var inputEl  = panel.querySelector("#ecBotInput");
    var sendEl   = panel.querySelector("#ecBotSend");
    var closeEl  = panel.querySelector("#ecBotClose");
    var resetEl  = panel.querySelector("#ecBotReset");

    function setOpen(open) {
      if (open) {
        panel.classList.add("is-open");
        bubble.classList.add("is-open");
        panel.setAttribute("aria-hidden", "false");
        setTimeout(function () { inputEl.focus(); }, 250);
      } else {
        panel.classList.remove("is-open");
        bubble.classList.remove("is-open");
        panel.setAttribute("aria-hidden", "true");
      }
      saveOpen(open);
    }

    bubble.addEventListener("click", function () {
      setOpen(!panel.classList.contains("is-open"));
    });
    closeEl.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        setOpen(false);
        bubble.focus();
      }
    });

    resetEl.addEventListener("click", function () {
      msgsEl.innerHTML = "";
      saveHistory([]);
      seedWelcome();
    });

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = inputEl.value.trim();
      if (!q) return;
      inputEl.value = "";
      handleUserMessage(q);
    });

    chipsEl.addEventListener("click", function (e) {
      var chip = e.target.closest(".ec-bot-chip");
      if (!chip) return;
      var q = chip.getAttribute("data-ask");
      if (!q) return;
      handleUserMessage(q);
    });

    msgsEl.addEventListener("click", function (e) {
      var act = e.target.closest("[data-ask]");
      if (act) {
        e.preventDefault();
        handleUserMessage(act.getAttribute("data-ask"));
      }
    });

    // ── Rendering ──────────────────────────────────────────
    function appendMessage(role, html, actions) {
      var wrap = el("div", { class: "ec-bot-msg " + (role === "user" ? "is-user" : "is-bot") });
      var avatar = el("div", { class: "ec-bot-msg-avatar" });
      avatar.innerHTML = role === "user"
        ? '<i class="bi bi-person-fill"></i>'
        : '<i class="bi bi-robot"></i>';
      var bubble = el("div", { class: "ec-bot-msg-bubble" });
      bubble.innerHTML = html;

      if (actions && actions.length) {
        var actionsEl = el("div", { class: "ec-bot-msg-actions" });
        actions.forEach(function (a) {
          var node;
          if (a.href) {
            node = el("a", {
              class: "ec-bot-msg-action",
              href: a.href,
              target: a.external ? "_blank" : "_self",
              rel: a.external ? "noopener" : ""
            });
            node.innerHTML = '<i class="bi bi-box-arrow-up-right"></i> ' + escapeHtml(a.label);
          } else if (a.ask) {
            node = el("button", {
              class: "ec-bot-msg-action",
              type: "button",
              "data-ask": a.ask
            });
            node.innerHTML = '<i class="bi bi-arrow-right-short"></i> ' + escapeHtml(a.label);
          }
          if (node) actionsEl.appendChild(node);
        });
        bubble.appendChild(actionsEl);
      }

      wrap.appendChild(avatar);
      wrap.appendChild(bubble);
      msgsEl.appendChild(wrap);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      return wrap;
    }

    function appendTyping() {
      var wrap = el("div", { class: "ec-bot-msg is-bot", id: "ecBotTypingMsg" });
      wrap.innerHTML =
        '<div class="ec-bot-msg-avatar"><i class="bi bi-robot"></i></div>' +
        '<div class="ec-bot-msg-bubble" style="padding:0;"><div class="ec-bot-typing"><span></span><span></span><span></span></div></div>';
      msgsEl.appendChild(wrap);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      return wrap;
    }

    function clearTyping() {
      var t = document.getElementById("ecBotTypingMsg");
      if (t) t.remove();
    }

    function renderChips(items) {
      chipsEl.innerHTML = "";
      if (!items || !items.length) return;
      items.forEach(function (q) {
        var c = el("button", {
          class: "ec-bot-chip",
          type: "button",
          "data-ask": q
        }, escapeHtml(q));
        chipsEl.appendChild(c);
      });
    }

    // ── Conversation flow ──────────────────────────────────
    function pushHistory(role, html, actions) {
      var hist = loadHistory() || [];
      hist.push({ role: role, html: html, actions: actions || null });
      // cap history to last 80 messages
      if (hist.length > 80) hist = hist.slice(-80);
      saveHistory(hist);
    }

    function botSay(html, actions, opts) {
      opts = opts || {};
      if (opts.skipTyping) {
        appendMessage("bot", html, actions);
        if (!opts.skipPersist) pushHistory("bot", html, actions);
        return;
      }
      appendTyping();
      setTimeout(function () {
        clearTyping();
        appendMessage("bot", html, actions);
        if (!opts.skipPersist) pushHistory("bot", html, actions);
      }, 380 + Math.min(700, html.length * 4));
    }

    function handleUserMessage(text) {
      var safe = escapeHtml(text);
      appendMessage("user", safe);
      pushHistory("user", safe);
      // Hide chips after first interaction
      renderChips([]);

      var match = bestMatch(text);
      if (match) {
        botSay(match.answer, match.actions);
      } else {
        var suggested = suggestRelated(text);
        if (suggested.length) {
          var actions = suggested.map(function (e) {
            return { label: titleForEntry(e), ask: titleForEntry(e) };
          });
          botSay(
            "I'm not sure I understood that. Did you mean one of these?",
            actions
          );
        } else {
          botSay(
            "I don't have an answer for that yet. Try asking about <strong>uploading</strong>, <strong>column mapping</strong>, <strong>downloading</strong>, <strong>privacy</strong>, <strong>themes</strong>, or <strong>passwords</strong>.",
            SUGGESTIONS.slice(0, 4).map(function (s) { return { label: s, ask: s }; })
          );
        }
      }
    }

    function titleForEntry(e) {
      // Pick a reasonable title from the first phrase keyword, otherwise the id.
      var phrase = (e.keywords || []).find(function (k) { return k.indexOf(" ") !== -1; });
      var src = phrase || e.id.replace(/_/g, " ");
      return src.charAt(0).toUpperCase() + src.slice(1) + "?";
    }

    function seedWelcome() {
      var welcome =
        "Hi there! I'm the <strong>Excel Cleaner</strong> assistant. I can answer questions about how the app works, file formats, mapping, downloads, themes, passwords, and more.<br/><br/>What would you like to know?";
      botSay(welcome, null, { skipTyping: true });
      renderChips(SUGGESTIONS);
    }

    function restoreHistory() {
      var hist = loadHistory();
      if (!hist || !hist.length) {
        seedWelcome();
        return;
      }
      hist.forEach(function (m) {
        appendMessage(m.role, m.html, m.actions);
      });
      // Hide chips if user already engaged
      var hasUser = hist.some(function (m) { return m.role === "user"; });
      if (!hasUser) renderChips(SUGGESTIONS);
    }

    // ── Boot ───────────────────────────────────────────────
    restoreHistory();
    if (loadOpen()) setOpen(true);
  }

  // ── 8. Init when DOM ready ───────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }
})();
