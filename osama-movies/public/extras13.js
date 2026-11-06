/* extras13.js — v20: الشريط السفلي بحافة منحنية. أيقونات SVG مدمجة (لا تعتمد على أي CDN)،
   إعدادات الموقع من لوحة التحكم، وتخصيص خاص بهاتف الزائر فقط (localStorage). */
(function(){
const top=document.querySelector('.topbar');
if(top){const f=e=>{const el=e&&e.target&&e.target.scrollTop!==undefined&&e.target!==document?e.target:document.scrollingElement;top.classList.toggle('fx13-scrolled',(el?el.scrollTop:0)>10)};addEventListener('scroll',f,{passive:true,capture:true})}
const nav=document.querySelector('.bottom-nav');if(!nav)return;
const root=document.documentElement;
/* ---- أيقونات مدمجة: تظهر دائماً حتى لو حُجب CDN ---- */
const ICONS={
 house:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 zap:'<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
 bookmark:'<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
 history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
 'layout-dashboard':'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'
};
nav.querySelectorAll(':scope>button>i[data-lucide],:scope>a>i[data-lucide]').forEach(i=>{
  const p=ICONS[i.getAttribute('data-lucide')];if(!p)return;
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width','2');s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');s.setAttribute('class','lucide bn-ic');s.innerHTML=p;i.replaceWith(s);
});

/* ---- الإعدادات: الموقع (من الإدارة) ثم تخصيص الزائر ---- */
const DEF={enabled:true,style:'notch',mode:'per-tab',colors:['#3478f6','#f59e0b','#ec4899','#8b5cf6','#10b981'],single:'#3478f6',barLight:'#ffffff',barDark:'#141c28',anim:'jelly',halo:true,haptic:true,labels:true,allowUserCustom:true};
const HEX=/^#[0-9a-f]{6}$/i;
const rd=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const wr=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch{}};
function merge(base,o){
  const n={...base,colors:[...base.colors]};if(!o||typeof o!=='object')return n;
  for(const k of ['enabled','halo','haptic','labels'])if(typeof o[k]==='boolean')n[k]=o[k];
  if(['notch','classic'].includes(o.style))n.style=o.style;if(['per-tab','single'].includes(o.mode))n.mode=o.mode;if(['jelly','slide','none'].includes(o.anim))n.anim=o.anim;
  if(Array.isArray(o.colors))n.colors=n.colors.map((c,i)=>HEX.test(o.colors[i])?o.colors[i]:c);
  for(const k of ['single','barLight','barDark'])if(HEX.test(o[k]))n[k]=o[k];
  return n;
}
let site=merge(DEF,rd('osama_nav_site'));if(rd('osama_nav_site')&&typeof rd('osama_nav_site').allowUserCustom==='boolean')site.allowUserCustom=rd('osama_nav_site').allowUserCustom;
const cfg=()=>site.allowUserCustom?merge(site,rd('osama_nav')):site;

