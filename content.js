(() => {
  if (window.__gstDownloaderV3) return;
  window.__gstDownloaderV3 = true;

  const ROOT = "https://return.gst.gov.in/returns/auth";
  const API = ROOT + "/api";
  const DASH = ROOT + "/dashboard";
  const LOGIN = "https://services.gst.gov.in/services/login";
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const STATE_MASTER = [
    {c:"35",n:"Andaman and Nicobar Islands"},{c:"37",n:"Andhra Pradesh"},{c:"12",n:"Arunachal Pradesh"},
    {c:"18",n:"Assam"},{c:"10",n:"Bihar"},{c:"04",n:"Chandigarh"},{c:"22",n:"Chhattisgarh"},
    {c:"26",n:"Dadra and Nagar Haveli and Daman and Diu"},{c:"07",n:"Delhi"},{c:"30",n:"Goa"},
    {c:"24",n:"Gujarat"},{c:"06",n:"Haryana"},{c:"02",n:"Himachal Pradesh"},{c:"01",n:"Jammu and Kashmir"},
    {c:"20",n:"Jharkhand"},{c:"29",n:"Karnataka"},{c:"32",n:"Kerala"},{c:"38",n:"Ladakh"},
    {c:"31",n:"Lakshadweep"},{c:"23",n:"Madhya Pradesh"},{c:"27",n:"Maharashtra"},{c:"14",n:"Manipur"},
    {c:"17",n:"Meghalaya"},{c:"15",n:"Mizoram"},{c:"13",n:"Nagaland"},{c:"21",n:"Odisha"},
    {c:"97",n:"Other Territory"},{c:"34",n:"Puducherry"},{c:"03",n:"Punjab"},{c:"08",n:"Rajasthan"},
    {c:"11",n:"Sikkim"},{c:"33",n:"Tamil Nadu"},{c:"36",n:"Telangana"},{c:"16",n:"Tripura"},
    {c:"09",n:"Uttar Pradesh"},{c:"05",n:"Uttarakhand"},{c:"19",n:"West Bengal"}
  ];
  const months = ["April","May","June","July","August","September","October","November","December","January","February","March"];
  const returnTypes = ["GSTR3B","GSTR1","GSTR2A"];
  let panel = null, apiData = [], identity = {name:"",gstin:"",state:""}, rows = [], loading = false, downloading = false;

  const path = () => location.pathname.replace(/\/+$/, "");
  const isAccessDenied = () => location.hostname === "services.gst.gov.in" && path() === "/services/error/accessdenied";
  const isDashboard = () => location.hostname === "return.gst.gov.in" && path() === "/returns/auth/dashboard";
  const isPortalDomain = () => ["return.gst.gov.in","services.gst.gov.in"].includes(location.hostname);

  function walk(value, fn, p) {
    if (value == null) return;
    fn(value, p || "");
    if (Array.isArray(value)) value.forEach((x,i) => walk(x,fn,(p || "") + "[" + i + "]"));
    else if (typeof value === "object") Object.keys(value).forEach(k => walk(value[k],fn,p ? p + "." + k : k));
  }
  async function getJson(url) {
    const response = await fetch(url,{credentials:"include",cache:"no-store",headers:{Accept:"application/json, text/plain, */*"}});
    const body = await response.text();
    if (!response.ok) throw new Error("GST Portal returned HTTP " + response.status);
    try { return JSON.parse(body); } catch (_) { throw new Error("GST Portal returned an unexpected response."); }
  }
  function saveGeometry() {
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    try { localStorage.setItem("gstPanelGeometry",JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height})); } catch (_) {}
  }
  function pageMode() {
    if (isAccessDenied()) return "login";
    if (!isDashboard()) return "dashboard";
    return "user";
  }
  function makePanel() {
    if (panel && panel.isConnected) return panel;
    panel = document.createElement("aside");
    panel.id = "gst-report-panel";
    panel.innerHTML =
      '<header id="gst-header"><b class="gst-logo">GST</b><span class="gst-brand"><b>GST Report Downloader</b><small>Drag header to move</small></span><button id="gst-dev-toggle" title="Developer view" aria-label="Developer view">⚙</button><button id="gst-min" title="Minimise">−</button><button id="gst-close" title="Close">×</button></header>' +
      '<main id="gst-body">' +
        '<section id="gst-gate" hidden><div class="gst-gate-title" id="gst-gate-title"></div><p id="gst-gate-copy"></p><button id="gst-gate-action" class="gst-primary"></button></section>' +
        '<section id="gst-user-page">' +
          '<div class="gst-grid">' +
            '<div class="gst-identity"><small>TRADE NAME</small><b id="gst-name">Loading taxpayer…</b><div class="gst-meta"><span><small>GSTIN</small><b id="gst-gstin">—</b></span><span><small>STATE</small><b id="gst-state">—</b></span></div></div>' +
            '<div class="gst-year"><label for="gst-fy">FINANCIAL YEAR</label><select id="gst-fy"><option value="">Loading…</option></select><button id="gst-refresh" class="gst-primary">Refresh</button></div>' +
          '</div>' +
          '<section id="gst-report" hidden><div class="gst-report-title"><b>GST Returns</b><span id="gst-caption"></span></div><div class="gst-table-wrap"><table><thead><tr><th>Period</th><th>GSTR-3B</th><th>GSTR-1</th><th>GSTR-2A</th></tr></thead><tbody id="gst-rows"></tbody></table></div><p class="gst-note">Only returns marked as filed by the GST Portal can be downloaded.</p></section>' +
        '</section>' +
        '<section id="gst-dev-page" hidden><div class="gst-dev-head"><b>Developer diagnostics</b><button id="gst-user-back">Back to User</button></div><div id="gst-api-count"></div><pre id="gst-api"></pre></section>' +
      '</main><div id="gst-resize"></div>';

    const css = document.createElement("style");
    css.id = "gst-css";
    css.textContent =
      '#gst-report-panel{position:fixed;z-index:2147483647;right:18px;top:85px;width:650px;height:210px;min-width:500px;min-height:170px;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#111;border:1px solid #111;border-radius:7px;box-shadow:0 7px 24px #0003;font:11px/1.3 Arial,sans-serif}' +
      '#gst-report-panel *{box-sizing:border-box}' +
      '#gst-report-panel #gst-header{height:40px;min-height:40px;display:flex;align-items:center;gap:8px;padding:5px 9px;background:#111;color:#fff;cursor:grab;user-select:none;touch-action:none}' +
      '#gst-report-panel .gst-logo{background:#fff;color:#111;padding:7px 8px;border-radius:4px;font-size:11px}' +
      '#gst-report-panel .gst-brand{flex:1;min-width:90px}#gst-report-panel .gst-brand b{font-size:11px}#gst-report-panel .gst-brand small{display:block;color:#ddd;font-size:9px}' +
      '#gst-report-panel button{border:1px solid #111;border-radius:4px;padding:7px 9px;background:#fff;color:#111;cursor:pointer;font-size:10px;font-weight:700}' +
      '#gst-report-panel #gst-header button{min-width:28px;padding:5px;font-size:12px}' +
      '#gst-report-panel #gst-body{flex:1;min-height:0;overflow:auto;padding:9px}' +
      '#gst-report-panel .gst-grid{display:grid;grid-template-columns:1.2fr .9fr;gap:10px;align-items:stretch}' +
      '#gst-report-panel .gst-identity{border:1px solid #aaa;border-radius:5px;padding:8px 10px;min-width:0;display:flex;flex-direction:column;justify-content:center}' +
      '#gst-report-panel small,#gst-report-panel label{display:block;color:#555;font-size:8px;font-weight:700;margin-bottom:3px}' +
      '#gst-report-panel .gst-identity>b{font-size:12px;overflow-wrap:anywhere}' +
      '#gst-report-panel .gst-meta{display:flex;gap:24px;border-top:1px solid #ddd;margin-top:7px;padding-top:6px}#gst-report-panel .gst-meta b{display:block;font-size:10px;overflow-wrap:anywhere}' +
      '#gst-report-panel .gst-year{display:flex;flex-direction:column;justify-content:center;gap:7px;min-width:0}#gst-report-panel .gst-year label{margin:0}' +
      '#gst-report-panel select{width:100%;height:34px;padding:6px 8px;border:1px solid #777;border-radius:4px;background:#fff;color:#111;font-size:10px}' +
      '#gst-report-panel .gst-primary{width:100%;height:34px;background:#111;color:#fff}#gst-report-panel button:disabled{opacity:.5;cursor:wait}' +
      '#gst-report-panel #gst-report{margin-top:10px}#gst-report-panel .gst-report-title{display:flex;justify-content:space-between;margin:4px 0 6px;font-size:11px}#gst-report-panel .gst-report-title span{font-size:9px;color:#555}' +
      '#gst-report-panel .gst-table-wrap{max-height:430px;overflow:auto;border:1px solid #aaa;border-radius:4px}#gst-report-panel table{width:100%;border-collapse:collapse;font-size:9px}' +
      '#gst-report-panel th{position:sticky;top:0;background:#eee;padding:7px 5px;text-align:left;border-bottom:1px solid #aaa}#gst-report-panel td{padding:6px 5px;border-top:1px solid #ddd;white-space:nowrap}' +
      '#gst-report-panel .gst-period{font-weight:bold}#gst-report-panel .gst-actions{display:flex;gap:4px}#gst-report-panel .gst-actions button{padding:4px 6px;font-size:8px}' +
      '#gst-report-panel .gst-status{font-size:8px;color:#555}#gst-report-panel .gst-status.filed{font-weight:bold;color:#111}#gst-report-panel .gst-note{font-size:8px;color:#555;margin:6px 0}' +
      '#gst-report-panel #gst-gate{height:100%;min-height:120px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:9px;padding:8px 5px}#gst-report-panel #gst-gate[hidden]{display:none}#gst-report-panel .gst-gate-title{font-size:14px;font-weight:700}#gst-report-panel #gst-gate-copy{font-size:10px;color:#555;margin:0}#gst-report-panel #gst-gate-action{max-width:230px}' +
      '#gst-report-panel #gst-dev-page{font-size:10px}#gst-report-panel .gst-dev-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}#gst-report-panel #gst-api-count{font-size:9px;color:#555;margin-bottom:6px}#gst-report-panel #gst-api{max-height:350px;overflow:auto;background:#f5f5f5;border:1px solid #ddd;padding:8px;font:9px monospace;white-space:pre-wrap;overflow-wrap:anywhere}' +
      '#gst-report-panel #gst-resize{position:absolute;right:2px;bottom:2px;width:17px;height:17px;cursor:nwse-resize;touch-action:none}#gst-report-panel #gst-resize:after{content:"";position:absolute;right:4px;bottom:4px;width:8px;height:8px;border-right:3px solid #111;border-bottom:3px solid #111}' +
      '#gst-report-panel.gst-min{height:40px!important;min-height:40px!important}#gst-report-panel.gst-min #gst-body,#gst-report-panel.gst-min #gst-resize{display:none}' +
      '@media(max-width:620px){#gst-report-panel{min-width:0;width:calc(100vw - 12px)!important;left:6px!important;right:auto!important}#gst-report-panel .gst-grid{grid-template-columns:1fr 1fr;gap:6px}#gst-report-panel .gst-meta{gap:10px}}';
    if (!document.getElementById("gst-css")) document.documentElement.appendChild(css);
    document.documentElement.appendChild(panel);
    try {
      const g = JSON.parse(localStorage.getItem("gstPanelGeometry") || "null");
      if (g) {
        panel.style.width = Math.min(g.width || 650,innerWidth-12) + "px";
        panel.style.height = Math.min(g.height || 210,innerHeight-12) + "px";
        panel.style.left = Math.max(0,Math.min(g.left,innerWidth-panel.offsetWidth)) + "px";
        panel.style.top = Math.max(0,Math.min(g.top,innerHeight-48)) + "px";
        panel.style.right = "auto";
      }
    } catch (_) {}
    bindPanel();
    applyPageMode();
    return panel;
  }
  function bindPanel() {
    $("gst-dev-toggle").onclick = () => showDeveloper(true);
    $("gst-user-back").onclick = () => showDeveloper(false);
    $("gst-close").onclick = () => { saveGeometry(); panel.remove(); panel = null; };
    $("gst-min").onclick = () => {
      const minimized = panel.classList.toggle("gst-min");
      $("gst-min").textContent = minimized ? "+" : "−";
      if (!minimized) panel.style.height = (Number(localStorage.getItem("gstExpandedHeight")) || 480) + "px";
      else localStorage.setItem("gstExpandedHeight",String(panel.offsetHeight));
      saveGeometry();
    };
    $("gst-gate-action").onclick = () => { location.href = isAccessDenied() ? LOGIN : DASH; };
    $("gst-fy").onchange = () => {
      localStorage.setItem("gstSelectedFY",$("gst-fy").value);
      $("gst-report").hidden = true;
      rows = [];
    };
    $("gst-refresh").onclick = refreshReturns;
    bindDragResize();
  }
  function applyPageMode() {
    if (!panel) return;
    const mode = pageMode();
    $("gst-gate").hidden = mode === "user";
    $("gst-user-page").hidden = mode !== "user";
    $("gst-dev-toggle").hidden = mode !== "user";
    $("gst-dev-page").hidden = true;
    if (mode === "login") {
      $("gst-gate-title").textContent = "GST Portal session expired";
      $("gst-gate-copy").textContent = "Sign in to the GST Portal, then open the Returns dashboard.";
      $("gst-gate-action").textContent = "Go to Login";
    } else if (mode === "dashboard") {
      $("gst-gate-title").textContent = "Continue to GST Returns";
      $("gst-gate-copy").textContent = "Open the Returns dashboard to load taxpayer details and return filing status.";
      $("gst-gate-action").textContent = "Go to Dashboard";
    } else {
      $("gst-dev-toggle").hidden = false;
    }
  }
  function showDeveloper(show) {
    $("gst-user-page").hidden = show;
    $("gst-dev-page").hidden = !show;
    $("gst-gate").hidden = true;
    if (show) renderDeveloper();
  }

  // Render diagnostics safely whenever profile/API data changes or the
  // Developer view is opened. Previously this function was called but absent,
  // causing a ReferenceError that interrupted panel initialization.
  function renderDeveloper() {
    if (!panel || !panel.isConnected) return;
    const count = $("gst-api-count");
    const output = $("gst-api");
    if (!count || !output) return;
    count.textContent = apiData.length + " portal/API records captured";
    const safeRecords = apiData.map(item => ({
      name: item.name || "request",
      url: item.url || "",
      ok: Boolean(item.ok),
      error: item.error || undefined,
      data: item.data === undefined ? undefined : item.data
    }));
    try {
      output.textContent = safeRecords.length
        ? JSON.stringify(safeRecords, null, 2)
        : "No API records captured yet. Open the GST Returns dashboard and click Refresh.";
    } catch (error) {
      output.textContent = "Unable to render diagnostics: " + String(error);
    }
  }
  function bindDragResize() {
    const header = $("gst-header");
    let drag = null, resize = null;
    header.addEventListener("pointerdown",e => {
      if (e.target.closest("button")) return;
      const r = panel.getBoundingClientRect();
      drag = {x:e.clientX-r.left,y:e.clientY-r.top};
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener("pointermove",e => {
      if (!drag) return;
      panel.style.left = Math.max(0,Math.min(innerWidth-panel.offsetWidth,e.clientX-drag.x)) + "px";
      panel.style.top = Math.max(0,Math.min(innerHeight-48,e.clientY-drag.y)) + "px";
      panel.style.right = "auto";
    });
    header.addEventListener("pointerup",() => { if (drag) { drag=null; saveGeometry(); } });
    header.addEventListener("pointercancel",() => drag=null);
    const grip = $("gst-resize");
    grip.onpointerdown = e => { e.preventDefault(); resize={x:e.clientX,y:e.clientY,w:panel.offsetWidth,h:panel.offsetHeight};grip.setPointerCapture(e.pointerId); };
    grip.onpointermove = e => {
      if (!resize) return;
      panel.style.width = Math.max(500,Math.min(innerWidth-12,resize.w+e.clientX-resize.x)) + "px";
      panel.style.height = Math.max(170,Math.min(innerHeight-12,resize.h+e.clientY-resize.y)) + "px";
    };
    grip.onpointerup = () => { if (resize) { resize=null;saveGeometry(); } };
    grip.onpointercancel = () => resize=null;
  }
  function collectYears(data) {
    const found = new Set();
    walk(data,v => {
      if (typeof v === "string") {
        const matches = v.match(/\b20\d{2}\s*[-–]\s*\d{2,4}\b/g) || [];
        matches.forEach(x => found.add(x.replace(/\s/g,"").replace("–","-")));
      }
    });
    return Array.from(found).sort((a,b) => Number(b.slice(0,4))-Number(a.slice(0,4)));
  }
  async function loadProfile() {
    const requests = [
      {name:"ustatus",url:"https://return.gst.gov.in/services/api/ustatus"},
      {name:"dropdown",url:API+"/dropdown"}
    ];
    const results = await Promise.allSettled(requests.map(async item => ({name:item.name,url:item.url,data:await getJson(item.url),ok:true})));
    apiData = results.map((r,i) => r.status === "fulfilled" ? r.value : {name:requests[i].name,url:requests[i].url,ok:false,error:String(r.reason)});
    const statusRecord = apiData.find(x => x.name === "ustatus" && x.ok);
    const profile = statusRecord && statusRecord.data && typeof statusRecord.data === "object" ? statusRecord.data : {};
    let gstin = String(profile.gstin || "").trim().toUpperCase();
    if (!/^[0-9A-Z]{15}$/.test(gstin)) gstin = "";
    // GST Portal state master: state code ("c") -> state name ("n").
    // Prefer ustatus.stcd; fall back to the GSTIN's first two characters if needed.
    // The first two GSTIN characters are the official GST state code.
    // Use this as the primary source; ustatus.stcd is only a fallback.
    const stateCandidates = [gstin.slice(0,2), profile.stcd];
    let stateName = "—";
    for (const candidate of stateCandidates) {
      const code = String(candidate || "").trim().padStart(2,"0");
      const matchedState = STATE_MASTER.find(item => item.c === code);
      if (/^\d{2}$/.test(code) && matchedState) {
        stateName = matchedState.n;
        break;
      }
    }
    identity = {name:String(profile.bname || "").trim(),gstin,state:stateName};
    renderIdentity();
    populateYears();
    renderDeveloper();
  }
  function renderIdentity() {
    if (!panel || !isDashboard()) return;
    $("gst-name").textContent = identity.name || "Trade name unavailable";
    $("gst-gstin").textContent = identity.gstin || "GSTIN not detected";
    $("gst-state").textContent = identity.state || "—";
  }
  function populateYears() {
    if (!panel || !isDashboard()) return;
    const select = $("gst-fy");
    const old = localStorage.getItem("gstSelectedFY") || "";
    const dropdown = apiData.find(x => x.name === "dropdown" && x.ok);
    let list = dropdown ? collectYears(dropdown.data) : [];
    if (!list.length) {
      list = Array.from(document.querySelectorAll("select option")).map(o => o.value || o.textContent.trim()).filter(x => /^20\d{2}-\d{2,4}$/.test(x));
      list = Array.from(new Set(list)).sort((a,b) => Number(b.slice(0,4))-Number(a.slice(0,4)));
    }
    select.innerHTML = list.length ? list.map(y => '<option value="' + esc(y) + '">' + esc(y) + '</option>').join("") : '<option value="">Financial years unavailable</option>';
    if (list.includes(old)) select.value = old;
    else if (list.length) select.value = list[0];
    $("gst-refresh").disabled = !select.value;
  }
  function fyMonths(fy) {
    const match = String(fy).match(/^(20\d{2})-(\d{2,4})$/);
    if (!match) return [];
    const start = Number(match[1]);
    return months.map((month,i) => {
      const monthNumber = i < 9 ? i + 4 : i - 8;
      const year = start + (i >= 9 ? 1 : 0);
      return {month,monthIndex:i,period:String(monthNumber).padStart(2,"0") + year};
    });
  }
  function returnList(response) {
    const data = response && response.data ? response.data : response;
    return (Array.isArray(data && data.user) ? data.user : []).flatMap(user => Array.isArray(user.returns) ? user.returns : []);
  }
  function filing(response,type) {
    const record = returnList(response).find(item => String(item.return_ty || "").toUpperCase() === type);
    if (!record) return {filed:false,label:"Status unavailable"};
    const status = String(record.status || "").trim().toUpperCase();
    const filed = ["F","FIL","FILED","FR","PROCESSED","SUCCESS","SUBMITTED"].includes(status);
    const notFiled = ["NF","NOT FILED","NOT_FILED","N","PENDING","DUE"].includes(status);
    return {filed,label:filed ? "Filed" : notFiled ? "Not filed" : String(record.status || "Status unavailable")};
  }
  async function loadStatuses(periods) {
    return Promise.all(periods.map(async period => {
      try {
        const data = await getJson(API + "/rolestatus?rtn_prd=" + encodeURIComponent(period.period));
        return Object.assign({},period,{statuses:Object.fromEntries(returnTypes.map(type => [type,filing(data,type)]))});
      } catch (error) {
        return Object.assign({},period,{error:String(error),statuses:Object.fromEntries(returnTypes.map(type => [type,{filed:false,label:"Status unavailable"}]))});
      }
    }));
  }
  function renderRows() {
    $("gst-caption").textContent = $("gst-fy").value + " • " + rows.length + " periods";
    $("gst-rows").innerHTML = rows.map(row => {
      const cell = type => {
        const result = row.statuses[type];
        if (!result.filed) return '<span class="gst-status">' + esc(result.label) + '</span>';
        if (type === "GSTR3B") return '<div class="gst-actions"><span class="gst-status filed">Filed</span><button data-type="GSTR3B" data-period="' + row.period + '" data-format="PDF">PDF</button></div>';
        return '<div class="gst-actions"><button data-type="' + type + '" data-period="' + row.period + '" data-format="JSON">JSON</button>' +
          (type === "GSTR2A" ? '<button data-type="GSTR2A" data-period="' + row.period + '" data-format="EX">EX</button>' : "") + '</div>';
      };
      return '<tr><td class="gst-period">' + esc(row.month) + '</td><td>' + cell("GSTR3B") + '</td><td>' + cell("GSTR1") + '</td><td>' + cell("GSTR2A") + '</td></tr>';
    }).join("");
    $("gst-rows").querySelectorAll("button[data-type]").forEach(button => {
      button.onclick = () => download(button.dataset.type,button.dataset.period,button.dataset.format,button);
    });
  }
  async function refreshReturns() {
    if (loading) return;
    const fy = $("gst-fy").value;
    if (!fy) { alert("Select a financial year."); return; }
    loading = true;
    $("gst-refresh").disabled = true;
    $("gst-refresh").textContent = "Loading…";
    $("gst-report").hidden = false;
    $("gst-rows").innerHTML = '<tr><td colspan="4">Checking filing status for all 12 months…</td></tr>';
    try {
      localStorage.setItem("gstSelectedFY",fy);
      rows = await loadStatuses(fyMonths(fy));
      renderRows();
      panel.style.height = Math.min(innerHeight-12,Math.max(panel.offsetHeight,480)) + "px";
      localStorage.setItem("gstExpandedHeight",String(panel.offsetHeight));
      saveGeometry();
    } catch (error) {
      $("gst-rows").innerHTML = '<tr><td colspan="4">' + esc(error.message) + '</td></tr>';
    } finally {
      loading = false;
      $("gst-refresh").disabled = false;
      $("gst-refresh").textContent = "Refresh";
    }
  }
  async function startNativeDownload(url,filename) {
    const result = await chrome.runtime.sendMessage({type:"GST_NATIVE_DOWNLOAD",url,filename});
    if (!result || !result.ok) throw new Error(result && result.error ? result.error : "Chrome could not start the download.");
    return result.downloadId;
  }
  async function callGstApi(url,label) {
    let response;
    try {
      response = await fetch(url,{
        method:"GET",
        credentials:"include",
        cache:"no-store",
        redirect:"follow",
        headers:{Accept:"application/json, text/plain, */*"}
      });
    } catch (error) {
      throw new Error(label + " could not reach the GST Portal. Check that you are logged in and reload the GST dashboard. (" + error.message + ")");
    }
    const text = await response.text();
    const finalUrl = String(response.url || "");
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const htmlResponse = /<\s*!doctype\s+html|<\s*html[\s>]/i.test(text.slice(0,1200)) ||
      contentType.includes("text/html") ||
      /services\.gst\.gov\.in\/services\/(login|error\/accessdenied)/i.test(finalUrl);
    if (htmlResponse) {
      throw new Error("GST session expired or access denied while calling " + label + ". The portal returned its login page, not a return file. Click Go to Login, sign in, reopen the Returns dashboard, and retry.");
    }
    if (!response.ok) throw new Error(label + " failed (HTTP " + response.status + ").");
    if (response.redirected && /services\.gst\.gov\/services\/(login|error\/accessdenied)/i.test(finalUrl)) {
      throw new Error("GST session expired. Please sign in again before downloading.");
    }
    try { return JSON.parse(text); }
    catch (_) { return text.trim(); }
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
  async function downloadGstr3bPdf(period,button) {
    // GSTR-3B PDF workflow. The GSTIN is taken from the authenticated
    // taxpayer profile; never send the literal string "undefined".
    const gstin = String(identity.gstin || "").trim().toUpperCase();
    if (!/^[0-9A-Z]{15}$/.test(gstin)) {
      throw new Error("GSTIN was not detected from the signed-in taxpayer profile. Refresh the GST Portal and retry.");
    }
    const periodParam = "rtn_prd=" + encodeURIComponent(period);
    const formUrl = API + "/formdetails?" + periodParam + "&rtn_typ=GSTR3B";
    const sysintUrl = API + "/gstr3b/sysint?gstin=" + encodeURIComponent(gstin) + "&" + periodParam;
    const pdfUrl = API + "/gstr3b/getgenpdf?" + periodParam;
    const taxUrl = API + "/gstr3b/taxpayble?" + periodParam;

    button.textContent = "Form…";
    const formData = await callGstApi(formUrl,"GSTR-3B form details");

    button.textContent = "System…";
    const sysintData = await callGstApi(sysintUrl,"GSTR-3B system-generated details");

    button.textContent = "Tax…";
    const taxData = await callGstApi(taxUrl,"GSTR-3B tax payable details");

    // getgenpdf is the portal's PDF response endpoint. Start it through
    // chrome.downloads so the browser follows the authenticated portal response.
    button.textContent = "PDF…";
    const downloadId = await startNativeDownload(pdfUrl,"GSTR3B_" + period + ".pdf");

    apiData = apiData.filter(x => !/^gstr3b-/.test(x.name));
    apiData.push(
      {name:"gstr3b-formdetails",url:formUrl,ok:true,data:formData},
      {name:"gstr3b-sysint",url:sysintUrl,ok:true,data:sysintData},
      {name:"gstr3b-taxpayble",url:taxUrl,ok:true,data:taxData},
      {name:"gstr3b-getgenpdf",url:pdfUrl,ok:true,data:{downloadId,filename:"GSTR3B_" + period + ".pdf",note:"Started authenticated Chrome download from GST Portal PDF endpoint."}}
    );
    renderDeveloper();
    return downloadId;
  }

  async function downloadGstr1Json(period,button) {
    // GST Portal GSTR-1 offline download sequence:
    // 1) return filing status 2) upload summary 3) save/validation
    // 4) generate offline JSON package 5) request file_num=1.
    const params = new URLSearchParams({rtn_prd:period,rtn_typ:"GSTR1"});
    const statusUrl = API + "/rolestatus?rtn_prd=" + encodeURIComponent(period);
    const statusData = await callGstApi(statusUrl,"GSTR-1 filing status");
    if (!filing(statusData,"GSTR1").filed) {
      throw new Error("GSTR-1 for " + period + " is not marked Filed by the GST Portal. Download stopped.");
    }

    button.textContent = "Summary…";
    const summaryUrl = API + "/offline/upload/summary?" + params.toString();
    const summaryData = await callGstApi(summaryUrl,"GSTR-1 offline upload summary");

    button.textContent = "Validate…";
    const validateUrl = API + "/gstr/save/valid?" + params.toString();
    const validationData = await callGstApi(validateUrl,"GSTR-1 save/validation");

    button.textContent = "Generate…";
    const generateUrl = API + "/offline/download/generate?" +
      new URLSearchParams({flag:"0",rtn_prd:period,rtn_typ:"GSTR1"}).toString();
    const generatedData = await callGstApi(generateUrl,"GSTR-1 JSON file generation");

    // Give the portal's asynchronous file service time to publish file_num=1.
    // Chrome Downloads follows the authenticated redirect; page fetch cannot
    // reliably read the ZIP because files.gst.gov.in may reject CORS.
    button.textContent = "Preparing file…";
    await wait(1500);
    button.textContent = "Downloading…";
    const downloadUrl = API + "/offline/download/url?" +
      new URLSearchParams({rtn_prd:period,rtn_typ:"GSTR1",file_num:"1"}).toString();
    const filename = "GSTR1_" + period + "_JSON.zip";
    const downloadId = await startNativeDownload(downloadUrl,filename);

    apiData = apiData.filter(x => !/^gstr1-/.test(x.name));
    apiData.push(
      {name:"gstr1-status",url:statusUrl,ok:true,data:statusData},
      {name:"gstr1-summary",url:summaryUrl,ok:true,data:summaryData},
      {name:"gstr1-validation",url:validateUrl,ok:true,data:validationData},
      {name:"gstr1-generate",url:generateUrl,ok:true,data:generatedData},
      {name:"gstr1-download-url",url:downloadUrl,ok:true,data:{downloadId,filename,note:"Chrome Downloads follows the GST Portal authenticated file redirect."}}
    );
    renderDeveloper();
    return downloadId;
  }
  async function download(type,period,format,button) {
    if (downloading) return;
    downloading = true;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Checking…";
    try {
      if (type === "GSTR1" && format === "JSON") {
        await downloadGstr1Json(period,button);
      } else if (type === "GSTR3B" && format === "PDF") {
        await downloadGstr3bPdf(period,button);
      } else {
        // Keep the existing download flow for other return types/formats.
        const latest = await getJson(API + "/rolestatus?rtn_prd=" + encodeURIComponent(period));
        if (!filing(latest,type).filed) throw new Error("GST Portal does not currently mark this return as Filed. Download stopped.");
        const params = new URLSearchParams({flag:"0",rtn_prd:period,rtn_typ:type});
        if (format === "EX") params.set("file_type","EX");
        const generate = await fetch(API + "/offline/download/generate?" + params.toString(),{
          credentials:"include",cache:"no-store",headers:{Accept:"application/json, text/plain, */*"}
        });
        if (!generate.ok) throw new Error("Report generation returned HTTP " + generate.status);
        await generate.text();
        const fileParams = new URLSearchParams({rtn_prd:period,rtn_typ:type,file_num:"1"});
        if (format === "EX") fileParams.set("file_type","EX");
        const downloadUrl = API + "/offline/download/url?" + fileParams.toString();
        const filename = "GST_" + type + "_" + period + (format === "EX" ? "_Excel.zip" : ".zip");
        await startNativeDownload(downloadUrl,filename);
      }
      button.textContent = "Started";
    } catch (error) {
      button.textContent = original;
      alert("GST download failed (" + type + " " + period + "):\n" + error.message);
    } finally {
      button.disabled = false;
      downloading = false;
    }
  }
  async function init() {
    if (!isPortalDomain()) return;
    makePanel();
    if (isDashboard()) {
      await loadProfile();
      renderIdentity();
    }
  }
  chrome.runtime.onMessage.addListener((message,sender,reply) => {
    if (message && message.type === "GST_DOWNLOAD_FAILED") {
      alert("GST download was stopped. " + (message.error || "The portal returned an HTML/login page instead of a ZIP file.") + "\nPlease sign in again and retry.");
      return false;
    }
    if (message && message.type === "GST_TOGGLE_PANEL") {
      if (panel && panel.isConnected) { saveGeometry();panel.remove();panel=null;reply({ok:true,visible:false}); }
      else { makePanel();if (isDashboard()) loadProfile();reply({ok:true,visible:true}); }
      return true;
    }
    if (message && message.type === "GST_REFRESH_PANEL") {
      if (!panel || !panel.isConnected) makePanel();
      if (isDashboard()) loadProfile().then(refreshReturns);
      reply({ok:true});
      return true;
    }
  });
  init().catch(error => console.error("GST Report Downloader:",error));
})();