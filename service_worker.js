const gstDownloads = new Map();

chrome.action.onClicked.addListener(async tab => {
  if (!tab?.id || !/^https:\/\/(services|return)\.gst\.gov\.in\//.test(tab.url || "")) return;
  try {
    await chrome.tabs.sendMessage(tab.id,{type:"GST_TOGGLE_PANEL"});
  } catch (e) {
    try {
      await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
      await chrome.tabs.sendMessage(tab.id,{type:"GST_TOGGLE_PANEL"});
    } catch (err) {
      console.error(err);
    }
  }
});

chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
  if (!message || message.type !== "GST_NATIVE_DOWNLOAD") return false;
  (async () => {
    try {
      const parsed = new URL(String(message.url || ""));
      if (parsed.protocol !== "https:" || !["return.gst.gov.in","files.gst.gov.in"].includes(parsed.hostname)) {
        throw new Error("Blocked download URL: GST Portal host not allowed.");
      }
      const filename = String(message.filename || "GST_Return_Download.zip")
        .replace(/[\\/:*?"<>|]/g,"_").replace(/^\.+/,"").slice(0,160);
      const downloadId = await chrome.downloads.download({
        url:parsed.href,
        filename:filename || "GST_Return_Download.zip",
        saveAs:false,
        conflictAction:"uniquify"
      });
      gstDownloads.set(downloadId,{tabId:sender.tab && sender.tab.id,filename});
      sendResponse({ok:true,downloadId});
    } catch (error) {
      sendResponse({ok:false,error:error && error.message ? error.message : String(error)});
    }
  })();
  return true;
});

chrome.downloads.onChanged.addListener(async delta => {
  if (!delta.id || !delta.state || !["complete","interrupted"].includes(delta.state.current)) return;
  const tracked = gstDownloads.get(delta.id);
  if (!tracked) return;
  gstDownloads.delete(delta.id);
  try {
    const [item] = await chrome.downloads.search({id:delta.id});
    if (!item) return;
    if (delta.state.current === "interrupted") {
      if (tracked.tabId) chrome.tabs.sendMessage(tracked.tabId,{type:"GST_DOWNLOAD_FAILED",error:"Chrome interrupted the download. Check the GST Portal session and retry."}).catch(()=>{});
      return;
    }
    const finalUrl = String(item.finalUrl || "");
    const mime = String(item.mime || "").toLowerCase();
    const looksLikeHtml = mime.includes("text/html") ||
      /\\.(html?|aspx?)(?:[?#]|$)/i.test(finalUrl) ||
      /services\\.gst\\.gov\\.in\\/services\\/(login|error\\/accessdenied)/i.test(finalUrl);
    const expectedPdf = /GSTR3B_.*\\.pdf$/i.test(tracked.filename || "");
    const wrongPdfType = expectedPdf && (mime.includes("application/json") || mime.includes("text/plain") || mime.includes("text/html"));
    if (looksLikeHtml || wrongPdfType) {
      try { await chrome.downloads.removeFile(delta.id); } catch (_) {}
      try { await chrome.downloads.erase({id:delta.id}); } catch (_) {}
      if (tracked.tabId) {
        chrome.tabs.sendMessage(tracked.tabId,{
          type:"GST_DOWNLOAD_FAILED",
          error: expectedPdf
            ? "The GST Portal did not return a PDF file (it returned a login page or API error response). The invalid file was removed. Sign in again, confirm the GSTR-3B is available, and retry."
            : "The GST Portal returned an HTML login/access-denied page instead of the requested return ZIP. The invalid file was removed. Sign in again and retry."
        }).catch(()=>{});
      }
    }
  } catch (error) {
    console.warn("GST download validation:",error);
  }
});
