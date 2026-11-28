const $=id=>document.getElementById(id);
$("fillAddress").addEventListener("click",async()=>{
 const button=$("fillAddress"),message=$("message");button.disabled=true;message.textContent="Preparing address…";
 try{
  let data;try{data=JSON.parse($("orderData").value)}catch(_){throw new Error("Paste valid SOL order JSON first.")}
  if(!data||!data.shipping_details)throw new Error("This order data has no shipping address.");
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if(!tab?.url||!tab.url.includes("tapstitch.com/order/checkout"))throw new Error("Open the Tapstitch checkout page first.");
  const result=await chrome.tabs.sendMessage(tab.id,{type:"SOL_FILL_TAPSTITCH_ADDRESS",order:data});
  if(!result?.ok)throw new Error(result?.error||"Could not fill the address.");
  message.textContent=result.message||"Address fields filled. Review them carefully; nothing was saved or submitted.";
 }catch(error){message.textContent=error.message||"Could not prepare the order."}
 finally{button.disabled=false}
});