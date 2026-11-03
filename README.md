# GST Report Downloader

Chrome Manifest V3 extension for reading GST Portal taxpayer details and return filing status from an already authenticated portal tab.

## Install
1. Clone this repository.
2. Open chrome://extensions and enable Developer mode.
3. Select Load unpacked and choose the folder containing manifest.json.
4. Sign in to GST Portal normally.

## Full report centre
Click the extension icon, then **Open full report dashboard**. This opens a separate extension page that reads the currently open GST Portal tab and displays a monthly return register with GSTR-1, GSTR-3B, GSTR-2A and GSTR-2B filing-status columns.

## Current limitations
- The portal's visible page is the source of truth. Trade name may not be present on the Returns dashboard; if absent, open the taxpayer Welcome page and refresh.
- Monthly period/status detection supports common tables, row-based cards and visible calendar text, but GST Portal markup varies by page and filing year. Validate results against the portal.
- Download controls are not yet wired to verified report-specific workflows. The dashboard does not claim a report has been downloaded merely because a portal action was seen.
- FY selection is currently a display/filter setting; select the same FY on the GST Portal before refreshing.
- No passwords, OTPs, cookies or authentication tokens are stored. The extension does not bypass CAPTCHA or other portal security.

## Next validation
Capture the GST Portal Returns Calendar page and the actual GSTR-1 / GSTR-3B download page after selecting a month. Use those exact pages to implement and test reliable report actions and download completion tracking.
