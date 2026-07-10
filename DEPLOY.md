# Excel Cleaner — Deployment Guide (IIS, Windows)

This guide deploys the Excel Cleaner app to **internal IIS** for a small team
(~4 users) at BCX-Telkom. Total time: **~15 minutes** for first-time setup.

> **Audience:** Whoever runs the Windows host (yourself or your IT contact).
> **Prerequisites:** A Windows 10 / 11 / Server machine that's always on,
> Administrator access, the `excel-cleaner/` folder copied to the host.

---

## TL;DR — the entire deployment in 5 commands

Open **PowerShell as Administrator** on the host machine and run:

```powershell
# 1. Enable IIS once
Enable-WindowsOptionalFeature -Online -All -FeatureName `
  IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, `
  IIS-StaticContent, IIS-DefaultDocument, IIS-HttpErrors, `
  IIS-RequestFiltering, IIS-HttpRedirect, IIS-ManagementConsole `
  -NoRestart

# 2. Copy the app folder to IIS's web root
$src = "C:\Users\narendpo\Desktop\Learning\Testing\excel-cleaner"  # ← edit this
$dst = "C:\inetpub\wwwroot\excel-cleaner"
robocopy $src $dst /MIR /XD .git .vscode node_modules

# 3. Create the IIS site (port 8080 to avoid conflict with Default Web Site on :80)
Import-Module WebAdministration
New-WebSite -Name "ExcelCleaner" -Port 8080 `
  -PhysicalPath $dst -ApplicationPool "DefaultAppPool"

# 4. Open the firewall for port 8080 on the local network
New-NetFirewallRule -DisplayName "Excel Cleaner (IIS 8080)" `
  -Direction Inbound -Protocol TCP -LocalPort 8080 `
  -Action Allow -Profile Domain,Private

# 5. Confirm it's running
Start-Process "http://localhost:8080/"
```

Your browser should open the Excel Cleaner login screen. Done.

Tell your 4 users to bookmark `http://<host-name-or-ip>:8080/` — for example
`http://leadtools-pc:8080/` or `http://10.0.0.42:8080/`.

