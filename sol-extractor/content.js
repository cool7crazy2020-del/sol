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