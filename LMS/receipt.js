const el=id=>document.getElementById(id);
el('print').onclick=()=>window.print();
const date=s=>new Date(s*1000).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
(async()=>{
  try{
    const id=new URLSearchParams(location.search).get('id');
    if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('This receipt link is invalid.');
    const response=await fetch(`/api/receipts/${id}`,{credentials:'same-origin'}),data=await response.json();
    if(response.status===401){location.replace('/LMS/?login=1&next=account');return;}
    if(!response.ok)throw Error(data.error||'Unable to load receipt.');
    const r=data.receipt,money=new Intl.NumberFormat(undefined,{style:'currency',currency:r.currency}).format(Number(r.amount));
    el('number').textContent=r.number;el('paid').textContent=date(r.paidAt);
    el('billed-name').textContent=r.billedTo.name;el('billed-org').textContent=r.billedTo.organization;el('billed-email').textContent=r.billedTo.email;
    el('item').textContent=r.item;el('access-period').textContent=r.accessStart&&r.accessEnd?`Access period: ${date(r.accessStart)} – ${date(r.accessEnd)}`:'';
    el('amount').textContent=money;el('total').textContent=money;el('method').textContent=r.paymentMethod;el('transaction').textContent=r.transactionId;
    document.title=`Receipt ${r.number} - Advanced CPE`;
    el('message').hidden=true;el('receipt').hidden=false;el('print').hidden=false;
  }catch(e){el('message').textContent=e.message;}
})();