If anything went wrong, see [Troubleshooting](#troubleshooting) below.

---

## Step-by-step (with the "why" of each step)

### Step 1 — Pick a host machine

Any always-on Windows machine on your office network works. Options:

- ✅ **Existing internal Windows Server** — best long-term.
- ✅ **A dedicated Windows 10/11 desktop** — fine for 4 users; just disable
  sleep/hibernate (`powercfg /change standby-timeout-ac 0`).
- ⚠ **Your laptop** — works but the app is offline whenever you take the laptop
  home. Use only for testing.

Make a note of the host's name (e.g. `BCX-LEADPC-01`) or its static IP
(e.g. `10.0.0.42`). Users will type this in their browser.

### Step 2 — Enable IIS (one-time)

Open **PowerShell as Administrator** on the host and run:

```powershell
Enable-WindowsOptionalFeature -Online -All -FeatureName `
  IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, `
  IIS-StaticContent, IIS-DefaultDocument, IIS-HttpErrors, `
  IIS-RequestFiltering, IIS-HttpRedirect, IIS-ManagementConsole `
  -NoRestart
```

When that finishes, verify by opening `http://localhost/` in any browser on the
host — you should see the IIS welcome page.

### Step 3 — Copy the app to IIS's content folder

The default IIS content root is `C:\inetpub\wwwroot\`. Create a subfolder
`excel-cleaner` there and copy the entire app into it:

```powershell
$src = "C:\path\to\your\excel-cleaner"        # ← change this
$dst = "C:\inetpub\wwwroot\excel-cleaner"
robocopy $src $dst /MIR /XD .git .vscode node_modules
```

After the copy, `C:\inetpub\wwwroot\excel-cleaner\` should contain
`login.html`, `index.html`, `chatbot.js`, `web.config`, etc.

> The included `web.config` is what blocks the `tools/` folder, sets
> `login.html` as the default page, and adds cache + security headers. Don't
> delete it.

### Step 4 — Create the IIS site

You can use IIS Manager (GUI) or PowerShell.

**Easiest — PowerShell:**

```powershell
Import-Module WebAdministration
New-WebSite -Name "ExcelCleaner" -Port 8080 `
  -PhysicalPath "C:\inetpub\wwwroot\excel-cleaner" `
  -ApplicationPool "DefaultAppPool"
```

> Why port `8080` and not `80`? IIS comes with a "Default Web Site" already
> bound to `:80`, so using `8080` avoids conflicts. You can use `80` if you
> first stop or remove the Default Web Site
> (`Stop-Website "Default Web Site"`).

**GUI alternative (IIS Manager):**

1. Open **IIS Manager** (`inetmgr`).
2. Right-click **Sites → Add Website…**
3. **Site name:** `ExcelCleaner`
4. **Physical path:** `C:\inetpub\wwwroot\excel-cleaner`
5. **Binding → Port:** `8080`
6. Leave host name blank for now.
7. Click **OK**.

### Step 5 — Open the firewall

Allow inbound TCP `8080` from your office network:

```powershell
New-NetFirewallRule -DisplayName "Excel Cleaner (IIS 8080)" `
  -Direction Inbound -Protocol TCP -LocalPort 8080 `
  -Action Allow -Profile Domain,Private
```

Note: `Profile Domain,Private` keeps it scoped to your office LAN — it will
**not** be reachable from the public internet.

### Step 6 — Smoke test

On the host, open `http://localhost:8080/` — you should land on the login page.

Then on a colleague's machine on the same network, open
`http://<host-name>:8080/` (e.g. `http://bcx-leadpc-01:8080/`). If the host
name doesn't resolve, fall back to its IP: `http://10.0.0.42:8080/`.

Sign in with the current credentials, upload a test file, confirm the full
Upload → Map → Preview → Download flow works.

### Step 7 — Lock down `tools/`

The `web.config` already does this — the password-rotation helper at
`tools/hash-password.html` will return **404** to anyone who tries to load it
through the browser. Verify:

- `http://<host>:8080/tools/hash-password.html` → should return **404**.
- The file is still on disk at `C:\inetpub\wwwroot\excel-cleaner\tools\hash-password.html`.
- Admins (you) can still rotate the password by **opening that file directly
  on the host with `file://`** — see [Rotating the password](#rotating-the-password) below.

### Step 8 — Bookmark + share

Send an email to the 4 users:

> Excel Cleaner is live at **http://bcx-leadpc-01:8080/**.
> Username: `bcx` · Password: *(separate message)*.
> Bookmark the URL. If anything looks stale after an update, press **Ctrl + F5**.

---

## Updating the app

When you change the source files (e.g. fix a bug, tweak the chatbot):

```powershell
$src = "C:\path\to\your\excel-cleaner"
$dst = "C:\inetpub\wwwroot\excel-cleaner"
robocopy $src $dst /MIR /XD .git .vscode node_modules
```

That's it. No IIS restart required. Tell users to hit **Ctrl + F5** once to
bypass cached JS/CSS.

---

## Rotating the password

The credentials are SHA-256 hashes baked into `login.js`. To change them:

1. **On the host machine** (not over the network), browse to
   `C:\inetpub\wwwroot\excel-cleaner\tools\hash-password.html` and double-click
   it. It opens in your default browser at `file://`.
2. Type the new password (and optionally a new username). Copy the generated
   snippet.
3. Open `C:\inetpub\wwwroot\excel-cleaner\login.js` in any editor (Notepad
   works).
4. Replace the `var HASH_USER = …;` and `var HASH_PASS = …;` lines with the
   pasted snippet. Save.
5. Tell the 4 users the new password. Ask them to hit **Ctrl + F5** on the
   login page once before signing in.

> 🔒 **Why we don't expose this through the website:** anyone who can hit
> `tools/hash-password.html` can compute hashes for guessed passwords. The
> `web.config` blocks the URL but the file is still on disk for admin use.

---

## Adding HTTPS (optional but recommended)

For a basic intranet deployment, plain HTTP on port 8080 is fine. To add
HTTPS:

1. Get a TLS cert for the host name (your IT may have an internal CA — easiest;
   otherwise use a self-signed cert with `New-SelfSignedCertificate`).
2. In IIS Manager → **ExcelCleaner → Bindings… → Add → https → port 443 →
   pick your cert → OK**.
3. Open the firewall: `New-NetFirewallRule -DisplayName "Excel Cleaner HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -Profile Domain,Private`.
4. (Optional) Force HTTP → HTTPS redirect by adding a `<rewrite>` rule to
   `web.config`. Ask if you'd like that snippet.

> The Web Crypto API used for password hashing works on `http://` (within a
> "secure context") and on `https://`. HTTPS is preferred but not required for
> Excel Cleaner to function.

---

## Backup & disaster recovery

The entire app is **just a folder of static files** — there's no database, no
state, no user data on the server (everything happens in each user's browser).
Recovery is trivial:

- **Backup:** copy `C:\inetpub\wwwroot\excel-cleaner\` and the source folder to
  any backup location (OneDrive, network share, USB).
- **Restore:** copy it back. No reconfiguration needed.
- **Move to a new host:** install IIS on the new host, copy the folder, recreate
  the IIS site (Step 4) and firewall rule (Step 5). 5 minutes.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `http://localhost:8080/` shows nothing | IIS not running, or wrong port | `Get-Service W3SVC` should be **Running**. Check IIS Manager → Sites → ExcelCleaner is started. |
| `403 Forbidden` on the root URL | Default document not set | Confirm `web.config` is in the site root and contains `<defaultDocument>`. |
| `404 Not Found` on every page after a refresh | The site root is pointing to the wrong physical path | IIS Manager → ExcelCleaner → **Basic Settings** → check Physical Path. |
| Colleagues can't reach it from their machines | Firewall rule missing, or wrong host name/IP | Ping the host first. Then verify the firewall rule (`Get-NetFirewallRule -DisplayName "Excel Cleaner*"`). |
| Updates don't appear after a deploy | Browser cache | **Ctrl + F5** on each user's machine. The included `web.config` already sets HTML to no-cache. |
| `tools/hash-password.html` returns 404 from the URL but I want admin access | That's by design | Open the file directly on the host via `file://` — see [Rotating the password](#rotating-the-password). |
| `crypto.subtle is undefined` error in the console | Site is being loaded via an insecure context (very rare on HTTP intranet, but possible with some custom hostnames) | Use `localhost`, `127.0.0.1`, the host's plain hostname, or switch to HTTPS. |
| A user accidentally clicked "Forgot password" but isn't an admin | The link 404s for them (because `tools/` is blocked) | Expected. Only admins can rotate. |

---

## Security notes (read once, then move on)

- **The login is a UI gate, not a security boundary.** Anyone with DevTools
  knowledge can set `sessionStorage["ec-auth"] = "1"` to bypass it. The
  meaningful protection here is that the site is on your **internal LAN**
  with the firewall rule scoped to **Domain/Private** profiles. Don't expose
  port 8080 to the public internet.
- **Lead data never leaves the user's browser.** Files are parsed and exported
  client-side. The IIS server is a static file host — it never sees row data.
- **The `tools/` folder is blocked at the URL level**, not removed from disk.
  Anyone with file-system access to the host can still use the password helper.
  This is intentional (it's the admin's recovery tool).
- **Rotate the password to something non-dictionary.** The current placeholder
  (`Telkom`) is trivially reversible. See [Rotating the password](#rotating-the-password).

---

## Quick reference card

Print this and tape it to the host:

```
HOST:        bcx-leadpc-01     (change to your actual hostname)
URL:         http://bcx-leadpc-01:8080/
APP FOLDER:  C:\inetpub\wwwroot\excel-cleaner
IIS SITE:    ExcelCleaner   (port 8080)
ADMIN TOOL:  C:\inetpub\wwwroot\excel-cleaner\tools\hash-password.html
             (open via file:// on host only)

UPDATE:      robocopy <source> C:\inetpub\wwwroot\excel-cleaner /MIR /XD .git .vscode node_modules
RESTART:     iisreset    (rarely needed for static files)
LOGS:        C:\inetpub\logs\LogFiles\W3SVC<id>\
```
