/* extras14.js — v20.1: إضاءة محيطة من لون ملصق الفيلم • حد متوهج للبطاقات • عنوان كلمة كلمة • لمعات المؤشر (اختيارية) •
   قصاصات احتفال عند التسجيل • رابط تخطّي للوصولية. يحترم no-motion وإعدادات الموقع/الزائر (fx.glowborder / fx.sparkles). */
(function(){
const root=document.documentElement;
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||root.classList.contains('no-motion');
const rd=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
let fx={glowborder:false,sparkles:false};
const loadFx=()=>{const s=rd('osama_fx_site')||{};const u=rd('osama_fx')||{};const allow=s.allowUserCustom!==false;fx={glowborder:false,sparkles:false,...s,...(allow?u:{})};fx.glowborder=false;root.classList.remove('fx-gb')};
loadFx();
fetch('/api/site-ui',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.fx){try{localStorage.setItem('osama_fx_site',JSON.stringify(d.fx))}catch{}loadFx()}}).catch(()=>{});
window.addEventListener('osama:fx-changed',loadFx);

/* 1) إضاءة محيطة: اللون الغالب لملصق الفيلم في البطل (نفس الأصل فقط لتفادي حجب canvas) */
const cache=new Map();
function dominant(img){
  try{
    if(cache.has(img.src))return cache.get(img.src);
    const c=document.createElement('canvas');c.width=c.height=24;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,24,24);
    const d=g.getImageData(0,0,24,24).data;let r=0,gg=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){const R=d[i],G=d[i+1],B=d[i+2],mx=Math.max(R,G,B),mn=Math.min(R,G,B);if(mx<40||mn>225)continue;const sat=(mx-mn)/(mx||1);const w=.3+sat;r+=R*w;gg+=G*w;b+=B*w;n+=w}
    if(!n)return null;const v=[Math.round(r/n),Math.round(gg/n),Math.round(b/n)];cache.set(img.src,v);return v;
  }catch{return null}
}
function ambient(){
  const h=document.querySelector('.hero');if(!h)return;const im=h.querySelector('.hero-poster img');
  const set=v=>{const s=v.join(',');h.style.setProperty('--amb',s);root.style.setProperty('--amb-page',s)};
  if(!im||!im.src){return}
  const go=()=>{const v=dominant(im);if(v)set(v)};
  if(im.complete&&im.naturalWidth)go();else im.addEventListener('load',go,{once:true});
}
new MutationObserver(()=>{const im=document.querySelector('.hero .hero-poster img');if(im&&im.__amb!==im.src){im.__amb=im.src;ambient()}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
ambient();

/* 2) عنوان البطل كلمة كلمة عند تغيّره */
function splitTitle(){
  const t=document.getElementById('hero-title');if(!t||reduce())return;const txt=(t.textContent||'').trim();if(!txt||t.__txt===txt)return;t.__txt=txt;
  t.textContent='';txt.split(/\s+/).forEach((w,i,a)=>{const s=document.createElement('span');s.className='fx14-w';s.style.animationDelay=(i*.07)+'s';s.textContent=w;t.appendChild(s);if(i<a.length-1)t.appendChild(document.createTextNode(' '))});
}
const ht=document.getElementById('hero-title');
if(ht){let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;setTimeout(()=>{const txt=[...ht.querySelectorAll('.fx14-w')].length?ht.textContent.trim():null;if(txt===null||txt!==ht.__txt){ht.__txt=null;splitTitle()}busy=false},60)}).observe(ht,{childList:true,characterData:true,subtree:true});splitTitle()}

/* 3) لمعات خلف المؤشر (إيقاف افتراضياً — تُفعَّل من الإعدادات) */
if(matchMedia('(hover:hover) and (pointer:fine)').matches){
  let last=0;addEventListener('pointermove',e=>{
    if(!fx.sparkles||reduce())return;const t=performance.now();if(t-last<45)return;last=t;
    const s=document.createElement('i');s.className='fx14-spark';s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';s.style.setProperty('--sx',(Math.random()*30-15)+'px');s.style.setProperty('--sy',(Math.random()*30+6)+'px');document.body.appendChild(s);setTimeout(()=>s.remove(),850)
  },{passive:true});
}

/* 4) احتفال عند إنشاء حساب جديد بنجاح */


/* 5) وصولية: رابط «تخطي للمحتوى» */
document.addEventListener('DOMContentLoaded',()=>{if(document.querySelector('.fx14-skip'))return;const m=document.querySelector('main,.content,.app-main,#home-view');if(!m)return;if(!m.id)m.id='fx14-main';m.setAttribute('tabindex','-1');
  const a=document.createElement('a');a.className='fx14-skip';a.href='#'+m.id;a.textContent=({ar:'تخطّي إلى المحتوى',en:'Skip to content',ru:'К содержимому'})[document.documentElement.lang]||'تخطّي إلى المحتوى';a.onclick=e=>{e.preventDefault();m.focus();m.scrollIntoView()};document.body.prepend(a)});
})();