/* ---- بناء الشريط ---- */
const supportsPath=!!(window.CSS&&CSS.supports&&CSS.supports('clip-path',"path('M0 0')"));
const T=40,H=64,r=25,f=9,BR=16;
nav.insertAdjacentHTML('afterbegin','<div class="bn-shadow"><div class="bn-bg"></div></div><i class="bn-bubble"></i>');
const bg=nav.querySelector('.bn-bg'),bub=nav.querySelector('.bn-bubble');
const items=()=>[...nav.querySelectorAll(':scope>button,:scope>a')];
let prev=null,first=true,live=false;
function shape(W,cx){
  cx=Math.max(BR+f+r,Math.min(W-BR-f-r,cx));const t=T,h=T+H;
  return `path('M${BR},${t} L${cx-r-f},${t} A${f},${f} 0 0 0 ${cx-r},${t-f} A${r},${r} 0 0 1 ${cx+r},${t-f} A${f},${f} 0 0 0 ${cx+r+f},${t} L${W-BR},${t} A${BR},${BR} 0 0 1 ${W},${t+BR} L${W},${h-BR} A${BR},${BR} 0 0 1 ${W-BR},${h} L${BR},${h} A${BR},${BR} 0 0 1 0,${h-BR} L0,${t+BR} A${BR},${BR} 0 0 1 ${BR},${t} Z')`;
}
function apply(){
  const c=cfg();const want=c.enabled&&c.style==='notch'&&supportsPath;
  root.classList.toggle('bn-on',want);live=want;
  nav.dataset.anim=c.anim;nav.dataset.halo=c.halo?'1':'0';nav.dataset.labels=c.labels?'1':'0';
  if(!want)return;
  nav.style.setProperty('--bn-bg',root.classList.contains('dark')?c.barDark:c.barLight);
  place();
}
function place(){
  if(!live)return;
  const c=cfg();const list=items();const act=nav.querySelector(':scope>.active')||list[0];if(!act)return;
  const i=list.indexOf(act);const W=nav.clientWidth;if(!W)return;
  const cx=act.offsetLeft+act.offsetWidth/2;
  const tr=bg.style.transition;if(first){bg.style.transition='none';bub.style.transition='none'}
  bg.style.clipPath=shape(W,cx);
  const ccx=Math.max(BR+f+r,Math.min(W-BR-f-r,cx));
  bub.style.transform=`translateX(${ccx-20}px)`;
  nav.style.setProperty('--bn-c',c.mode==='single'?c.single:c.colors[i%c.colors.length]);
  if(first){void bg.offsetWidth;bg.style.transition=tr;bub.style.transition='';first=false}
  else if(prev&&prev!==act){
    if(c.anim==='jelly'){bub.classList.remove('bn-jelly');void bub.offsetWidth;bub.classList.add('bn-jelly');setTimeout(()=>bub.classList.remove('bn-jelly'),1200)}
    try{if(c.haptic&&navigator.vibrate&&!root.classList.contains('no-motion'))navigator.vibrate(8)}catch{}}
  prev=act;
}
new MutationObserver(place).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
new MutationObserver(()=>apply()).observe(root,{attributes:true,attributeFilter:['class']});
addEventListener('resize',place);addEventListener('orientationchange',place);
document.addEventListener('DOMContentLoaded',place);setTimeout(place,300);setTimeout(place,1200);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(place);
apply();
/* إعدادات الموقع من الخادم (تُخزَّن للمرة القادمة لتفادي الوميض) */
fetch('/api/site-ui',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.nav){wr('osama_nav_site',d.nav);site=merge(DEF,d.nav);site.allowUserCustom=d.nav.allowUserCustom!==false;apply()}}).catch(()=>{});

