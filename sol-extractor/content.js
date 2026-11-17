function solExtractTapstitchProduct() {
  const candidates = [...document.images].map(img => ({
    src: img.currentSrc || img.src || img.dataset.src || img.getAttribute("data-original"),
    width: img.naturalWidth || img.width || 0,
    height: img.naturalHeight || img.height || 0,
    alt: img.alt || ""
  })).filter(x => x.src && /^https?:/i.test(x.src) && x.width >= 180 && x.height >= 180);
  const unique = [...new Map(candidates.map(x => [x.src, x])).values()]
    .sort((a,b) => (b.width*b.height) - (a.width*a.height))
    .slice(0, 20);
  const title = document.querySelector("h1")?.innerText?.trim()
    || document.querySelector("[class*=title]")?.innerText?.trim()
    || document.title;
  const body = document.body.innerText || "";
  const item = body.match(/Item number:\\s*([A-Z0-9-]+)/i)?.[1] || "";
  const sizes = [...document.querySelectorAll("button,[role=button],[class*=size]")].map(el => (el.innerText || "").trim())
    .filter(x => /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|One size)$/i.test(x));
  return { source: location.href, title, item, sizes: [...new Set(sizes)], images: unique.map(x => x.src) };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SOL_EXTRACT_TAPSTITCH") return;
  try {
    const data = solExtractTapstitchProduct();
    if (!data.images.length) {
      sendResponse({ok:false,error:"No large product images detected. Scroll through the product gallery first, then try again."});
    } else {
      sendResponse({ok:true,data});
    }
  } catch (error) {
    sendResponse({ok:false,error:error.message || "Extraction failed."});
  }
  return true;
});
