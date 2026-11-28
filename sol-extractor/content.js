function solExtractTapstitchProduct() {
  const candidates = [...document.images].map(img => ({
    src: img.currentSrc || img.src || img.dataset.src || img.getAttribute("data-original"),
    width: img.naturalWidth || img.width || 0,
    height: img.naturalHeight || img.height || 0,
    alt: img.alt || ""
  })).filter(x => x.src && /^https?:/i.test(x.src) && x.width >= 180 && x.height >= 180);
  const unique = [...new Map(candidates.map(x => [x.src, x])).values()].sort((a,b) => (b.width*b.height) - (a.width*a.height)).slice(0, 20);
  const title = document.querySelector("h1")?.innerText?.trim() || document.querySelector("[class*=title]")?.innerText?.trim() || document.title;
  const body = document.body.innerText || "";
  const item = body.match(/Item number:\s*([A-Z0-9-]+)/i)?.[1] || "";
  const sizePattern = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|XXXL|4XL|XXXXL|5XL|OS|ONE SIZE|ONE-SIZE|FREE SIZE|\d{2,3})$/i;
  const sizeNodes = [...document.querySelectorAll('button,[role="button"],label,[class*="size"],[data-size]')];
  const sizes = [...new Set(sizeNodes.map(el => {
    const raw = (el.getAttribute("data-size") || el.getAttribute("aria-label") || el.innerText || el.textContent || "").trim().replace(/\s+/g," ");
    return sizePattern.test(raw) ? raw.toUpperCase().replace("ONE-SIZE","ONE SIZE").replace("FREE SIZE","ONE SIZE") : "";
  }).filter(Boolean))];
  const palette = ["Off White","Heather Grey","Light Grey","Dark Grey","Charcoal","Navy","Royal Blue","Sky Blue","Baby Blue","Forest Green","Olive","Sage","Burgundy","Wine Red","Hot Pink","Dusty Pink","Cream","Ivory","Beige","Khaki","Brown","Black","White","Gray","Grey","Blue","Red","Green","Pink","Purple","Yellow","Orange"];
  const colorNodes = [...document.querySelectorAll('button,[role="button"],[data-color],[data-colour],[class*="swatch"],[class*="color"],[class*="colour"]')].slice(0,700);
  const colors = [];
  for (const el of colorNodes) {
    const raw = [el.getAttribute("data-color"),el.getAttribute("data-colour"),el.getAttribute("aria-label"),el.getAttribute("title"),el.innerText].filter(Boolean).join(" ");
    if (!raw || raw.length > 90) continue;
    for (const name of palette) {
      const pattern = new RegExp("\\b"+name.toLowerCase().replace(/ /g,"\\s+")+"\\b","i");
      if (pattern.test(raw) && !colors.includes(name)) colors.push(name);
    }
    const hex = raw.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\\b/i)?.[0];
    if (hex && /color|colour|swatch/i.test(String(el.className)+" "+raw) && !colors.includes(hex.toUpperCase())) colors.push(hex.toUpperCase());
  }
  return { source: location.href, title, item, sizes: [...new Set(sizes)], colors: colors.slice(0,20), images: unique.map(x => x.src) };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SOL_EXTRACT_TAPSTITCH") return;
  try {
    const data = solExtractTapstitchProduct();
    if (!data.images.length) sendResponse({ok:false,error:"No large product images detected. Scroll through the product gallery first, then try again."});
    else sendResponse({ok:true,data});
  } catch (error) { sendResponse({ok:false,error:error.message || "Extraction failed."}); }
  return true;
});

function solSetField(el,value){
 if(!el||value==null||String(value).trim()==="")return false;
 const setter=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
 const descriptor=Object.getOwnPropertyDescriptor(setter,"value");
 if(descriptor?.set)descriptor.set.call(el,String(value));else el.value=String(value);
 el.dispatchEvent(new Event("input",{bubbles:true}));
 el.dispatchEvent(new Event("change",{bubbles:true}));
 el.dispatchEvent(new Event("blur",{bubbles:true}));
 return true;
}
function solFindInput(patterns){
 const fields=[...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]),textarea")];
 return fields.find(el=>{
  const text=[el.name,el.id,el.placeholder,el.getAttribute("aria-label"),el.getAttribute("autocomplete"),el.parentElement?.innerText].filter(Boolean).join(" ").toLowerCase();
  return patterns.some(p=>p.test(text));
 });
}
function solFindSelect(patterns){
 const fields=[...document.querySelectorAll("select")];
 return fields.find(el=>{
  const text=[el.name,el.id,el.getAttribute("aria-label"),el.parentElement?.innerText].filter(Boolean).join(" ").toLowerCase();
  return patterns.some(p=>p.test(text));
 });
}
function solFillAddress(order){
 const ship=order.shipping_details||{};
 const address=ship.address||ship;
 const name=String(ship.name||"").trim().split(/\s+/);
 const first=ship.first_name||name.shift()||"";
 const last=ship.last_name||name.join(" ");
 const phone=ship.phone||address.phone||"";
 const fields=[
  [solFindInput([/first.?name/]),first],
  [solFindInput([/last.?name/]),last],
  [solFindInput([/phone|tel/]),phone],
  [solFindInput([/address.?line.?1|street address|address line/]),address.line1],
  [solFindInput([/address.?line.?2|apartment|suite|unit/]),address.line2],
  [solFindInput([/^city$|town/]),address.city],
  [solFindInput([/postal|zip/]),address.postal_code]
 ];
 let filled=0;
 for(const [el,value] of fields)if(el&&solSetField(el,value))filled++;
 const state=address.state;
 const country=address.country;
 const stateSelect=solFindSelect([/state|province|region/]);
 const countrySelect=solFindSelect([/country/]);
 if(stateSelect&&state&&solSetField(stateSelect,state))filled++;
 if(countrySelect&&country&&solSetField(countrySelect,country))filled++;
 const missing=[];
 if(!address.line1)missing.push("street address");
 if(!address.city)missing.push("city");
 if(!state)missing.push("state");
 if(!address.postal_code)missing.push("ZIP/postal code");
 if(!filled)return {ok:false,error:"No matching address fields were detected. Open Edit address and try again."};
 return {ok:true,message:filled+" field(s) filled. "+(missing.length?"Check missing details: "+missing.join(", ")+". ":"")+"Review all values manually. Nothing was saved or submitted."};
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type!=="SOL_FILL_TAPSTITCH_ADDRESS")return;
 try{sendResponse(solFillAddress(message.order||{}))}
 catch(error){sendResponse({ok:false,error:error.message||"Address fill failed."})}
 return true;
});