/* ---- واجهة برمجية + تخصيص الزائر داخل نافذة «المظهر» ---- */
window.NavFX={get:cfg,site:()=>site,setLocal(o){wr('osama_nav',o);apply()},resetLocal(){wr('osama_nav',null);apply()},apply};
const L=()=>{try{return (window.I18N&&I18N.lang&&I18N.lang())||document.documentElement.lang||'ar'}catch{return 'ar'}};
const TX={
 ar:{t:'الشريط السفلي (لهاتفك فقط)',on:'تفعيل الشريط المنحني',mode:'ألوان الفقاعة',per:'لون لكل صفحة',one:'لون واحد',anim:'الحركة',jelly:'جيلي',slide:'انزلاق',none:'بدون',halo:'هالة نابضة',labels:'إظهار الأسماء',haptic:'اهتزاز خفيف',bar:'لون الشريط',reset:'استعادة إعدادات الموقع',tabs:['الرئيسية','Shorts','المحفوظات','السجل','الإدارة'],note:'هذه الإعدادات تُحفظ في هذا الجهاز فقط ولا يراها الآخرون.'},
 en:{t:'Bottom bar (this phone only)',on:'Curved bar',mode:'Bubble colors',per:'Per page',one:'Single color',anim:'Motion',jelly:'Jelly',slide:'Slide',none:'None',halo:'Pulsing halo',labels:'Show labels',haptic:'Light vibration',bar:'Bar color',reset:'Restore site defaults',tabs:['Home','Shorts','Saved','History','Admin'],note:'Saved on this device only; nobody else sees it.'},
 ru:{t:'Нижняя панель (только на этом телефоне)',on:'Изогнутая панель',mode:'Цвета пузыря',per:'Для каждой страницы',one:'Один цвет',anim:'Анимация',jelly:'Желе',slide:'Скольжение',none:'Нет',halo:'Пульсирующее свечение',labels:'Показывать подписи',haptic:'Лёгкая вибрация',bar:'Цвет панели',reset:'Вернуть настройки сайта',tabs:['Главная','Shorts','Сохранённое','История','Админ'],note:'Сохраняется только на этом устройстве.'}
};
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
function section(){
  const c=cfg(),x=TX[L()]||TX.ar,dark=root.classList.contains('dark');
  const d=document.createElement('div');d.className='look-sec bn-look';
  d.innerHTML=`<b>${esc(x.t)}</b>
  <label class="look-row"><span>${esc(x.on)}</span><input type="checkbox" data-k="notch" ${c.style==='notch'?'checked':''}></label>
  <div class="look-opts"><button type="button" class="look-opt${c.mode==='per-tab'?' on':''}" data-m="per-tab"><span>${esc(x.per)}</span></button><button type="button" class="look-opt${c.mode==='single'?' on':''}" data-m="single"><span>${esc(x.one)}</span></button></div>
  <div class="bn-sw">${c.colors.map((col,i)=>`<label title="${esc(x.tabs[i])}"><input type="color" data-i="${i}" value="${col}"><small>${esc(x.tabs[i])}</small></label>`).join('')}<label><input type="color" data-s="1" value="${c.single}"><small>${esc(x.one)}</small></label><label><input type="color" data-b="1" value="${dark?c.barDark:c.barLight}"><small>${esc(x.bar)}</small></label></div>
  <div class="look-opts">${['jelly','slide','none'].map(a=>`<button type="button" class="look-opt${c.anim===a?' on':''}" data-a="${a}"><span>${esc(x[a])}</span></button>`).join('')}</div>
  <label class="look-row"><span>${esc(x.halo)}</span><input type="checkbox" data-k="halo" ${c.halo?'checked':''}></label>
  <label class="look-row"><span>${esc(x.labels)}</span><input type="checkbox" data-k="labels" ${c.labels?'checked':''}></label>
  <label class="look-row"><span>${esc(x.haptic)}</span><input type="checkbox" data-k="haptic" ${c.haptic?'checked':''}></label>
  <button class="secondary-btn" type="button" data-reset="1"><span>${esc(x.reset)}</span></button><small class="hint">${esc(x.note)}</small>`;
  const save=m=>{const cur=cfg();const n={...cur,colors:[...cur.colors],...m};wr('osama_nav',n);apply()};
  d.addEventListener('input',e=>{const t=e.target;if(t.dataset.i!==undefined){const cs=[...cfg().colors];cs[+t.dataset.i]=t.value;save({colors:cs,mode:'per-tab'});d.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m==='per-tab'))}
    else if(t.dataset.s){save({single:t.value,mode:'single'});d.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m==='single'))}
    else if(t.dataset.b){save(root.classList.contains('dark')?{barDark:t.value}:{barLight:t.value})}});
  d.addEventListener('change',e=>{const t=e.target;if(t.dataset.k==='notch')save({style:t.checked?'notch':'classic'});else if(t.dataset.k)save({[t.dataset.k]:t.checked})});
  d.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.m){save({mode:b.dataset.m});d.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x===b))}
    else if(b.dataset.a){save({anim:b.dataset.a});d.querySelectorAll('[data-a]').forEach(x=>x.classList.toggle('on',x===b))}
    else if(b.dataset.reset){window.NavFX.resetLocal();const p=d.parentNode;const n=section();if(n)p.replaceChild(n,d)}});
  return d;
}
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;
  const th=n.matches&&n.matches('.look-themes')?n:(n.querySelector&&n.querySelector('.look-themes'));
  if(th&&site.allowUserCustom){const card=th.closest('.modal-card,.pub-card')||th.parentNode.parentNode;if(card&&!card.querySelector('.bn-look')){const rs=card.querySelector('#lk-reset');const s=section();rs?rs.parentNode.insertBefore(s,rs):card.appendChild(s)}}}})
 .observe(document.body,{childList:true,subtree:true});
})();
