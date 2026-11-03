chrome.action.onClicked.addListener(async tab => { if (!tab?.id || !/^https:\/\/(services|return)\.gst\.gov\.in\//.test(tab.url || '')) return; try { await chrome.tabs.sendMessage(tab.id,{type:'GST_TOGGLE_PANEL'}); } catch(e) { try { await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']}); await chrome.tabs.sendMessage(tab.id,{type:'GST_TOGGLE_PANEL'}); } catch(err) { console.error(err); } } });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "GST_NATIVE_DOWNLOAD") return false;
  (async () => {
    try {
      const parsed = new URL(String(message.url || ""));
      if (parsed.protocol !== "https:" || !["return.gst.gov.in","files.gst.gov.in"].includes(parsed.hostname)) {
        throw new Error("Blocked download URL: GST Portal host not allowed.");
      }
      const filename = String(message.filename || "GST_Return_Download.zip")
        .replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "").slice(0, 160);
      const downloadId = await chrome.downloads.download({
        url: parsed.href,
        filename: filename || "GST_Return_Download.zip",
        saveAs: false,
        conflictAction: "uniquify"
      });
      sendResponse({ok:true,downloadId});
    } catch (error) {
      sendResponse({ok:false,error:error && error.message ? error.message : String(error)});
    }
  })();
  return true;
});
