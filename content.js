(() => {
  if (window.__gstReportDownloaderLoaded) return;
  window.__gstReportDownloaderLoaded = true;

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const textOf = (el) => clean(el && (el.innerText || el.textContent));
  const stateNames = {
    "01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh",
    "05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh",
    "10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur",
    "15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal",
    "20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh",
    "24":"Gujarat","26":"Dadra and Nagar Haveli and Daman and Diu","27":"Maharashtra",
    "29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu",
    "34":"Puducherry","35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh",
    "38":"Ladakh","97":"Other Territory"
  };

  function getTaxpayerDetails() {
    const body = document.body.innerText || "";
    const gstinMatch = body.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/);
    const gstin = gstinMatch ? gstinMatch[0] : "";
    const welcome = body.match(/Welcome\s+(.+?)\s+to\s+(?:the\s+)?(?:Goods|GST|Dashboard)/i)
      || body.match(/Welcome\s+(.+?)\s+to\b/i);
    const tradeName = welcome ? clean(welcome[1]).replace(/\s+$/, "") : "";
    const stateCode = gstin ? gstin.slice(0, 2) : "";
    return {
      gstin,
      tradeName,
      stateCode,
      state: stateNames[stateCode] || (stateCode ? "State code " + stateCode : "")
    };
  }

  const monthPattern = /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*[-–/]\s*(20\d{2})/i;
  function monthKey(value) {
    const m = clean(value).match(monthPattern);
    if (!m) return "";
    const names = {jan:"January",feb:"February",mar:"March",apr:"April",may:"May",jun:"June",jul:"July",aug:"August",sep:"September",oct:"October",nov:"November",dec:"December"};
    return names[m[1].slice(0,3).toLowerCase()] + " " + m[2];
  }

  function scanPeriods() {
    const found = new Map();
    const add = (period, report, status) => {
      if (!period) return;
      if (!found.has(period)) found.set(period, {period, gstr1:"—", gstr3b:"—", other:"—", source:"calendar"});
      const item = found.get(period);
      if (report === "GSTR-1") item.gstr1 = status || "Listed";
      if (report === "GSTR-3B") item.gstr3b = status || "Listed";
      if (report === "OTHER") item.other = status || "Listed";
    };

    for (const row of document.querySelectorAll("tr")) {
      const cells = [...row.querySelectorAll("th,td")];
      if (cells.length < 2) continue;
      const first = textOf(cells[0]);
      const report = /GSTR\s*[-/]?\s*1|GSTR-1\s*\/\s*IFF|IFF/i.test(first) ? "GSTR-1"
        : /GSTR\s*[-/]?\s*3\s*B/i.test(first) ? "GSTR-3B" : "";
      if (report) {
        for (const cell of cells.slice(1)) {
          const value = textOf(cell);
          const period = monthKey(value);
          if (period) add(period, report, /not filed|pending/i.test(value) ? "Not filed" : /filed/i.test(value) ? "Filed" : value);
        }
        continue;
      }

      const period = monthKey(first);
      if (period) {
        const all = cells.map(textOf).join(" | ");
        add(period, /GSTR\s*[-/]?\s*1/i.test(all) ? "GSTR-1" : "GSTR-1", cells[1] || "Listed");
        const item = found.get(period);
        if (/GSTR\s*[-/]?\s*3\s*B/i.test(all)) item.gstr3b = /not filed|pending/i.test(all) ? "Not filed" : /filed/i.test(all) ? "Filed" : "Listed";
        if (cells.length > 3) item.other = cells.slice(3).map(textOf).join(" | ");
      }
    }
    return [...found.values()].sort((a,b) => {
      const parse = s => { const m=s.match(/(\w+)\s+(20\d{2})/); return m ? new Date(m[2], new Date(m[1]+" 1").getMonth(), 1).getTime() : 0; };
      return parse(a.period)-parse(b.period);
    });
  }

  function findReturnRow(period, report) {
    const targetMonth = period.toLowerCase();
    const rows = [...document.querySelectorAll("tr")];
    // Standard period-first return table.
    let row = rows.find(el => textOf(el).toLowerCase().includes(targetMonth));
    if (row) {
      const label = textOf(row);
      const controls = [...row.querySelectorAll("button,a,input[type=button],input[type=submit]")];
      const control = controls.find(el => {
        const s = textOf(el) + " " + (el.getAttribute("title") || "") + " " + (el.getAttribute("aria-label") || "");
        return report === "GSTR-1" ? /GSTR.?1|R.?1|download/i.test(s)
          : report === "GSTR-3B" ? /GSTR.?3.?B|3.?B|download/i.test(s)
          : report === "GSTR-2A" ? /GSTR.?2.?A|2.?A|download/i.test(s)
          : /GSTR.?2.?B|2.?B|download/i.test(s);
      });
      if (control) return control;
    }
    // Welcome-page returns calendar contains status cells, not download actions.
    return null;
  }

  function clickMatchingControl(task) {
    const target = findReturnRow(task.period, task.report);
    if (!target) {
      return {ok:false, message:"The current page does not show a clearly labelled " + task.report + " download control for " + task.period + ". The Welcome-page calendar only confirms filing status. Open Returns > " + task.report + " and its download section first."};
    }
    const label = textOf(target) || target.getAttribute("title") || "download control";
    target.click();
    return {ok:true, message:"Activated " + task.report + " control for " + task.period + " (" + label + "). Wait for portal generation and verify the file in Chrome Downloads."};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GST_SCAN") {
      const taxpayer = getTaxpayerDetails();
      sendResponse({...taxpayer, periods:scanPeriods(), url:location.href, pageTitle:document.title});
      return true;
    }
    if (message.type === "GST_DOWNLOAD") {
      sendResponse(clickMatchingControl(message.task || {}));
      return true;
    }
  });
})();