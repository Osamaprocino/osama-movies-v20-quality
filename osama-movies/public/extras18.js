/* v20 — extras18: تنبيه انقطاع/عودة الاتصال • انتقال دائري عند تبديل الوضع الداكن • مزامنة theme-color. كلها تحترم no-motion. */
(()=>{const root=document.documentElement;
const L=()=>{try{return (window.I18N&&I18N.lang&&I18N.lang())||root.lang||'ar'}catch{return 'ar'}};
const T3=(a,e,r)=>({ar:a,en:e,ru:r})[L()]||a;
const calm=()=>root.classList.contains('no-motion')||matchMedia('(prefers-reduced-motion:reduce)').matches;
/* 1) حالة الاتصال */
let bar,tm;
function show(ok,msg){if(!bar){bar=document.createElement('div');bar.className='net-bar';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');bar.innerHTML='<i></i><span></span>';document.body.appendChild(bar)}
 bar.classList.toggle('ok',ok);bar.querySelector('span').textContent=msg;requestAnimationFrame(()=>bar.classList.add('on'));clearTimeout(tm);if(ok)tm=setTimeout(()=>bar.classList.remove('on'),2600)}
addEventListener('offline',()=>show(false,T3('انقطع الاتصال — بعض المحتوى المحفوظ ما زال متاحاً','You are offline — saved content is still available','Нет соединения — сохранённое содержимое доступно')));
addEventListener('online',()=>show(true,T3('عاد الاتصال','Back online','Соединение восстановлено')));
if(navigator.onLine===false)document.addEventListener('DOMContentLoaded',()=>show(false,T3('انقطع الاتصال','You are offline','Нет соединения')));
/* 2) theme-color يتبع الوضع (شريط الحالة في الهاتف) */
function syncTheme(){let m=document.querySelector('meta[name="theme-color"]:not([media])');if(!m)return;m.setAttribute('content',root.classList.contains('dark')?'#0f1620':'#eef3fb')}
new MutationObserver(syncTheme).observe(root,{attributes:true,attributeFilter:['class']});syncTheme();
/* 3) انتقال دائري من زر المظهر */
function hook(){const b=document.getElementById('theme-btn');if(!b||b.dataset.fx18)return;b.dataset.fx18='1';
 b.addEventListener('click',e=>{const orig=b.onclick;if(typeof orig!=='function'||!document.startViewTransition||calm())return;
  e.stopImmediatePropagation();e.preventDefault();
  const r=b.getBoundingClientRect(),x=e.clientX||r.left+r.width/2,y=e.clientY||r.top+r.height/2;
  const R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));root.classList.add('fx18-theme');
  let t;try{t=document.startViewTransition(()=>{orig.call(b,e)})}catch{orig.call(b,e);root.classList.remove('fx18-theme');return}
  t.ready.then(()=>{root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${R}px at ${x}px ${y}px)`]},{duration:520,easing:'cubic-bezier(.2,.8,.2,1)',pseudoElement:'::view-transition-new(root)'})}).catch(()=>{});
  t.finished.finally(()=>root.classList.remove('fx18-theme'))},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
const mo=new MutationObserver(()=>{hook();const b=document.getElementById('theme-btn');if(b&&b.dataset.fx18)mo.disconnect()});mo.observe(root,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),15000);
})();
