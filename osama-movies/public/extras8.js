/* ===================================================================
   extras8.js — الإصدار 16: علامة التوثيق ✓ (على الصور والأسماء) + طلب التوثيق
   =================================================================== */
(function(){
const $=s=>document.querySelector(s);
const esc=s=>escapeHtml(String(s==null?'':s));
async function api(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Lang':I18N.lang()},body:body===undefined?undefined:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null,closeModal=()=>window.Extras&&Extras.closeModal();

async function openVerify(){
  if(!me){openAuth('login');return}
  let s;try{s=await api('/api/user/verification')}catch(e){toast(e.message,'error');return}
  let body;
  if(s.verified)body=`<div class="ver-state ok"><i class="vb vb-lg"></i><p>${esc(t('ver.is'))}</p></div>`;
  else if(s.mode==='pay'&&s.payment&&s.payment.status==='pending')body=`<div class="ver-state"><p>${esc(t('ver.payPending'))}</p></div>`;
  else if(s.mode==='pay')body=`<div class="ver-pay"><p class="ver-price">${esc(t('pay.price',{amount:fmt(s.pay.price),cur:s.pay.currency==='USD'?'$':t('cur.syp')}))}</p>
    <p class="plan-how">${esc(t('pay.step1'))}</p><div class="pw-account"><code id="vp-acc">${esc(s.pay.account)}</code><button class="ghost-btn" id="vp-copy" type="button"><i data-lucide="copy"></i><span>${esc(t('common.copy'))}</span></button></div>
    <p class="plan-how">${esc(t('ver.payStep2'))}</p>
    <form id="vp-form" class="pw-form" autocomplete="off"><input name="receipt" inputmode="numeric" maxlength="20" placeholder="${esc(t('pay.receipt'))}" required><button class="primary-btn" type="submit"><i data-lucide="badge-check"></i><span>${esc(t('ver.paySend'))}</span></button></form><div class="auth-error" id="vp-err"></div></div>`;
  else if(s.request&&s.request.status==='pending')body=`<div class="ver-state"><p>${esc(t('ver.pending'))}</p></div>`;
  else if(!s.eligible)body=`<div class="ver-state"><p>${esc(t('ver.needSub'))}</p><button class="primary-btn" id="vr-plans" type="button"><i data-lucide="crown"></i><span>${esc(t('ver.plans'))}</span></button></div>`;
  else body=`${s.request&&s.request.status==='rejected'?`<p class="ver-rej">${esc(t('ver.rejected'))}</p>`:''}<form id="vr-form" class="pub-form"><label><span>${esc(t('ver.note'))}</span><textarea name="note" rows="3" maxlength="300"></textarea></label><div class="auth-error" id="vr-err"></div><button class="primary-btn" type="submit"><i data-lucide="badge-check"></i><span>${esc(t('ver.send'))}</span></button></form>`;
  const el=modal(`<h3><i class="vb vb-lg"></i> ${esc(t('ver.title'))}</h3><p class="muted-p">${esc(t('ver.sub'))}</p>${body}`,{cls:'pub-card'});
  const vc=el.querySelector('#vp-copy');if(vc)vc.onclick=async()=>{try{await navigator.clipboard.writeText(el.querySelector('#vp-acc').textContent);toast(t('pay.copied'))}catch{toast(t('err.copyFailed'),'error')}};
  const vf=el.querySelector('#vp-form');
  if(vf){vf.receipt.oninput=e=>{e.target.value=e.target.value.replace(/[^0-9٠-٩۰-۹]/g,'')};
    vf.onsubmit=async e=>{e.preventDefault();const err=el.querySelector('#vp-err');err.textContent='';
      try{const d=await api('/api/user/verification/pay','POST',{receipt:vf.receipt.value});closeModal();toast(t(d.status==='approved'?'ver.payDone':'ver.payPending'),'success');if(d.status==='approved'&&me)me.verified=true}
      catch(x){err.textContent=x.message}}}
  const pl=el.querySelector('#vr-plans');if(pl)pl.onclick=()=>{closeModal();switchTab('plans')};
  const f=el.querySelector('#vr-form');
  if(f)f.onsubmit=async e=>{e.preventDefault();try{await api('/api/user/verification/request','POST',{note:f.note.value});toast(t('ver.sent'),'success');closeModal()}catch(x){el.querySelector('#vr-err').textContent=x.message}};
  icons();
}
function injectNav(){
  const nav=$('.side-nav');if(!nav||$('#nav-verify'))return;
  nav.insertAdjacentHTML('beforeend',`<button type="button" id="nav-verify"><i data-lucide="badge-check"></i><span>${esc(t('ver.nav'))}</span></button>`);
  $('#nav-verify').onclick=()=>{closeSidebar();openVerify()};icons();
}
document.addEventListener('langchange',()=>{const a=$('#nav-verify span');if(a)a.textContent=t('ver.nav')});
function init(){injectNav()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Cinema8={openVerify};
})();
