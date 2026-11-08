/* v20 — extras20: (1) نص زر المظهر يتبع حالته للقارئات (2) ظهور تدريجي متدرّج للبطاقات عند دخولها الشاشة */
(()=>{const root=document.documentElement;
const calm=()=>root.classList.contains('no-motion')||matchMedia('(prefers-reduced-motion:reduce)').matches;
/* 1) aria-label/title لزر المظهر (script.js يعيد كتابة محتواه عند كل تبديل) */
function lab(){const b=document.getElementById('theme-btn');if(!b)return;const s=b.querySelector('span'),t=s&&s.textContent.trim();if(t){b.setAttribute('aria-label',t);b.title=t}}
function watchTheme(){const b=document.getElementById('theme-btn');if(!b)return false;lab();new MutationObserver(lab).observe(b,{childList:true,subtree:true,characterData:true});return true}
if(!watchTheme())document.addEventListener('DOMContentLoaded',watchTheme);
/* 2) ظهور البطاقات */
if(!('IntersectionObserver' in window))return;
let queue=[],flush=0;
const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){io.unobserve(e.target);queue.push(e.target)}
 if(queue.length&&!flush)flush=requestAnimationFrame(()=>{flush=0;const q=queue;queue=[];q.sort((a,b)=>{const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();return (A.top-B.top)||(A.left-B.left)});
  q.forEach((el,i)=>{el.style.setProperty('--cv-i',String(Math.min(i,11)));el.classList.add('cv-in');el.classList.remove('cv-pre');el.addEventListener('animationend',()=>{el.classList.remove('cv-in');el.style.removeProperty('--cv-i')},{once:true})})})},{rootMargin:'0px 0px -4% 0px',threshold:.05});
const seen=new WeakSet();
function prep(card){if(seen.has(card))return;seen.add(card);if(calm())return;card.classList.add('cv-pre');io.observe(card)}
function scan(r){if(r.nodeType!==1)return;if(r.matches&&r.matches('.movie-card'))prep(r);r.querySelectorAll&&r.querySelectorAll('.movie-card').forEach(prep)}
scan(document.body||root);
new MutationObserver(ms=>{for(const m of ms)m.addedNodes.forEach(scan)}).observe(document.documentElement,{childList:true,subtree:true});
/* شبكة أمان: لا تبقى بطاقة مخفية أبداً */
setInterval(()=>{document.querySelectorAll('.movie-card.cv-pre').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0&&!el.closest('.hidden')&&getComputedStyle(el).display!=='none'&&!el.dataset.cvw){el.dataset.cvw=String(Date.now())}else if(el.dataset.cvw&&Date.now()-el.dataset.cvw>2500){el.classList.remove('cv-pre')}})},1500);
})();
