/* preview.js — Step 4: Preview & Download
 * Reads cleaned output placed in sessionStorage by process.js.
 */
(function () {
  "use strict";

  // ---------- Load handed-off cleaned data ----------
  let payload = null;
  try { payload = JSON.parse(sessionStorage.getItem("ec-output") || "null"); }
  catch (_) { payload = null; }

  if (!payload || !Array.isArray(payload.rows) || !Array.isArray(payload.columns)) {
    // No cleaned output yet — bounce back to mapping (or upload if no parsed data)
    let parsed = null;
    try { parsed = JSON.parse(sessionStorage.getItem("ec-data") || "null"); }
    catch (_) { parsed = null; }
    if (parsed && Array.isArray(parsed.inputRows) && parsed.inputRows.length) {
      window.location.replace("process.html");
    } else {
      window.location.replace("index.html");
    }
    return;
  }

  const COLUMNS  = payload.columns;
  const ROWS     = payload.rows;
  const STATS    = payload.stats || { total: ROWS.length, kept: ROWS.length, dropped: 0, issues: 0, mobileSubstituted: 0, defaultMobile: "", defaultMobileFromUser: false };
  const FILE     = payload.fileName || "Uploaded file";
  const SHEET    = payload.sheetName || "";
  const FILES    = Array.isArray(payload.files) ? payload.files : null;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const fileBadgeName  = $("procFileName");
  const fileBadgeMeta  = $("procFileMeta");
  const sumTotal       = $("sumTotal");
  const sumKept        = $("sumKept");
  const sumDropped     = $("sumDropped");
  const sumIssues      = $("sumIssues");
  const issueBanner    = $("issueBanner");
  const issueBannerText= $("issueBannerText");
  const downloadBtn    = $("downloadBtn");
  const previewCount   = $("previewCount");
  const previewTable   = $("previewTable");
  const downloadToastEl= $("downloadToast");

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

  // ---------- Render ----------
  function renderFileBadge() {
    if (fileBadgeName) fileBadgeName.textContent = FILE;
    if (fileBadgeMeta) {
      const rowWord = STATS.kept === 1 ? "row" : "rows";
      let suffix = "";
      if (FILES && FILES.length > 1) {
        suffix = "  ·  Merged from " + FILES.length + " files";
      } else if (SHEET) {
        suffix = "  ·  Sheet: " + SHEET;
      }
      fileBadgeMeta.textContent = STATS.kept + " cleaned " + rowWord + suffix;
      fileBadgeMeta.title = FILES && FILES.length > 1
        ? FILES.map(function (f) { return f.name + " (" + f.rows + " rows)"; }).join("\n")
        : "";
    }
  }

  function renderStats() {
    sumTotal.textContent  = STATS.total;
    sumKept.textContent   = STATS.kept;
    sumDropped.textContent= STATS.dropped;
    sumIssues.textContent = STATS.issues;

    const mobileSubstituted = STATS.mobileSubstituted || 0;
    const defaultMobile     = STATS.defaultMobile || "";
    const defaultFromUser   = !!STATS.defaultMobileFromUser;

    if (STATS.issues > 0 || mobileSubstituted > 0) {
      issueBanner.hidden = false;
      const parts = [];
      if (mobileSubstituted > 0) {
        parts.push(
          mobileSubstituted +
          " row" + (mobileSubstituted === 1 ? " was" : "s were") +
          " auto-filled with the default mobile " +
          (defaultMobile || "0817389834") +
          " (because the original mobile was empty, contained letters, or had fewer than 10 digits)" +
          (defaultFromUser ? " — using the default you set in Step 3." : ".")
        );
      }
      if (STATS.issues > 0) {
        parts.push(
          STATS.issues +
          " row" + (STATS.issues === 1 ? "" : "s") +
          " are missing at least one mandatory field. They are still included in the output — missing cells will be empty."
        );
      }
      issueBannerText.textContent = parts.join(" ");
    } else {
      issueBanner.hidden = true;
    }
  }

  function renderPreview() {
    const PREVIEW_N = 20;
    const head = ROWS.slice(0, PREVIEW_N);
    previewCount.textContent = head.length;

    let html = "<thead><tr>";
    COLUMNS.forEach((c) => { html += "<th>" + escapeHtml(c) + "</th>"; });
    html += "</tr></thead><tbody>";

    if (head.length === 0) {
      html += '<tr><td colspan="' + COLUMNS.length + '" style="text-align:center;padding:16px;color:#6b7280;">No rows to show</td></tr>';
    } else {
      head.forEach((r) => {
        html += "<tr>";
        COLUMNS.forEach((c) => {
          const v = r[c];
          if (isEmpty(v)) {
            html += '<td class="missing" title="Missing mandatory field">— missing —</td>';
          } else if (c === "Mobile" && r.__mobileSubstituted) {
            const s = escapeHtml(v);
            html +=
              '<td title="Original mobile was empty, contained letters, or had fewer than 10 digits — auto-filled with the default" ' +
              'style="background-color:#e0f2fe;color:#075985;">' + s +
              ' <span class="badge text-bg-info" style="font-size:0.65rem;vertical-align:middle;">auto-filled</span></td>';
          } else {
            const s = escapeHtml(v);
            html += '<td title="' + s + '">' + s + '</td>';
          }
        });
        html += "</tr>";
      });
    }
    html += "</tbody>";
    previewTable.innerHTML = html;
  }

  // ---------- Download ----------
  function downloadXlsx() {
    if (!ROWS.length) return;

    // Build the workbook
    const ws = XLSX.utils.json_to_sheet(ROWS, { header: COLUMNS });
    const colWidths = COLUMNS.map((c) => {
      let maxLen = c.length;
      ROWS.forEach((r) => {
        const v = r[c] == null ? "" : String(r[c]);
        if (v.length > maxLen) maxLen = v.length;
      });
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cleaned");

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const fileTag = FILES && FILES.length > 1
      ? "combined-" + FILES.length + "files-"
      : "";
    XLSX.writeFile(wb, "cleaned-leads-" + fileTag + stamp + ".xlsx");

    // Visual feedback: success state on the button + toast
    setDownloadButtonDone();
    if (downloadToastEl && window.bootstrap && window.bootstrap.Toast) {
      try { window.bootstrap.Toast.getOrCreateInstance(downloadToastEl).show(); } catch (_) {}
    }

    // Clear the session payloads so a fresh run starts on the upload page,
    // then navigate back to the upload step. Small delay so the user sees
    // the success toast and the browser kicks off the file download.
    try {
      sessionStorage.removeItem("ec-data");
      sessionStorage.removeItem("ec-form");
      sessionStorage.removeItem("ec-output");
    } catch (_) {}

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
  }

  function setDownloadButtonDone() {
    if (!downloadBtn) return;
    downloadBtn.disabled = true;
    downloadBtn.classList.remove("btn-success");
    downloadBtn.classList.add("btn-outline-success");
    downloadBtn.innerHTML =
      '<i class="bi bi-check-circle-fill me-2"></i>Downloaded — returning to upload…';
  }

  // ---------- Wire up ----------
  downloadBtn.addEventListener("click", downloadXlsx);

  // ---------- Init ----------
  renderFileBadge();
  renderStats();
  renderPreview();
  downloadBtn.disabled = ROWS.length === 0;
})();
