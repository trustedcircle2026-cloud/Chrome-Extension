const $ = (id) => document.getElementById(id);
const state = { periods: [], tasks: [], done: 0 };

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
  if (!tab) throw new Error("Open and sign in to the GST Portal, then navigate to the returns dashboard.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function renderPeriods(periods) {
  state.periods = periods || [];
  $("periodCount").textContent = state.periods.length + " periods found";
  const tbody = $("periodRows");
  tbody.replaceChildren();
  if (!state.periods.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 4; td.className = "empty"; td.textContent = "No period rows detected on this portal page.";
    tr.append(td); tbody.append(tr); return;
  }
  for (const p of state.periods) {
    const tr = document.createElement("tr");
    for (const key of ["period","gstr1","gstr3b","other"]) {
      const td = document.createElement("td"); td.textContent = p[key] || (key === "period" ? "" : "—");
      if (key !== "period") td.className = "state " + (/filed|download/i.test(td.textContent) ? "filed" : /not filed|pending/i.test(td.textContent) ? "pending" : "na");
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
      $("taxpayerName").textContent = "Open GST Portal dashboard"; $("gstin").textContent = "No portal tab detected";
      throw new Error("GST Portal tab not detected.");
    }
    $("connection").textContent = "Portal tab found"; $("connection").className = "pill ok";
    const result = await sendPortalMessage({type:"GST_SCAN"});
    $("taxpayerName").textContent = result.taxpayerName || "Taxpayer detected (name unavailable)";
    $("gstin").textContent = result.gstin || "GSTIN not detected on this page";
    renderPeriods(result.periods || []);
    log("Scanned visible portal content. Check the detected periods before downloading.");
  } catch (error) { log(error.message); }
}

async function downloadOne(task) {
  const result = await sendPortalMessage({type:"GST_DOWNLOAD", task});
  return result;
}

async function runDownloads() {
  const report = $("returnType").value;
  const tasks = [];
  for (const p of state.periods) {
    tasks.push({period:p.period, report:report === "all" ? "GSTR-1" : report, format:$("format").value});
    if (report === "all") tasks.push({period:p.period, report:"GSTR-3B", format:$("format").value});
  }
  if (!tasks.length) { log("No periods available. Refresh periods first."); return; }

  $("downloadAll").disabled = true; state.done = 0; setProgress(0,tasks.length);
  for (const task of tasks) {
    try {
      const result = await downloadOne({...task, financialYear:$("fy").value, periodFilter:$("period").value});
      log(result.message || (task.report + " " + task.period + ": action submitted. Verify the browser download."));
    } catch (error) { log(task.report + " " + task.period + ": " + error.message); }
    state.done++; setProgress(state.done,tasks.length);
    await new Promise(resolve => setTimeout(resolve, 900));
  }
  $("downloadAll").disabled = false;
  log("Queue finished. Review each portal action and Chrome downloads for actual files.");
}

$("scan").addEventListener("click", refresh);
$("downloadAll").addEventListener("click", runDownloads);
refresh();