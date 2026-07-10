# excel-cleaner
Browser-only tool to clean and standardize messy client lead Excel/CSV files into a fixed output schema — no data ever leaves your browser.
# Excel Cleaner

A privacy-first, browser-based tool that cleans and standardizes messy client-supplied lead Excel/CSV files into a fixed output schema. Merge multiple files, map columns, set per-campaign values, preview with missing-field highlighting, and download one clean sheet — the uploaded spreadsheet data never leaves your browser.

## What it does

1. **Upload** one or more client files (`.xlsx`, `.xls`, or `.csv`). Multiple files merge into a single cleaned output.
2. **Manually map** each of the 20+ input columns (however they're named) to the fixed list of mandatory output columns.
3. Provide **per-campaign values** for `Lead Status` (default `New`) and `Product / Service / Solution`.
4. **Preview** the first 20 cleaned rows with missing mandatory fields highlighted.
5. **Download** a single-sheet `.xlsx` with rows in the standardized schema.

## Features

- **Client-side processing** — spreadsheet parsing happens entirely in-browser via [SheetJS](https://sheetjs.com/); files are never uploaded to a server.
- **Multi-file merge** into one standardized output sheet.
- **Login screen** to gate access to the tool.
- **Multiple themes** (light, dark, editorial, auto) with an in-app switcher.
- **Assistant chatbot** to help users through the mapping and cleaning steps.

## Mandatory output columns

| # | Column | Source |
| - | ------ | ------ |
| 1 | Lead Status | fixed per batch (default `New`) |
| 2 | First Name | mapped from input |
| 3 | Last Name | mapped from input |
| 4 | E-mail address | mapped from input |
| 5 | Product / Service / Solution | fixed per batch (per campaign) |
| 6 | Mobile | mapped from input |
| 7 | Company Name | mapped from input |

## Cleaning rules applied

- Whitespace trimmed on every output cell.
- Fully empty input rows are dropped.
- Each row is checked for missing mandatory fields. Rows are still included, but a banner shows the count and the on-screen preview highlights empty mandatory cells in red.

## Privacy

Everything runs in your browser. The uploaded Excel is parsed with [SheetJS](https://sheetjs.com/) loaded from CDN, and the file is never uploaded to any server.

## How to run

Just open `index.html` in any modern browser:

```powershell
start c:\Users\narendpo\Desktop\Learning\Testing\excel-cleaner\index.html
```

Or serve it locally for a stable origin (useful if you want to bookmark it):

```powershell
cd c:\Users\narendpo\Desktop\Learning\Testing\excel-cleaner
python -m http.server 8000
# then open http://localhost:8000
```

## Files

- `login.html` / `login.js` / `login.css` - login screen and auth guard
- `index.html` / `upload.js` - upload page: drop/select files and start processing
- `process.html` / `process.js` - map columns, set fixed values, and run cleaning (uses SheetJS)
- `preview.html` / `preview.js` - preview cleaned rows and download the output `.xlsx`
- `chatbot.js` / `chatbot.css` - in-app assistant
- `theme.js` - theme switcher (light / dark / editorial / auto)
- `motion.js` - UI animations
- `web.config` - IIS hosting configuration
- `README.md` - this file

## Editing the mandatory column list

Open `process.js` and edit the `MANDATORY_COLUMNS` array at the top. If you add or remove a column that should be filled from a per-batch fixed value (rather than the input spreadsheet), also update the `FIXED_VALUE_COLUMNS` set and add a matching input in `process.html`.
