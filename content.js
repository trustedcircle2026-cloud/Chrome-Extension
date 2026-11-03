(() => {
  if (window.__gstReportDownloaderLoaded) return;
  window.__gstReportDownloaderLoaded = true;

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const textOf = (el) => clean(el && (el.innerText || el.textContent));

  function findGstin() {
    const match = document.body.innerText.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/);
    return match ? match[0] : "";
  }

  function findTaxpayerName() {
    const headings = [...document.querySelectorAll("h1,h2,h3,strong,b")].map(textOf).filter(Boolean);
    return headings.find(t => t.length > 4 && !/goods and services tax|dashboard|returns/i.test(t)) || "";
  }

  function scanPeriods() {
    const rows = [...document.querySelectorAll("tr")];
    return rows.map(row => {
      const cells = [...row.querySelectorAll("th,td")].map(textOf);
      if (cells.length < 2) return null;
      const period = cells[0];
      if (!/^(January|February|March|April|May|June|July|August|September|October|November|December|Q[1-4])\b/i.test(period)) return null;
      const combined = cells.join(" | ");
      return {
        period,
        gstr1: /GSTR-1/i.test(combined) ? combined : (cells[1] || ""),
        gstr3b: /GSTR-3B/i.test(combined) ? combined : (cells[2] || ""),
        other: cells.slice(3).join(" | ")
      };
    }).filter(Boolean);
  }

  function visibleDownloadControls() {
    return [...document.querySelectorAll("button,a,input[type=button],input[type=submit]")].filter(el => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length;
    });
  }

  function clickMatchingControl(task) {
    const periodText = task.period.toLowerCase();
    const row = [...document.querySelectorAll("tr")].find(el => textOf(el).toLowerCase().includes(periodText));
    if (!row) return {ok:false, message:"Could not find the selected period row on the current page."};

    const controls = [...row.querySelectorAll("button,a,input[type=button],input[type=submit]")];
    const reportPattern = task.report === "GSTR-1" ? /gstr.?1|r.?1|download/i :
      task.report === "GSTR-3B" ? /gstr.?3.?b|3.?b|download/i :
      task.report === "GSTR-2A" ? /gstr.?2.?a|2.?a|download/i : /gstr.?2.?b|2.?b|download/i;
    const target = controls.find(el => reportPattern.test(textOf(el) + " " + (el.getAttribute("title") || "") + " " + (el.getAttribute("aria-label") || "")));
    if (!target) return {ok:false, message:"No clearly labelled " + task.report + " control found in " + task.period + ". Open that return's download page manually; no guessed control was clicked."};

    const label = textOf(target) || target.getAttribute("title") || target.getAttribute("aria-label") || "download control";
    target.click();
    return {ok:true, message:"Clicked visible portal control (" + label + ") for " + task.report + " " + task.period + ". Confirm file generation/download in the portal."};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GST_SCAN") {
      sendResponse({gstin:findGstin(), taxpayerName:findTaxpayerName(), periods:scanPeriods(), url:location.href});
      return true;
    }
    if (message.type === "GST_DOWNLOAD") {
      sendResponse(clickMatchingControl(message.task || {}));
      return true;
    }
  });
})();