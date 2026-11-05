/* شعار سينما أسامة v2: أيقونة سينمائية + اسم إنجليزي مزخرف (Osama / CINEMA) — يعمل فوق logo.js دون تعديله */
(function(){
const EMB='<svg class="osama-logo osama-logo2" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg@" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff2b3"/><stop offset=".45" stop-color="#f5b942"/><stop offset="1" stop-color="#b8731a"/></linearGradient><linearGradient id="lb@" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2b2f77"/><stop offset=".55" stop-color="#5b2a86"/><stop offset="1" stop-color="#a1275f"/></linearGradient><radialGradient id="lh@" cx=".3" cy=".2" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="25" fill="url(#lb@)" stroke="url(#lg@)" stroke-width="3"/><g fill="url(#lg@)"><circle cx="32" cy="14.5" r="3.4"/><circle cx="47.2" cy="23.2" r="3.4"/><circle cx="47.2" cy="40.8" r="3.4"/><circle cx="32" cy="49.5" r="3.4"/><circle cx="16.8" cy="40.8" r="3.4"/><circle cx="16.8" cy="23.2" r="3.4"/></g><path d="M27 23.5v17l15-8.5z" fill="url(#lg@)" stroke="#fff4c8" stroke-width=".8" stroke-linejoin="round"/><circle cx="32" cy="32" r="25" fill="url(#lh@)"/><path d="M50 6l1.6 4.4L56 12l-4.4 1.6L50 18l-1.6-4.4L44 12l4.4-1.6z" fill="#fff4c8"/></svg>';
let n=0;
function apply(){
  document.querySelectorAll('.brand .brand-icon,.brand-compact .brand-icon').forEach(el=>{
    if(el.querySelector('.osama-logo2'))return;
    el.classList.add('has-logo','has-logo2');el.innerHTML=EMB.replace(/@/g,'_'+(++n));
  });
  document.querySelectorAll('.brand strong').forEach(s=>{
    if(s.dataset.en)return;s.dataset.en='1';s.removeAttribute('data-i18n');s.classList.add('brand-name','bn-en');s.textContent='Osama';
    const sm=s.parentElement&&s.parentElement.querySelector('small');if(sm){sm.removeAttribute('data-i18n');sm.classList.add('brand-tag','bt-en');sm.innerHTML='<i></i><span>CINEMA</span><i></i>'}
  });
  document.querySelectorAll('.brand-compact strong').forEach(s=>{
    if(s.dataset.en)return;s.dataset.en='1';s.removeAttribute('data-i18n');s.classList.add('brand-name','bn-en','bn-compact');s.innerHTML='Osama <em>Cinema</em>';
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
document.addEventListener('langchange',()=>setTimeout(apply,0));
new MutationObserver(()=>apply()).observe(document.body||document.documentElement,{childList:true,subtree:true});
})();
