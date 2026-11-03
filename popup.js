const $ = (id) => document.getElementById(id);
const state = { periods: [], done: 0 };

function log(message) { $("log").textContent = message; }
function setProgress(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0;
  $("progressBar").style.width = pct + "%";
  $("progressText").textContent = total ? done + " / " + total + " tasks" : "0 tasks";
}

async function activePortalTab() {
  const tabs = await chrome.tabs.query({active:true,currentWindow:true});
  const tab = tabs[0];
  if (!tab || !/^https:\/\/(return|services)\.gst\.gov\.in\//.test(tab.url || "")) return null;
  return tab;
}

async function sendPortalMessage(message) {
  const tab = await activePortalTab();
  if (!tab) throw new Error("Open the GST Portal in the active tab and sign in normally.");
  try { return await chrome.tabs.sendMessage(tab.id, message); }
  catch (error) { throw new Error("Portal scanner is not loaded on this tab. Refresh the GST Portal page and reopen the extension."); }
}

function renderPeriods(periods) {
  state.periods = periods || [];
  $("periodCount").textContent = state.periods.length + " periods found";
  const tbody = $("periodRows");
  tbody.replaceChildren();
  if (!state.periods.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 4; td.className = "empty"; td.textContent = "No return periods detected. Open Returns Dashboard or the return download page, then refresh.";
    tr.append(td); tbody.append(tr); return;
  }
  for (const p of state.periods) {
    const tr = document.createElement("tr");
    for (const key of ["period","gstr1","gstr3b","other"]) {
      const td = document.createElement("td");
      td.textContent = p[key] || "—";
      if (key !== "period") td.className = "state " + (/filed/i.test(td.textContent) && !/not filed/i.test(td.textContent) ? "filed" : /not filed|pending/i.test(td.textContent) ? "pending" : "na");
      tr.append(td);
    }
    tbody.append(tr);
  }
}

async function refresh() {
  try {
    const tab = await activePortalTab();
    if (!tab) {
      $("connection").textContent = "Not connected"; $("connection").className = "pill muted";
      $("taxpayerName").textContent = "Open GST Portal dashboard";
      $("taxpayerState").textContent = "—"; $("gstin").textContent = "—";
      throw new Error("GST Portal tab not detected.");
    }
    $("connection").textContent = "Portal tab found"; $("connection").className = "pill ok";
    const result = await sendPortalMessage({type:"GST_SCAN"});
    $("taxpayerName").textContent = result.tradeName || "Trade name not found on this page";
    $("taxpayerState").textContent = result.state || "State not detected";
    $("gstin").textContent = result.gstin || "GSTIN not detected";
    renderPeriods(result.periods || []);
    log(result.periods && result.periods.length
      ? "Return calendar scanned. Filed status is not the same as a downloadable report."
      : "Taxpayer details scanned. Open Returns Dashboard to load report periods.");
  } catch (error) { log(error.message); }
}

function quarterMonths(quarter) {
  return {Q1:[3,4,5],Q2:[6,7,8],Q3:[9,10,11],Q4:[0,1,2]}[quarter] || null;
}
function monthIndex(period) {
  const m = period.match(/^([A-Za-z]+)\s+(20\d{2})$/);
  return m ? new Date(m[1] + " 1, " + m[2]).getMonth() : -1;
}
function filterPeriods(periods, quarter) {
  const months = quarterMonths(quarter);
  return months ? periods.filter(p => months.includes(monthIndex(p.period))) : periods;
}

async function runDownloads() {
  const report = $("returnType").value;
  const selected = filterPeriods(state.periods, $("period").value);
  const tasks = [];
  for (const p of selected) {
    const reports = report === "all" ? ["GSTR-1","GSTR-3B","GSTR-2A","GSTR-2B"] : [report];
    for (const type of reports) {
      const status = type === "GSTR-1" ? p.gstr1 : type === "GSTR-3B" ? p.gstr3b : p.other;
      if (status && status !== "—" && !/not filed/i.test(status)) tasks.push({period:p.period,report:type,format:$("format").value,financialYear:$("fy").value});
    }
  }
  if (!tasks.length) { log("No eligible filed periods found for this selection. Refresh periods or choose another period."); return; }
  $("downloadAll").disabled = true; state.done = 0; setProgress(0,tasks.length);
  let activated = 0;
  for (const task of tasks) {
    try {
      const result = await sendPortalMessage({type:"GST_DOWNLOAD",task});
      if (result.ok) activated++;
      log(result.message || "Portal action attempted.");
    } catch (error) { log(task.report + " " + task.period + ": " + error.message); }
    state.done++; setProgress(state.done,tasks.length);
    await new Promise(resolve => setTimeout(resolve,900));
  }
  $("downloadAll").disabled = false;
  log(activated
    ? activated + " portal control(s) activated. Verify file generation and downloads in Chrome."
    : "No download controls were found on this page. The welcome calendar only shows filing status; open the relevant return's download page first.");
}

$("scan").addEventListener("click",refresh);
$("downloadAll").addEventListener("click",runDownloads);
refresh();