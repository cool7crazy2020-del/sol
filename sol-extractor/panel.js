const $=id=>document.getElementById(id);
let extracted=null;
function isTapstitch(tab){try{const u=new URL(tab?.url||"");return u.hostname==="tapstitch.com"||u.hostname==="www.tapstitch.com"}catch(_){return false}}
$("extractProduct").addEventListener("click",async()=>{
 const button=$("extractProduct"),status=$("extractStatus");button.disabled=true;status.textContent="Reading the active Tapstitch product page…";$("productPreview").replaceChildren();$("sendToStudio").disabled=true;extracted=null;
 try{
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if(!isTapstitch(tab))throw new Error("Open a Tapstitch product details page first.");
  const path=new URL(tab.url).pathname;
  if(path.includes("/order/checkout"))throw new Error("Open a product details page, not checkout.");
  const result=await chrome.tabs.sendMessage(tab.id,{type:"SOL_EXTRACT_TAPSTITCH"});
  if(!result?.ok)throw new Error(result?.error||"Product extraction failed.");
  extracted=result.data;
  const box=$("productPreview");
  const title=document.createElement("strong");title.textContent=extracted.title||"Untitled product";box.append(title);
  const meta=document.createElement("div");meta.className="meta";meta.textContent=(extracted.item?"Item: "+extracted.item+" · ":"")+extracted.images.length+" image(s)";box.append(meta);
  for(const [label,values] of [["Sizes",extracted.sizes],["Colors",extracted.colors]]){
   const line=document.createElement("div");line.className="meta";line.style.marginTop="8px";line.textContent=label+": ";
   (values||[]).forEach(value=>{const pill=document.createElement("span");pill.className="pill";pill.textContent=value;line.append(pill)});box.append(line);
  }
  const grid=document.createElement("div");grid.className="preview";
  extracted.images.slice(0,9).forEach(src=>{const img=document.createElement("img");img.src=src;img.alt="Extracted Tapstitch product mockup";img.loading="lazy";grid.append(img)});box.append(grid);
  $("sendToStudio").disabled=!extracted.images.length;status.textContent="Product extracted. Check the details and send them to Studio.";
 }catch(error){status.textContent=error.message||"Could not extract product."}
 finally{button.disabled=false}
});
$("sendToStudio").addEventListener("click",async()=>{
 if(!extracted)return;
 const button=$("sendToStudio");button.disabled=true;
 try{
  const url=new URL("https://shopsol.vercel.app/");
  url.hash="tapstitch-import="+encodeURIComponent(JSON.stringify(extracted));
  await chrome.tabs.create({url:url.href,active:true});
  $("extractStatus").textContent="SOL opened with the extracted product. Sign in if prompted and continue the import in Studio.";
 }catch(error){$("extractStatus").textContent="Could not open SOL Studio: "+error.message}
 finally{button.disabled=false}
});
$("fillAddress").addEventListener("click",async()=>{
 const button=$("fillAddress"),message=$("message");button.disabled=true;message.textContent="Preparing address…";
 try{
  let data;try{data=JSON.parse($("orderData").value)}catch(_){throw new Error("Paste valid SOL order JSON first.")}
  if(!data||!data.shipping_details)throw new Error("This order data has no shipping address.");
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if(!isTapstitch(tab)||!new URL(tab.url).pathname.includes("/order/checkout"))throw new Error("Open Tapstitch checkout and the Edit address form first.");
  const result=await chrome.tabs.sendMessage(tab.id,{type:"SOL_FILL_TAPSTITCH_ADDRESS",order:data});
  if(!result?.ok)throw new Error(result?.error||"Could not fill the address.");
  message.textContent=result.message||"Address fields filled. Review them carefully; nothing was saved or submitted.";
 }catch(error){message.textContent=error.message||"Could not prepare the order."}
 finally{button.disabled=false}
});