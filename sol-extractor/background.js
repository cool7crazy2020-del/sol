chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});
chrome.tabs.onActivated.addListener(async ({tabId}) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.storage.session.set({ activeTapstitchTab: tab.url && tab.url.includes("tapstitch.com/account/products-pool/product/") ? tabId : null });
  } catch (_) {}
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    try {
      if (tab.active) await chrome.storage.session.set({ activeTapstitchTab: tab.url && tab.url.includes("tapstitch.com/account/products-pool/product/") ? tabId : null });
    } catch (_) {}
  }
});
