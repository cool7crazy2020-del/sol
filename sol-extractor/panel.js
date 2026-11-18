const $ = id => document.getElementById(id);
let latest = null, currentTabId = null;
async function activeTab() {
  const [tab] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
  currentTabId = tab?.id ?? null;
  const isTap = !!tab?.url && tab.url.includes("tapstitch.com/account/products-pool/product/");
  $("status").textContent = isTap ? "Tapstitch product page detected" : "Waiting for Tapstitch";
  $("product").textContent = isTap ? (tab.title || "Product page") : "Open a Tapstitch product";
  $("hint").textContent = isTap ? "Ready to collect product details and mockup images." : "Keep this panel open and switch to a signed-in Tapstitch product tab.";
  $("extract").disabled = !isTap;
  return isTap;
}
chrome.tabs.onActivated.addListener(() => activeTab());
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (tab.active && (info.status === "complete" || info.url)) activeTab(); });
$("extract").addEventListener("click", async () => {
  $("message").textContent = "Extracting…";
  $("send").hidden = true;
  try {
    const tab = await chrome.tabs.get(currentTabId);
    if (!tab?.url?.includes("tapstitch.com/account/products-pool/product/")) throw new Error("Switch to a Tapstitch product tab first.");
    const result = await chrome.tabs.sendMessage(currentTabId,{type:"SOL_EXTRACT_TAPSTITCH"});
    if (!result?.ok) throw new Error(result?.error || "Could not extract this page.");
    latest = result.data;
    $("product").textContent = latest.title || "Tapstitch product";
    $("message").textContent = latest.images.length + " mockup image URL(s) collected" + (latest.item ? " · Item " + latest.item : "") + (latest.colors?.length ? " · " + latest.colors.length + " color options" : " · no color labels") + (latest.sizes?.length ? " · " + latest.sizes.length + " sizes detected" : " · no sizes detected");
    $("preview").innerHTML = latest.images.slice(0,6).map(src => '<img src="'+src.replace(/&/g,"&amp;").replace(/"/g,"&quot;")+'" alt="Mockup preview">').join("");
    $("send").hidden = false;
  } catch (error) { $("message").textContent = error.message || "Extraction failed."; }
});
$("send").addEventListener("click", async () => {
  if (!latest) return;
  const url = "https://cool7crazy2020-del.github.io/sol/?import=" + Date.now() + "#tapstitch-import=" + encodeURIComponent(JSON.stringify(latest));
  const existing = await chrome.tabs.query({url:["https://cool7crazy2020-del.github.io/sol/*"]});
  if (existing.length) {
    await chrome.tabs.update(existing[0].id,{url,active:true});
    if (existing[0].windowId !== undefined) await chrome.windows.update(existing[0].windowId,{focused:true});
  } else {
    await chrome.tabs.create({url,active:true});
  }
  $("message").textContent = "Sent to your SOL Studio tab. The current product draft will be continued.";
});
activeTab();
