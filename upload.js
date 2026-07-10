/* upload.js — Step 1: Upload one or more files + Process navigation
 * Multiple files are merged into a single dataset using the UNION of their
 * columns (first-seen ordering). Rows missing a column are filled with "".
 * On Process: the merged dataset is saved to sessionStorage and the user is
 * sent to process.html where Steps 2-4 take over.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---------- State ----------
  // Each entry: { id, name, size, workbook, sheetNames[], selectedSheet, rows[], columns[] }
  let loadedFiles = [];
  let nextFileId = 1;

  // ---------- DOM ----------
  const dropzone        = $("dropzone");
  const fileInput       = $("fileInput");
  const filesList       = $("filesList");
  const filesListBody   = $("filesListBody");
  const filesCountBadge = $("filesCountBadge");
  const resetAllBtn     = $("resetAllBtn");
  const processBarWrap  = $("processBarWrap");
  const processBtn      = $("processBtn");
  const processBtnText  = $("processBtnText");
  const processBtnSpinner = $("processBtnSpinner");
  const processIcon     = $("processIcon");
  const processFileName = $("processFileName");
  const processFileRows = $("processFileRows");

  // ---------- Helpers ----------
  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(n >= 10 || i === 0 ? 0 : 1) + " " + units[i];
  }

  function isEmpty(v) {
    if (v == null) return true;
    return String(v).trim() === "";
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Detect a single column whose header is itself a comma-packed CSV line.
  function detectCommaPackedColumn(cols, rows) {
    const nonEmpty = cols.filter((c) => !isEmpty(c));
    if (nonEmpty.length !== 1) return null;
    const only = nonEmpty[0];
    if ((only.match(/,/g) || []).length < 2) return null;
    const sample = rows.find((r) => !isEmpty(r[only]));
    if (!sample) return null;
    const sampleVal = String(sample[only]);
    if ((sampleVal.match(/,/g) || []).length < 1) return null;
    return only;
  }

  // Minimal RFC-4180-ish CSV line parser: handles quoted fields & escaped quotes.
  function parseCsvLine(line) {
    const out = [];
    let cur = "", inQuote = false;
    const s = String(line);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuote) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cur += '"'; i++; }
          else { inQuote = false; }
        } else cur += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  }

  // Pick the first sheet that actually has data; fall back to sheet 0.
  function pickDefaultSheet(workbook) {
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (aoa.length > 0 && aoa.some((r) => r.some((v) => !isEmpty(v)))) {
        return name;
      }
    }
    return workbook.SheetNames[0];
  }

  // ---------- Upload handling ----------
  function bindUpload() {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener("change", () => {
      handleFiles(fileInput.files);
      fileInput.value = ""; // allow re-uploading the same file later
    });
    if (resetAllBtn) resetAllBtn.addEventListener("click", resetAll);
    processBtn.addEventListener("click", runProcess);
  }

  function handleFiles(fileObjs) {
    if (!fileObjs || !fileObjs.length) return;
    Array.from(fileObjs).forEach(loadOneFile);
  }

  function loadOneFile(file) {
    const id = "f" + (nextFileId++);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheet = pickDefaultSheet(wb);
        const entry = {
          id: id,
          name: file.name,
          size: file.size,
          workbook: wb,
          sheetNames: wb.SheetNames.slice(),
          selectedSheet: firstSheet,
          rows: [],
          columns: [],
        };
        loadSheetIntoEntry(entry, firstSheet);
        loadedFiles.push(entry);
        renderFilesList();
        updateProcessBar();
      } catch (err) {
        alert(
          'Could not read "' + file.name + '". ' +
          "Make sure it's a valid .xlsx, .xls, or .csv file.\n\n" + err.message
        );
        console.error(err);
      }
    };
    reader.onerror = () => alert('Failed to read "' + file.name + '".');
    reader.readAsArrayBuffer(file);
  }

  function loadSheetIntoEntry(entry, sheetName) {
    entry.selectedSheet = sheetName;
    const sheet = entry.workbook.Sheets[sheetName];
    let rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    let cols = rows.length ? Object.keys(rows[0]) : [];

    if (cols.length === 0) {
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (aoa.length > 0 && Array.isArray(aoa[0])) {
        cols = aoa[0].map((h, i) => (isEmpty(h) ? "Column " + (i + 1) : String(h).trim()));
      }
    } else {
      cols = cols.map((c) => String(c).trim());
    }

    // Recover comma-packed single-column CSVs (per-file)
    const packed = detectCommaPackedColumn(cols, rows);
    if (packed !== null) {
      const headers = parseCsvLine(packed);
      rows = rows.map((r) => {
        const raw = String(r[packed] == null ? "" : r[packed]);
        const vals = parseCsvLine(raw);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] != null ? vals[i] : ""; });
        return obj;
      });
      cols = headers;
    }

    entry.rows = rows;
    entry.columns = cols;
  }

  function removeFile(id) {
    loadedFiles = loadedFiles.filter((f) => f.id !== id);
    renderFilesList();
    updateProcessBar();
  }

  function changeSheetFor(id, sheetName) {
    const entry = loadedFiles.find((f) => f.id === id);
    if (!entry) return;
    loadSheetIntoEntry(entry, sheetName);
    renderFilesList();
    updateProcessBar();
  }

  // ---------- Files-list rendering ----------
  function renderFilesList() {
    if (filesCountBadge) filesCountBadge.textContent = loadedFiles.length;

    if (loadedFiles.length === 0) {
      if (filesList) filesList.hidden = true;
      return;
    }
    if (filesList) filesList.hidden = false;
    if (!filesListBody) return;

    filesListBody.innerHTML = "";

    loadedFiles.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "file-row";

      // Sheet picker (or static label if only one sheet)
      let sheetHtml;
      if (entry.sheetNames.length > 1) {
        const opts = entry.sheetNames.map((n) =>
          '<option value="' + escapeHtml(n) + '"' +
          (n === entry.selectedSheet ? ' selected' : '') + '>' +
          escapeHtml(n) + '</option>'
        ).join("");
        sheetHtml =
          '<label class="file-row-sheet-label">Sheet:</label>' +
          '<select class="form-select form-select-sm file-sheet-sel" ' +
          'data-id="' + entry.id + '">' + opts + '</select>';
      } else {
        sheetHtml =
          '<span class="file-row-sheet-static text-muted small">Sheet: <strong>' +
          escapeHtml(entry.selectedSheet || "—") + '</strong></span>';
      }

      const rowWord = entry.rows.length === 1 ? "row" : "rows";
      const colWord = entry.columns.length === 1 ? "column" : "columns";

      row.innerHTML =
        '<i class="bi bi-file-earmark-spreadsheet file-row-icon"></i>' +
        '<div class="file-row-info">' +
          '<div class="file-row-name" title="' + escapeHtml(entry.name) + '">' + escapeHtml(entry.name) + '</div>' +
          '<div class="file-row-meta">' +
            entry.rows.length + ' ' + rowWord + ' · ' +
            entry.columns.length + ' ' + colWord + ' · ' +
            formatBytes(entry.size) +
          '</div>' +
        '</div>' +
        '<div class="file-row-actions">' +
          sheetHtml +
          '<button type="button" class="btn btn-sm btn-outline-danger file-remove-btn" ' +
          'data-id="' + entry.id + '" title="Remove this file" aria-label="Remove">' +
            '<i class="bi bi-x-lg"></i>' +
          '</button>' +
        '</div>';

      filesListBody.appendChild(row);
    });

    // Wire interactions
    filesListBody.querySelectorAll(".file-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeFile(btn.getAttribute("data-id")));
    });
    filesListBody.querySelectorAll(".file-sheet-sel").forEach((sel) => {
      sel.addEventListener("change", () => changeSheetFor(sel.getAttribute("data-id"), sel.value));
    });
  }

  // ---------- Combine all loaded files ----------
  // Returns { columns, rows } where columns is the union (first-seen order)
  // and rows is the concat of all files' rows, with missing keys filled "".
  function getCombined() {
    const cols = [];
    const seen = Object.create(null);
    for (const f of loadedFiles) {
      for (const c of f.columns) {
        if (!seen[c]) { seen[c] = true; cols.push(c); }
      }
    }
    const rows = [];
    for (const f of loadedFiles) {
      for (const r of f.rows) {
        const out = {};
        for (const c of cols) {
          out[c] = Object.prototype.hasOwnProperty.call(r, c) ? r[c] : "";
        }
        rows.push(out);
      }
    }
    return { columns: cols, rows: rows };
  }

  // ---------- Process bar ----------
  function updateProcessBar() {
    if (loadedFiles.length === 0) {
      if (processBarWrap) processBarWrap.hidden = true;
      return;
    }
    const combined = getCombined();
    const fileCount = loadedFiles.length;
    const fileWord = fileCount === 1 ? "file" : "files";
    const rowWord = combined.rows.length === 1 ? "row" : "rows";
    const colWord = combined.columns.length === 1 ? "column" : "columns";

    if (processFileName) {
      processFileName.textContent = fileCount === 1
        ? loadedFiles[0].name
        : fileCount + " " + fileWord + " selected";
    }
    if (processFileRows) {
      processFileRows.textContent =
        combined.rows.length + " " + rowWord + "  ·  " +
        combined.columns.length + " " + colWord + " detected";
    }
    if (processBtnText) {
      processBtnText.textContent = fileCount === 1 ? "Process File" : "Process Files";
    }
    if (processBarWrap) processBarWrap.hidden = false;
    resetProcessBtn();
  }

  function resetProcessBtn() {
    if (!processBtn) return;
    processBtn.disabled = false;
    processBtn.classList.remove("process-btn-done");
    if (processBtnText) {
      processBtnText.textContent = loadedFiles.length === 1 ? "Process File" : "Process Files";
    }
    if (processIcon) processIcon.className = "bi bi-cpu-fill me-2";
    if (processBtnSpinner) processBtnSpinner.hidden = true;
    if (processIcon) processIcon.style.display = "";
  }

  // ---------- Run process: merge + serialize + navigate ----------
  function runProcess() {
    if (loadedFiles.length === 0) {
      alert("Please add at least one file first.");
      return;
    }

    processBtn.disabled = true;
    if (processBtnText) processBtnText.textContent = "Processing…";
    if (processIcon) processIcon.style.display = "none";
    if (processBtnSpinner) processBtnSpinner.hidden = false;

    setTimeout(() => {
      try {
        const combined = getCombined();

        // Per-file metadata for display on later pages.
        const filesMeta = loadedFiles.map((f) => ({
          name: f.name,
          sheet: f.selectedSheet,
          rows: f.rows.length,
          columns: f.columns.length,
        }));

        // A summary string used by older code paths that read fileName.
        const summaryName = loadedFiles.length === 1
          ? loadedFiles[0].name
          : loadedFiles.length + " files combined";
        const summarySheet = loadedFiles.length === 1
          ? loadedFiles[0].selectedSheet
          : "";

        sessionStorage.setItem("ec-data", JSON.stringify({
          fileName: summaryName,
          sheetName: summarySheet,
          files: filesMeta,
          inputColumns: combined.columns,
          inputRows: combined.rows,
          uploadedAt: new Date().toISOString(),
        }));
        window.location.href = "process.html";
      } catch (err) {
        if (processBtnSpinner) processBtnSpinner.hidden = true;
        if (processIcon) processIcon.style.display = "";
        alert(
          "Could not pass the merged data to the next step.\n\n" +
          "It may be too large for browser session storage. Try fewer or smaller files.\n\n" +
          err.message
        );
        resetProcessBtn();
      }
    }, 600);
  }

  // ---------- Reset ----------
  function resetAll() {
    loadedFiles = [];
    fileInput.value = "";
    if (filesList) filesList.hidden = true;
    if (filesListBody) filesListBody.innerHTML = "";
    if (filesCountBadge) filesCountBadge.textContent = "0";
    if (processBarWrap) processBarWrap.hidden = true;
    try { sessionStorage.removeItem("ec-data"); } catch (_) {}
  }

  // ---------- Init ----------
  // Clear stale handoff data from previous runs the moment Upload loads.
  try {
    sessionStorage.removeItem("ec-data");
    sessionStorage.removeItem("ec-form");
    sessionStorage.removeItem("ec-output");
  } catch (_) {}

  bindUpload();
})();
