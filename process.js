/* process.js — Steps 2-3: Mapping + Per-campaign defaults
 * Reads parsed data placed in sessionStorage by upload.js.
 * On "Preview & Download": builds output, saves it to sessionStorage and
 * navigates to preview.html where Step 4 takes over.
 */
(function () {
  "use strict";

  // ---------- Configuration ----------
  const MANDATORY_COLUMNS = [
    "Lead Status",
    "First Name",
    "Last Name",
    "E-mail address",
    "Product / Service / Solution",
    "Mobile",
    "Company Name",
  ];
  const FIXED_VALUE_COLUMNS = new Set([
    "Lead Status",
    "Product / Service / Solution",
  ]);
  const IGNORE_OPTION = "__ignore__";
  const FIXED_OPTION  = "__fixed__";

  // Built-in fallback used when the user-supplied default mobile is itself
  // empty or invalid. Keeping a hard-coded floor means we always have *some*
  // sensible value to fall back to.
  const DEFAULT_MOBILE = "0817389834";
  // Minimum number of digits a Mobile value must contain to be considered valid.
  const MIN_MOBILE_DIGITS = 10;

  // ---------- Load handed-off data ----------
  let payload = null;
  try { payload = JSON.parse(sessionStorage.getItem("ec-data") || "null"); }
  catch (_) { payload = null; }

  if (!payload || !Array.isArray(payload.inputRows) || payload.inputRows.length === 0) {
    window.location.replace("index.html");
    return;
  }

  // ---------- State ----------
  const inputRows    = payload.inputRows;
  const inputColumns = (payload.inputColumns || []).map((c) => String(c || "").trim());
  const fileName     = payload.fileName || "Uploaded file";
  const sheetName    = payload.sheetName || "";
  const filesMeta    = Array.isArray(payload.files) ? payload.files : null;

  let mapping = {};
  let lastBuiltRows = null;
  let lastStats = null;
  let fullNameColumn = findFullNameColumn(inputColumns);

  // Restore previously-saved mapping/fixed values when navigating back
  let savedForm = null;
  try { savedForm = JSON.parse(sessionStorage.getItem("ec-form") || "null"); }
  catch (_) { savedForm = null; }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const fileBadgeName  = $("procFileName");
  const fileBadgeMeta  = $("procFileMeta");
  const mappingTbody   = $("mappingTbody");
  const mapSummary     = $("mapSummary");
  const mapSummaryText = $("mapSummaryText");
  const fixedLeadStatus= $("fixedLeadStatus");
  const fixedProduct   = $("fixedProduct");
  const fixedMobile    = $("fixedMobile");
  const fixedMobileWarn= $("fixedMobileWarn");
  const goPreviewBtn   = $("goPreviewBtn");
  const previewReadyText = $("previewReadyText");
  const previewMiniStats = $("previewMiniStats");
  const miniKept       = $("miniKept");
  const miniDropped    = $("miniDropped");
  const miniIssues     = $("miniIssues");

  // ---------- Helpers ----------
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function isEmpty(v) {
    if (v == null) return true;
    return String(v).trim() === "";
  }

  // Normalize a SA mobile number to international (+27) format.
  // Strips common formatting chars first (spaces, dashes, parens, dots), then:
  //   - 0XXXXXXXXX (10 digits, leading 0)  → +27XXXXXXXXX
  //   - XXXXXXXXX  (exactly 9 digits, no 0) → +27XXXXXXXXX
  //   - anything else is returned as-is (cleaned).
  function normalizeMobile(raw) {
    if (raw == null) return "";
    var s = String(raw).replace(/[\s\-().]/g, "");
    if (!s) return "";
    if (s.charAt(0) === "0" && /^\d+$/.test(s)) {
      return "+27" + s.slice(1);
    }
    if (/^\d{9}$/.test(s)) {
      return "+27" + s;
    }
    return s;
  }

  // A mobile value is considered valid only if:
  //   - it is non-empty,
  //   - it contains no letters, and
  //   - it has at least MIN_MOBILE_DIGITS digits (after stripping separators).
  // Anything failing these checks is replaced by the user-supplied
  // default mobile in Step 3 (or the hard-coded DEFAULT_MOBILE if that
  // default is itself invalid).
  function isValidMobileRaw(raw) {
    if (raw == null) return false;
    var s = String(raw).trim();
    if (s === "") return false;
    if (/[A-Za-z]/.test(s)) return false;
    var digits = s.replace(/\D/g, "");
    return digits.length >= MIN_MOBILE_DIGITS;
  }

  function findFullNameColumn(cols) {
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const prefs = ["fullname", "contactname", "leadname", "name", "displayname", "customername"];
    for (const p of prefs) {
      for (const c of cols) {
        if (norm(c) === p) return c;
      }
    }
    return null;
  }

  function guessInputColumn(outputName, candidates) {
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const target = norm(outputName);
    for (const c of candidates) {
      if (norm(c) === target) return c;
    }
    const aliases = {
      "emailaddress": ["email", "emailid", "emailaddress", "workemail", "mail", "mailid", "emailaddr"],
      "mobile": ["mobile", "phone", "phonenumber", "mobilenumber", "mobileno", "cell", "contact", "contactnumber", "contactno", "ph", "phoneno"],
      "firstname": ["firstname", "fname", "givenname"],
      "lastname": ["lastname", "lname", "surname", "familyname"],
      "companyname": ["company", "companyname", "organization", "organisation", "account", "accountname", "org"],
      "jobtitle": ["jobtitle", "title", "designation", "role", "position"],
      "leadowner": ["leadowner", "owner", "assignedto", "salesrep", "salesowner"],
      "leadcategory": ["leadcategory", "category", "type", "leadtype"],
      "leadsource": ["leadsource", "source", "channel", "formname", "campaignname", "campaign"],
    };
    const list = aliases[target] || [];
    for (const c of candidates) {
      if (list.includes(norm(c))) return c;
    }
    return null;
  }

  // ---------- File-info badge ----------
  function renderFileBadge() {
    if (fileBadgeName) fileBadgeName.textContent = fileName;
    if (fileBadgeMeta) {
      const rowWord = inputRows.length === 1 ? "row" : "rows";
      const colWord = inputColumns.length === 1 ? "column" : "columns";
      let suffix = "";
      if (filesMeta && filesMeta.length > 1) {
        suffix = "  ·  Merged from " + filesMeta.length + " files";
      } else if (sheetName) {
        suffix = "  ·  Sheet: " + sheetName;
      }
      fileBadgeMeta.textContent =
        inputRows.length + " " + rowWord + "  ·  " +
        inputColumns.length + " " + colWord + suffix;
      fileBadgeMeta.title = filesMeta && filesMeta.length > 1
        ? filesMeta.map(function (f) { return f.name + " (" + f.rows + " rows)"; }).join("\n")
        : "";
    }
  }

  // ---------- Mapping UI ----------
  function renderMapping() {
    mapping = {};
    mappingTbody.innerHTML = "";
    let autoMatchCount = 0;
    const restored = (savedForm && savedForm.mapping) ? savedForm.mapping : null;

    MANDATORY_COLUMNS.forEach((col) => {
      const tr = document.createElement("tr");
      const tdLabel = document.createElement("td");
      const tdSelect = document.createElement("td");
      const tdSample = document.createElement("td");
      tdSample.className = "sample-cell";

      const isFixed = FIXED_VALUE_COLUMNS.has(col);
      const restoredChoice = restored ? restored[col] : null;
      const guess = isFixed ? null : guessInputColumn(col, inputColumns);

      tdLabel.innerHTML =
        "<strong>" + escapeHtml(col) + "</strong>" +
        '<span class="req-star">*</span>' +
        (isFixed ? '<span class="fixed-badge">fixed value</span>' : "") +
        (guess && !restoredChoice ? '<span class="auto-badge" title="Auto-matched to input column: ' + escapeHtml(guess) + '">auto-matched</span>' : "");

      const sel = document.createElement("select");
      sel.className = "form-select form-select-sm";
      sel.dataset.output = col;

      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "-- select input column --";
      sel.appendChild(defaultOpt);

      if (isFixed) {
        const fOpt = document.createElement("option");
        fOpt.value = FIXED_OPTION;
        fOpt.textContent = "-- use fixed value (Step 3) --";
        sel.appendChild(fOpt);
      }

      const iOpt = document.createElement("option");
      iOpt.value = IGNORE_OPTION;
      iOpt.textContent = "-- leave blank --";
      sel.appendChild(iOpt);

      const sepOpt = document.createElement("option");
      sepOpt.disabled = true;
      sepOpt.textContent = "────────";
      sel.appendChild(sepOpt);

      inputColumns.forEach((name) => {
        const o = document.createElement("option");
        o.value = name;
        o.textContent = name;
        sel.appendChild(o);
      });

      // Choose default (restored > fixed default > guess)
      let chosen = null;
      if (restoredChoice) {
        if (restoredChoice === FIXED_OPTION || restoredChoice === IGNORE_OPTION || inputColumns.indexOf(restoredChoice) !== -1) {
          chosen = restoredChoice;
        }
      }
      if (chosen == null) {
        if (isFixed) chosen = FIXED_OPTION;
        else if (guess) { chosen = guess; autoMatchCount++; }
      }
      if (chosen != null) {
        sel.value = chosen;
        mapping[col] = chosen;
      }

      const refreshSample = () => updateSampleCell(tdSample, col, mapping[col]);

      sel.addEventListener("change", () => {
        mapping[col] = sel.value || null;
        const badge = tdLabel.querySelector(".auto-badge");
        if (badge) badge.remove();
        refreshSample();
        recomputeReadiness();
      });

      tdSelect.appendChild(sel);
      tr.appendChild(tdLabel);
      tr.appendChild(tdSelect);
      tr.appendChild(tdSample);
      mappingTbody.appendChild(tr);

      refreshSample();
    });

    const mappableCount = MANDATORY_COLUMNS.filter((c) => !FIXED_VALUE_COLUMNS.has(c)).length;
    mapSummary.hidden = false;
    mapSummaryText.innerHTML =
      "<strong>Auto-matched " + autoMatchCount + " of " + mappableCount + "</strong> mandatory columns based on input column names. " +
      "Review below and override any dropdown where the match isn't right.";
  }

  function sampleValuesForColumn(inputCol, maxCount) {
    const limit = maxCount || 3;
    const seen = new Set();
    const out = [];
    for (const r of inputRows) {
      const v = r[inputCol];
      if (isEmpty(v)) continue;
      const s = String(v).trim();
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= limit) break;
    }
    return out;
  }

  function updateSampleCell(td, outputCol, choice) {
    td.classList.remove("sample-empty");
    if (!choice) {
      td.classList.add("sample-empty");
      td.textContent = "— not selected —";
      return;
    }
    if (choice === IGNORE_OPTION) {
      td.classList.add("sample-empty");
      td.textContent = "— will be blank —";
      return;
    }
    if (choice === FIXED_OPTION) {
      let v = "";
      if (outputCol === "Lead Status") v = (fixedLeadStatus.value || "").trim() || "New";
      else if (outputCol === "Product / Service / Solution") v = (fixedProduct.value || "").trim();
      if (isEmpty(v)) {
        td.classList.add("sample-empty");
        td.textContent = "— enter value in Step 3 —";
      } else {
        td.innerHTML = '<span class="sample-label">fixed:</span>' + escapeHtml(v);
        td.title = v;
      }
      return;
    }
    const samples = sampleValuesForColumn(choice, 3);
    if (samples.length === 0) {
      td.classList.add("sample-empty");
      td.textContent = "— no sample data in this column —";
      td.title = "";
      return;
    }
    const rendered = samples.map((s) => escapeHtml(s)).join(' <span class="sample-sep">·</span> ');
    td.innerHTML = '<span class="sample-label">e.g.</span>' + rendered;
    td.title = samples.join("  |  ");
  }

  function refreshAllSamples() {
    const rows = mappingTbody.querySelectorAll("tr");
    rows.forEach((tr, i) => {
      const col = MANDATORY_COLUMNS[i];
      const td = tr.querySelector(".sample-cell");
      if (td) updateSampleCell(td, col, mapping[col]);
    });
  }

  // ---------- Build / clean ----------
  function buildOutput(opts) {
    opts = opts || {};
    const missingMap = MANDATORY_COLUMNS.filter((c) => !mapping[c]);
    if (missingMap.length > 0) {
      if (!opts.silent) {
        alert("Please pick a choice for every mandatory column:\n\n - " + missingMap.join("\n - "));
      }
      return null;
    }

    const fixedStatus = (fixedLeadStatus.value || "").trim() || "New";
    const fixedProd   = (fixedProduct.value   || "").trim();

    // Resolve which value to use as the Mobile fallback. If the user-set
    // default in Step 3 is itself invalid (empty / has letters / fewer than
    // MIN_MOBILE_DIGITS digits) we fall back to the hard-coded default and
    // surface a warning under the input.
    const userDefaultMobile = (fixedMobile && fixedMobile.value || "").trim();
    const userDefaultIsValid = userDefaultMobile === "" || isValidMobileRaw(userDefaultMobile);
    const effectiveDefaultMobile = (userDefaultMobile && isValidMobileRaw(userDefaultMobile))
      ? userDefaultMobile
      : DEFAULT_MOBILE;
    if (fixedMobileWarn) {
      fixedMobileWarn.hidden = userDefaultIsValid;
    }

    const hasFirstName = MANDATORY_COLUMNS.indexOf("First Name") !== -1;
    const hasLastName  = MANDATORY_COLUMNS.indexOf("Last Name")  !== -1;

    let droppedEmpty = 0;
    let issues = 0;
    let mobileSubstituted = 0;
    const out = [];

    inputRows.forEach((r) => {
      const allEmpty = Object.values(r).every((v) => isEmpty(v));
      if (allEmpty) { droppedEmpty++; return; }

      const row = {};
      let mobileWasSubstituted = false;
      MANDATORY_COLUMNS.forEach((col) => {
        const choice = mapping[col];
        let val = "";
        if (choice === FIXED_OPTION) {
          if (col === "Lead Status") val = fixedStatus;
          else if (col === "Product / Service / Solution") val = fixedProd;
        } else if (choice === IGNORE_OPTION) {
          val = "";
        } else {
          const raw = r[choice];
          val = raw == null ? "" : String(raw).trim();
        }
        if (col === "Mobile") {
          // Substitute with the user-supplied default whenever the row's
          // mobile is empty, has fewer than MIN_MOBILE_DIGITS digits, or
          // contains letters.
          if (!isValidMobileRaw(val)) {
            val = effectiveDefaultMobile;
            mobileWasSubstituted = true;
          }
          val = normalizeMobile(val);
        }
        row[col] = val;
      });

      if (fullNameColumn && ((hasFirstName && isEmpty(row["First Name"])) || (hasLastName && isEmpty(row["Last Name"])))) {
        const full = String(r[fullNameColumn] || "").trim();
        if (full) {
          const parts = full.split(/\s+/).filter(Boolean);
          if (hasFirstName && isEmpty(row["First Name"]) && parts.length) row["First Name"] = parts[0];
          if (hasLastName  && isEmpty(row["Last Name"])  && parts.length > 1) row["Last Name"]  = parts.slice(1).join(" ");
        }
      }

      let rowHasIssue = false;
      MANDATORY_COLUMNS.forEach((col) => { if (isEmpty(row[col])) rowHasIssue = true; });
      if (mobileWasSubstituted) {
        mobileSubstituted++;
        // Internal flag — not part of MANDATORY_COLUMNS, so it is dropped by
        // XLSX.utils.json_to_sheet(rows, { header: COLUMNS }) on export and
        // never reaches the downloaded spreadsheet.
        row.__mobileSubstituted = true;
      }
      if (rowHasIssue) issues++;
      out.push(row);
    });

    lastBuiltRows = out;
    lastStats = {
      total: inputRows.length,
      kept: out.length,
      dropped: droppedEmpty,
      issues,
      mobileSubstituted,
      defaultMobile: effectiveDefaultMobile,
      defaultMobileFromUser: userDefaultIsValid && userDefaultMobile !== "",
    };
    return { rows: out, stats: lastStats };
  }

  // ---------- Readiness panel ----------
  function recomputeReadiness() {
    const allSet = MANDATORY_COLUMNS.every((c) => mapping[c]);
    if (!allSet) {
      goPreviewBtn.disabled = true;
      previewReadyText.textContent = "Pick a value in every mandatory mapping above to enable the next step.";
      previewMiniStats.hidden = true;
      lastBuiltRows = null;
      return;
    }
    const result = buildOutput({ silent: true });
    if (!result || result.rows.length === 0) {
      goPreviewBtn.disabled = true;
      previewReadyText.textContent = "No rows would be kept with the current mapping.";
      previewMiniStats.hidden = true;
      return;
    }
    goPreviewBtn.disabled = false;
    previewReadyText.textContent = "All mandatory columns are mapped. Continue to preview the cleaned data.";
    miniKept.textContent    = result.stats.kept;
    miniDropped.textContent = result.stats.dropped;
    miniIssues.textContent  = result.stats.issues;
    previewMiniStats.hidden = false;
  }

  // ---------- Persist + navigate ----------
  function saveAndGoToPreview() {
    if (goPreviewBtn.disabled) return;
    const result = buildOutput();
    if (!result) return;

    try {
      sessionStorage.setItem("ec-form", JSON.stringify({
        mapping,
        fixedLeadStatus: fixedLeadStatus.value,
        fixedProduct: fixedProduct.value,
        fixedMobile: fixedMobile ? fixedMobile.value : "",
      }));
      sessionStorage.setItem("ec-output", JSON.stringify({
        fileName,
        sheetName,
        columns: MANDATORY_COLUMNS,
        rows: result.rows,
        stats: result.stats,
        builtAt: new Date().toISOString(),
      }));
      window.location.href = "preview.html";
    } catch (err) {
      alert(
        "Could not pass cleaned data to the preview page.\n\n" +
        "It may be too large for browser session storage. Try a smaller file.\n\n" +
        err.message
      );
    }
  }

  // ---------- Restore form state if user navigates back ----------
  if (savedForm) {
    if (typeof savedForm.fixedLeadStatus === "string") fixedLeadStatus.value = savedForm.fixedLeadStatus;
    if (typeof savedForm.fixedProduct   === "string") fixedProduct.value   = savedForm.fixedProduct;
    if (fixedMobile && typeof savedForm.fixedMobile === "string") fixedMobile.value = savedForm.fixedMobile;
  }

  // ---------- Wire up ----------
  goPreviewBtn.addEventListener("click", saveAndGoToPreview);
  fixedLeadStatus.addEventListener("input", () => { refreshAllSamples(); recomputeReadiness(); });
  fixedProduct.addEventListener("input",   () => { refreshAllSamples(); recomputeReadiness(); });
  if (fixedMobile) {
    fixedMobile.addEventListener("input", () => { refreshAllSamples(); recomputeReadiness(); });
  }

  // ---------- Init ----------
  renderFileBadge();
  renderMapping();
  recomputeReadiness();
})();
