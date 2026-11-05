/* زر فاتح/داكن للوحة الإدارة (يتذكّر الاختيار ويتبع نظام الجهاز افتراضياً) */
(function(){
const K='adm-theme';let cur;
try{cur=localStorage.getItem(K)}catch{}
if(!cur)cur=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
const root=document.documentElement;
const SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function apply(){root.classList.toggle('adm-dark',cur==='dark');const b=document.getElementById('adm-theme');if(b){b.innerHTML=cur==='dark'?SUN:MOON;b.title=cur==='dark'?'الوضع الفاتح':'الوضع الداكن';b.setAttribute('aria-label',b.title)}}
apply();
function mount(){
  if(document.getElementById('adm-theme'))return;
  const b=document.createElement('button');b.id='adm-theme';b.type='button';
  b.onclick=()=>{cur=cur==='dark'?'light':'dark';try{localStorage.setItem(K,cur)}catch{}apply()};
  const bar=document.querySelector('.admin-topbar');
  if(bar){bar.appendChild(b)}else{b.classList.add('adm-fixed-theme');document.body.appendChild(b)}
  apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();

