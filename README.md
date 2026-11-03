# GST Report Downloader

Chrome Manifest V3 starter for the GST Portal. The extension popup scans visible return-period rows and can activate clearly labelled controls in the currently open GST Portal tab.

## Install locally
1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked** and choose the repository folder (the folder containing `manifest.json`).
5. Sign in to GST Portal normally and open the returns/download page.
6. Click the extension, choose return type, year, period and format preference, then Refresh periods.

## Current integration stage
This is a UI-driven integration scaffold, not a verified end-to-end GST report downloader. The content script scans visible HTML table rows and only clicks controls that it can identify by visible labels. GST Portal markup/navigation can differ by return and may require manual navigation to a specific return's download screen. The extension does not claim a file is downloaded just because a control was clicked.

The financial-year/quarter and output-format preferences are currently captured in the UI but are not yet used to navigate the portal selector or convert files. The portal's offered formats are authoritative. JSON and Excel/CSV support must be wired to the exact portal actions for each return. GSTR-2A and GSTR-2B are listed in the UI, but their return-specific workflows still need validation.

## Next implementation steps
- Inspect actual GST Portal DOM and return-specific routes for GSTR-1, GSTR-3B, GSTR-2A and GSTR-2B.
- Wire year/period selectors using verified selectors.
- Add download completion tracking using chrome.downloads.
- Add safe retry logic, sequential queue and downloadable history.
- Verify whether each report offers JSON, Excel, CSV or another format.

Never store GST passwords, OTPs, session cookies or other authentication secrets. Do not bypass captcha or security checks.
