/* extras10.js — v18: «عنّي والتواصل» (من أنا • أمان الموقع • تواصل مع الدعم بأيقونات تنقلك مباشرة) */
(function(){
const $=s=>document.querySelector(s);const esc=s=>escapeHtml(String(s==null?'':s));
const lg=()=>I18N.lang();const T=(a,e,r)=>lg()==='en'?e:lg()==='ru'?r:a;
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null;
const ICON={
 whatsapp:{c:'#25D366',svg:'<svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2.6a9.4 9.4 0 0 0-8 14.3L2.6 21.4l4.6-1.3A9.4 9.4 0 1 0 12 2.6z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path fill="#fff" d="M8.7 7.7c.3-.4.7-.4 1-.1l1 1.6c.2.4.1.7-.2 1l-.6.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.6c.3-.3.7-.4 1-.2l1.6 1c.4.3.4.7.1 1-.6.9-1.5 1.3-2.5 1-2.8-.9-5-3.1-5.9-5.9-.2-.8 0-1.7.5-2.4z"/></svg>'},
 telegram:{c:'#27A7E7',svg:'<svg viewBox="0 0 24 24" width="30" height="30"><path fill="#fff" d="M21.8 3.3 2.6 10.8c-.9.4-.9 1.1.1 1.4l4.9 1.5 1.9 5.9c.2.6.8.7 1.2.3l2.7-2.5 5 3.7c.7.5 1.5.2 1.7-.7L23.3 4.8c.3-1.2-.5-1.9-1.5-1.5z"/><path d="m8.5 13.4 9.3-6.1-7.4 7.4-.3 3.3z" fill="#27A7E7" opacity=".55"/></svg>'},
 tiktok:{c:'#111',svg:'<svg viewBox="0 0 24 24" width="30" height="30"><path fill="#25F4EE" transform="translate(-.9 .7)" d="M16.6 2h-3.2v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.1a6.1 6.1 0 1 0 5.3 6V8.4a7.6 7.6 0 0 0 4.4 1.4V6.6a4.5 4.5 0 0 1-4.4-4.6z"/><path fill="#FE2C55" transform="translate(.9 -.7)" d="M16.6 2h-3.2v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.1a6.1 6.1 0 1 0 5.3 6V8.4a7.6 7.6 0 0 0 4.4 1.4V6.6a4.5 4.5 0 0 1-4.4-4.6z"/><path fill="#fff" d="M16.6 2h-3.2v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.1a6.1 6.1 0 1 0 5.3 6V8.4a7.6 7.6 0 0 0 4.4 1.4V6.6a4.5 4.5 0 0 1-4.4-4.6z"/></svg>'},
 instagram:{c:'linear-gradient(45deg,#feda75,#fa7e1e 28%,#d62976 55%,#962fbf 78%,#4f5bd5)',svg:'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="#fff" stroke="none"/></svg>'},
};
let cache=null;
async function load(){if(cache)return cache;const r=await fetch('/api/about');cache=await r.json();return cache}
function paras(t){return String(t||'').split(/\n\n+/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('')}
function contactHTML(d,tx){
  return `<div class="ab-contact"><h4>${esc(tx.contactTitle)}</h4><p class="ab-hint">${esc(tx.contactHint)}</p>
   <div class="ab-icons">${d.links.map(l=>{const i=ICON[l.id]||{c:'#555',svg:''};return `<a class="ab-ic" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(l.label)}" data-id="${esc(l.id)}"><span style="background:${i.c}">${i.svg}</span><b>${esc(l.label)}</b></a>`}).join('')}</div></div>`;
}
async function openAbout(tab){
  let d;try{d=await load()}catch{return}
  const lang=lg(),tx=d.texts[lang]||d.texts.ar;tab=tab||'about';
  const el=modal(`<div class="ab-head"><span class="ab-av">${esc((d.owner||'O')[0])}</span><div><h3>${esc(d.owner)}</h3><small>Osama Cinema</small></div></div>
   <div class="ab-tabs" role="tablist"><button type="button" data-t="about">${esc(tx.aboutTitle)}</button><button type="button" data-t="security">${esc(tx.securityTitle)}</button><button type="button" data-t="contact">${esc(tx.contactTitle)}</button></div>
   <div class="ab-body" id="ab-body"></div>`,{cls:'pub-card ab-card'});
  if(!el)return;
  const body=el.querySelector('#ab-body');
  const show=t=>{el.querySelectorAll('.ab-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
    body.innerHTML=t==='contact'?contactHTML(d,tx):(t==='security'?`<h4>${esc(tx.securityTitle)}</h4>`+paras(tx.security):`<h4>${esc(tx.aboutTitle)}</h4>`+paras(tx.about))+(t==='contact'?'':contactHTML(d,tx));body.scrollTop=0};
  el.querySelectorAll('.ab-tabs button').forEach(b=>b.onclick=()=>show(b.dataset.t));show(tab);
}
function injectNav(){
  const nav=$('.side-nav');if(!nav||$('#nav-about'))return;
  nav.insertAdjacentHTML('beforeend',`<button type="button" id="nav-about"><i data-lucide="message-circle-heart"></i><span>${esc(T('عنّي والتواصل','About & contact','Обо мне и связь'))}</span></button>`);
  $('#nav-about').onclick=()=>{try{closeSidebar()}catch{}openAbout('about')};if(window.lucide)lucide.createIcons();
}
document.addEventListener('langchange',()=>{cache=null;const s=$('#nav-about span');if(s)s.textContent=T('عنّي والتواصل','About & contact','Обо мне и связь')});
function init(){injectNav();const p=new URLSearchParams(location.search);if(p.get('about'))setTimeout(()=>openAbout(p.get('about')==='contact'?'contact':p.get('about')==='security'?'security':'about'),600)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Cinema10={openAbout};
})();
