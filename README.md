# GST Report Downloader

Chrome Manifest V3 extension for the GST Portal. It reads the taxpayer profile and filing status from the user's authenticated GST Portal session and downloads reports through the portal's own report-generation flow.

## Install

1. Clone this repository.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Sign in to the GST Portal normally.

## User workflow

- On the GST login/access-denied page, the panel shows **Go to Login**.
- On other GST pages outside the Returns dashboard, the panel shows **Go to Dashboard** in the panel body.
- On `https://return.gst.gov.in/returns/auth/dashboard`, the compact panel shows the trade name, GSTIN, state, financial-year selector and Refresh button.
- Refresh checks all 12 periods for the selected financial year using the portal's `rolestatus?rtn_prd=MMYYYY` response.
- A report action is offered only when the portal marks that return as filed.
- Before downloading, the extension rechecks the live filing status and generates the report through the GST Portal. It then hands the portal download URL to Chrome's native Downloads API, avoiding page-context CORS failures on redirects to `files.gst.gov.in`.
- GSTR-1 JSON and GSTR-2A JSON/Excel use the portal's generate and download URL flow. GSTR-3B filing status is displayed, but no download action is exposed until its report-specific workflow is verified.
- Taxpayer name and GSTIN come from the authenticated `ustatus` response. The state code (`stcd`, with GSTIN prefix fallback) is resolved using the GST state master (`c` → `n`).

## Developer view

Use the gear icon in the panel header to open developer diagnostics. Raw API response details are kept off the User page.

## Persistence and safety

- The panel is recreated when the GST page reloads; its position and size are saved in the page's local storage.
- The extension uses the active GST Portal session and does not store passwords, OTPs, cookies or authentication tokens.
- It does not bypass CAPTCHA, login, or other GST Portal security controls.
- Portal response formats and download availability can change. Validate each report against the GST Portal before relying on it for filing work.
