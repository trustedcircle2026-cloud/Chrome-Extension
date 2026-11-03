(() => {
 if (window.__gstReportDownloaderLoaded) return;
 window.__gstReportDownloaderLoaded = true;
 const clean = v => (v || "").replace(/\s+/g, " ").trim();
 const textOf = e => clean(e && (e.innerText || e.textContent));
 const stateNames = {"01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh","05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh","10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh","24":"Gujarat","26":"Dadra and Nagar Haveli and Daman and Diu","27":"Maharashtra","29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry","35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh","38":"Ladakh","97":"Other Territory"};
 const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
 const monthRe = /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*[-–/ ]\s*(20\d{2})/i;
 function parseMonth(s) {
   const m = clean(s).match(monthRe); if (!m) return null;
   const i = monthNames.findIndex(x => x.slice(0,3).toLowerCase() === m[1].slice(0,3).toLowerCase());
   return i < 0 ? null : {period:monthNames[i]+" "+m[2],monthIndex:i,year:Number(m[2])};
 }
 function details() {
   const body = document.body.innerText || "";
   const gst = body.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/);
   const gstin = gst ? gst[0] : "";
   let trade = "";
   const welcome = body.match(/Welcome\s+(.+?)\s+to\s+(?:the\s+)?(?:Goods|GST|Dashboard)/i) || body.match(/Welcome\s+(.+?)\s+to\b/i);
   if (welcome) trade = clean(welcome[1]);
   if (!trade) {
     for (const sel of [".user-name",".taxpayer-name",".trade-name","#tradeName","[data-testid*=trade]","[title*=trade i]"]) {
       const t = textOf(document.querySelector(sel));
       if (t && t.length < 120 && !/welcome|logout|last login/i.test(t)) { trade=t; break; }
     }
   }
   if (!trade) {
     const lines = body.split(/\n/).map(clean).filter(Boolean);
     const idx = lines.findIndex(x => /^welcome$/i.test(x));
     if (idx >= 0 && lines[idx+1] && !/to goods|to gst/i.test(lines[idx+1])) trade=lines[idx+1];
   }
   const code = gstin ? gstin.slice(0,2) : "";
   return {gstin,tradeName:trade,state:stateNames[code] || (code ? "GST state code "+code : "")};
 }
 function scan() {
   const map = new Map();
   function ensure(info) {
     if (!map.has(info.period)) map.set(info.period,{...info,"GSTR-1":"Not detected","GSTR-3B":"Not detected","GSTR-2A":"Not detected","GSTR-2B":"Not detected",actions:[]});
     return map.get(info.period);
   }
   function statusFrom(s) {
     if (/not filed|not submitted|pending|overdue/i.test(s)) return "Not filed";
     if (/filed|submitted|success|processed/i.test(s)) return "Filed";
     if (/due/i.test(s)) return "Due";
     return "Status shown";
   }
   const candidates = [...document.querySelectorAll("tr,[role=row],.return-period,.month-card,.return-card,.card")];
   for (const el of candidates) {
     const t = textOf(el); if (!t || t.length > 1800) continue;
     const info = parseMonth(t); if (!info) continue;
     const row = ensure(info);
     for (const type of ["GSTR-1","GSTR-3B","GSTR-2A","GSTR-2B"]) {
       const pattern = type === "GSTR-1" ? /GSTR\s*[- ]?\s*1/i :
         type === "GSTR-3B" ? /GSTR\s*[- ]?\s*3\s*B/i :
         type === "GSTR-2A" ? /GSTR\s*[- ]?\s*2\s*A/i : /GSTR\s*[- ]?\s*2\s*B/i;
       if (pattern.test(t)) {
         const match = t.match(/not filed|not submitted|pending|filed|submitted|due|processed/i);
         row[type] = match ? statusFrom(match[0]) : "Listed";
       }
     }
     for (const c of el.querySelectorAll("a,button,[role=button]")) {
       const label = textOf(c) || c.getAttribute("aria-label") || c.getAttribute("title") || "";
       if (/download|view|filed|details/i.test(label)) row.actions.push({label:label.slice(0,35)});
     }
   }
   const lines = (document.body.innerText || "").split(/\n/).map(clean).filter(Boolean);
   for (let i=0;i<lines.length;i++) {
     const info = parseMonth(lines[i]); if (!info) continue;
     const context = lines.slice(i,Math.min(i+7,lines.length)).join(" | ");
     const row = ensure(info);
     for (const type of ["GSTR-1","GSTR-3B","GSTR-2A","GSTR-2B"]) {
       const pattern = type === "GSTR-1" ? /GSTR\s*[- ]?\s*1/i :
         type === "GSTR-3B" ? /GSTR\s*[- ]?\s*3\s*B/i :
         type === "GSTR-2A" ? /GSTR\s*[- ]?\s*2\s*A/i : /GSTR\s*[- ]?\s*2\s*B/i;
       if (pattern.test(context)) {
         const match = context.match(/not filed|not submitted|pending|filed|submitted|due|processed/i);
         row[type] = match ? statusFrom(match[0]) : "Listed";
       }
     }
   }
   return [...map.values()].sort((a,b)=>a.year-b.year||a.monthIndex-b.monthIndex);
 }
 chrome.runtime.onMessage.addListener((msg,sender,send) => {
   if (msg.type === "GST_SCAN") { send({...details(),periods:scan(),url:location.href,pageTitle:document.title}); return true; }
   if (msg.type === "GST_ACTIVATE_ACTION" || msg.type === "GST_DOWNLOAD") {
     send({ok:false,message:"Report-specific download actions are not yet connected to a verified GST Portal control. Open the report in the portal and download it there; the dashboard currently displays detected filing information only."}); return true;
   }
 });
})();