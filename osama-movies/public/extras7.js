/* ===================================================================
   extras7.js — الإصدار 15: دردشة وتفاعلات البث • استوديو القناة • استوديو المظهر (ألوان/خلفيات/زجاج)
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
async function api(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Lang':I18N.lang()},body:body===undefined?undefined:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null,closeModal=()=>window.Extras&&Extras.closeModal();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* =====================================================
   1) استوديو المظهر
   ===================================================== */
const ACCENTS=[['#3478f6','blue'],['#8b5cf6','purple'],['#ec4899','pink'],['#ef4444','red'],['#f97316','orange'],['#eab308','gold'],['#10b981','green'],['#06b6d4','teal']];
const BGS=['orbs','aurora','mesh','plain'];
const PRESETS={balanced:{blur:0,alpha:null},clear:{blur:0,alpha:.30},rich:{blur:0,alpha:.72},ios:{blur:20,alpha:.42},frost:{blur:30,alpha:.58}};
const THEMES=[
 {id:'ios',n:['iOS 27 سائل','iOS 27 Liquid','iOS 27 Жидкое'],v:{accent:'#3478f6',bg:'aurora',glass:'ios',blur:20,alpha:.42},c:['#3478f6','#8b5cf6']},
 {id:'cinema',n:['سينمائي داكن','Cinema Dark','Кино'],v:{accent:'#ef4444',bg:'plain',glass:'rich',blur:0,alpha:.72},c:['#ef4444','#111']},
 {id:'calm',n:['هادئ','Calm','Спокойная'],v:{accent:'#06b6d4',bg:'mesh',glass:'clear',blur:0,alpha:.30},c:['#06b6d4','#10b981']},
 {id:'sunset',n:['غروب','Sunset','Закат'],v:{accent:'#f97316',bg:'aurora',glass:'balanced',blur:0,alpha:null},c:['#f97316','#ec4899']},
 {id:'neon',n:['نيون','Neon','Неон'],v:{accent:'#8b5cf6',bg:'orbs',glass:'frost',blur:30,alpha:.58},c:['#8b5cf6','#ec4899']},
 {id:'forest',n:['غابة','Forest','Лес'],v:{accent:'#10b981',bg:'mesh',glass:'balanced',blur:0,alpha:null},c:['#10b981','#eab308']}];
let look={accent:'#3478f6',bg:'orbs',glass:'balanced',blur:0,alpha:null,motion:true};
try{Object.assign(look,JSON.parse(localStorage.getItem('osama_look')||'{}'))}catch{}
function applyLook(){
  const r=document.documentElement;
  r.style.setProperty('--accent',look.accent);
  BGS.forEach(b=>r.classList.toggle('bg-'+b,look.bg===b));
  const bl=Math.max(0,Math.min(40,Number(look.blur)||0)),al=look.alpha==null?null:Math.max(.1,Math.min(.95,Number(look.alpha)));
  r.classList.toggle('lg-blur',bl>0);r.style.setProperty('--lg-blur',bl+'px');
  r.classList.toggle('lg-custom',al!=null);
  if(al!=null){r.style.setProperty('--lgA',al);r.style.setProperty('--lgO',Math.min(.97,al+.3).toFixed(2))}else{r.style.removeProperty('--lgA');r.style.removeProperty('--lgO')}
  r.classList.toggle('no-motion',!look.motion);
}
function saveLook(){try{localStorage.setItem('osama_look',JSON.stringify(look))}catch{}applyLook()}
if(PRESETS[look.glass]&&look.blur===0&&look.alpha==null&&look.glass!=='balanced')Object.assign(look,PRESETS[look.glass]);
applyLook();
function openLook(){
  const el=modal(`<h3><i data-lucide="palette"></i> ${esc(t('look.title'))}</h3>
   <div class="look-sec"><b>${esc(I18N.lang()==='en'?'Ready themes':I18N.lang()==='ru'?'Готовые темы':'ثيمات جاهزة')}</b><div class="look-themes">${THEMES.map(h=>`<button type="button" class="look-theme" data-th="${h.id}" style="--c1:${h.c[0]};--c2:${h.c[1]}"><i></i><span>${esc(h.n[I18N.lang()==='en'?1:I18N.lang()==='ru'?2:0])}</span></button>`).join('')}</div></div>
   <div class="look-sec"><b>${esc(t('look.accent'))}</b><div class="look-sw">${ACCENTS.map(([c])=>`<button type="button" class="sw${look.accent===c?' on':''}" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}<label class="sw sw-custom" title="${esc(t('look.custom'))}"><input type="color" id="lk-custom" value="${esc(look.accent)}"></label></div></div>
   <div class="look-sec"><b>${esc(t('look.bg'))}</b><div class="look-opts">${BGS.map(b=>`<button type="button" class="look-opt${look.bg===b?' on':''}" data-bg="${b}"><i class="look-prev bgp-${b}"></i><span>${esc(t('look.bg_'+b))}</span></button>`).join('')}</div></div>
   <div class="look-sec"><b>${esc(t('look.glass'))}</b><div class="look-opts">${Object.keys(PRESETS).map(g=>`<button type="button" class="look-opt${look.glass===g?' on':''}" data-g="${g}"><span>${esc(t('look.glass_'+g))}</span></button>`).join('')}</div>
    <label class="look-range"><span>${esc(t('look.blur'))} <b id="lk-bv">${Math.round(look.blur||0)}px</b></span><input type="range" id="lk-blur" min="0" max="40" step="1" value="${Math.round(look.blur||0)}"></label>
    <label class="look-range"><span>${esc(t('look.alpha'))} <b id="lk-av">${look.alpha==null?esc(t('look.auto')):Math.round(look.alpha*100)+'%'}</b></span><input type="range" id="lk-alpha" min="10" max="95" step="1" value="${look.alpha==null?52:Math.round(look.alpha*100)}"></label></div>
   <label class="look-sec look-row"><span>${esc(t('look.motion'))}</span><input type="checkbox" id="lk-motion" ${look.motion?'checked':''}></label>
   <button class="secondary-btn" id="lk-reset" type="button"><i data-lucide="rotate-ccw"></i><span>${esc(t('look.reset'))}</span></button>`,{cls:'pub-card'});
  const refresh=()=>{el.querySelectorAll('.sw[data-c]').forEach(b=>b.classList.toggle('on',b.dataset.c===look.accent));el.querySelectorAll('[data-bg]').forEach(b=>b.classList.toggle('on',b.dataset.bg===look.bg));el.querySelectorAll('[data-g]').forEach(b=>b.classList.toggle('on',b.dataset.g===look.glass))};
  el.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{const h=THEMES.find(x=>x.id===b.dataset.th);Object.assign(look,h.v);saveLook();refresh();sync()});
  el.querySelectorAll('.sw[data-c]').forEach(b=>b.onclick=()=>{look.accent=b.dataset.c;saveLook();refresh()});
  el.querySelector('#lk-custom').oninput=e=>{look.accent=e.target.value;saveLook();refresh()};
  el.querySelectorAll('[data-bg]').forEach(b=>b.onclick=()=>{look.bg=b.dataset.bg;saveLook();refresh()});
  const sync=()=>{el.querySelector('#lk-blur').value=Math.round(look.blur||0);el.querySelector('#lk-bv').textContent=Math.round(look.blur||0)+'px';el.querySelector('#lk-alpha').value=look.alpha==null?52:Math.round(look.alpha*100);el.querySelector('#lk-av').textContent=look.alpha==null?t('look.auto'):Math.round(look.alpha*100)+'%'};
  el.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{look.glass=b.dataset.g;Object.assign(look,PRESETS[look.glass]);saveLook();refresh();sync()});
  el.querySelector('#lk-blur').oninput=e=>{look.blur=Number(e.target.value);look.glass='custom';saveLook();refresh();sync()};
  el.querySelector('#lk-alpha').oninput=e=>{look.alpha=Number(e.target.value)/100;look.glass='custom';saveLook();refresh();sync()};
  el.querySelector('#lk-motion').onchange=e=>{look.motion=e.target.checked;saveLook()};
  el.querySelector('#lk-reset').onclick=()=>{look={accent:'#3478f6',bg:'orbs',glass:'balanced',blur:0,alpha:null,motion:true};saveLook();closeModal();openLook()};
  icons();
}

/* =====================================================
   2) استوديو القناة
   ===================================================== */
async function openStudio(){
  if(!me){openAuth('login');return}
  let d;try{d=await api('/api/user/studio')}catch(e){toast(e.message,'error');return}
  const stat=(ico,n,l)=>`<div class="st-card glass"><i data-lucide="${ico}"></i><b>${fmt(n)}</b><small>${esc(t(l))}</small></div>`;
  const max=Math.max(1,...d.top.map(x=>x.views));
  const el=modal(`<h3><i data-lucide="layout-dashboard"></i> ${esc(t('studio.title'))}</h3>
   <div class="st-grid">${stat('eye',d.totalViews,'studio.views')}${stat('users',d.followers,'studio.subs')}${stat('film',d.movies,'studio.movies')}${stat('clapperboard',d.shorts,'studio.shorts')}</div>
   ${d.pending?`<p class="st-pending">${esc(t('studio.pending',{n:d.pending}))}</p>`:''}
   <h4>${esc(t('studio.top'))}</h4>
   ${d.top.length?`<div class="st-top">${d.top.map(x=>`<div class="st-row"><img src="${esc(x.posterUrl)}" alt=""><div><b>${esc(x.title)}</b><i class="st-bar"><u style="width:${Math.max(3,Math.round(x.views/max*100))}%"></u></i></div><span>${fmt(x.views)}</span></div>`).join('')}</div>`:`<div class="cm-empty">${esc(t('studio.empty'))}</div>`}
   <div class="st-actions"><button class="primary-btn" id="st-pub" type="button"><i data-lucide="upload"></i><span>${esc(t('pub.nav'))}</span></button><button class="secondary-btn" id="st-live" type="button"><i data-lucide="radio"></i><span>${esc(t('live.goBtn'))}</span></button><button class="secondary-btn" id="st-cust" type="button"><i data-lucide="palette"></i><span>${esc(t('cust.btn'))}</span></button></div>`,{cls:'pub-card'});
  const go=fn=>()=>{closeModal();setTimeout(fn,150)};
  el.querySelector('#st-pub').onclick=go(()=>window.Cinema5&&Cinema5.openPublish&&Cinema5.openPublish());
  el.querySelector('#st-live').onclick=go(()=>window.Cinema6&&Cinema6.openGoLive());
  el.querySelector('#st-cust').onclick=go(()=>window.Cinema6&&Cinema6.openCustomize());
  icons();
}

/* =====================================================
   3) دردشة البث + تفاعلات عائمة
   ===================================================== */
const REACTS=['❤️','🔥','👏','😂','😮','🎉'];
document.addEventListener('live:open',e=>{
  const {el,id,info}=e.detail;const wrap=el.querySelector('.live-wrap');if(!wrap)return;
  const stage=el.querySelector('.live-stage');
  wrap.insertAdjacentHTML('beforeend',`<div class="lv-chat"><div class="lv-react">${REACTS.map(r=>`<button type="button" data-r="${r}">${r}</button>`).join('')}</div><div class="lv-msgs" id="lv-msgs"></div>
    <form class="lv-form" id="lv-form" autocomplete="off"><input maxlength="200" placeholder="${esc(t(me?'live.chatPh':'live.chatLogin'))}" ${me?'':'disabled'}><button class="primary-btn" type="submit" ${me?'':'disabled'}><i data-lucide="send"></i></button></form></div>`);
  const list=wrap.querySelector('#lv-msgs'),form=wrap.querySelector('#lv-form'),inp=form.querySelector('input');
  const isOwner=!!(me&&info.owner&&info.owner.username===me.username);
  let last=null,seen=new Set();
  const float=emoji=>{const s=document.createElement('span');s.className='lv-float';s.textContent=emoji;s.style.insetInlineStart=(8+Math.random()*30)+'%';stage.appendChild(s);setTimeout(()=>s.remove(),2600)};
  const line=m=>`<div class="lv-m" data-n="${m.n}"><b>${esc(m.name)}${m.verified?'<i class="vb"></i>':''}</b><span>${esc(m.text)}</span>${isOwner?`<button type="button" class="lv-del" data-n="${m.n}" aria-label="x">×</button>`:''}</div>`;
  async function poll(){
    while(document.body.contains(el)){
      try{
        const d=await api(`/api/live/${encodeURIComponent(id)}/chat?after=${last||0}`);
        const first=last===null;last=d.last;
        const texts=d.items.filter(m=>m.type==='m');
        if(texts.length){const near=list.scrollHeight-list.scrollTop-list.clientHeight<60;list.insertAdjacentHTML('beforeend',texts.filter(m=>!seen.has(m.n)).map(m=>{seen.add(m.n);return line(m)}).join(''));while(list.children.length>80)list.firstChild.remove();if(near||first)list.scrollTop=list.scrollHeight}
        if(!first)d.items.filter(m=>m.type==='r'&&!(me&&m.user===me.username)).slice(-6).forEach(m=>float(m.text));
        d.items.filter(m=>m.type==='d').forEach(m=>{const n=list.querySelector(`[data-n="${m.n}"]`);if(n)n.remove()});
        if(d.ended)break;
      }catch(x){if(x.status===404)break}
      await sleep(1800);
    }
  }
  poll();
  form.onsubmit=async ev=>{ev.preventDefault();const text=inp.value.trim();if(!text||!me)return;inp.value='';
    try{await api(`/api/live/${encodeURIComponent(id)}/chat`,'POST',{text})}catch(x){toast(x.message,'error')}};
  wrap.querySelectorAll('.lv-react button').forEach(b=>b.onclick=async()=>{if(!me){openAuth('login');return}float(b.dataset.r);try{await api(`/api/live/${encodeURIComponent(id)}/chat`,'POST',{react:b.dataset.r})}catch{}});
  list.addEventListener('click',async ev=>{const b=ev.target.closest('.lv-del');if(!b)return;try{await api(`/api/live/${encodeURIComponent(id)}/chat/${b.dataset.n}`,'DELETE')}catch(x){toast(x.message,'error')}});
  icons();
});

function injectNav(){
  const nav=$('.side-nav');if(!nav||$('#nav-studio'))return;
  nav.insertAdjacentHTML('beforeend',`<button type="button" id="nav-studio"><i data-lucide="layout-dashboard"></i><span>${esc(t('studio.nav'))}</span></button><button type="button" id="nav-look"><i data-lucide="swatch-book"></i><span>${esc(t('look.nav'))}</span></button>`);
  $('#nav-studio').onclick=()=>{closeSidebar();openStudio()};$('#nav-look').onclick=()=>{closeSidebar();openLook()};icons();
}
document.addEventListener('langchange',()=>{const a=$('#nav-studio span');if(a)a.textContent=t('studio.nav');const b=$('#nav-look span');if(b)b.textContent=t('look.nav')});
function init(){injectNav()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Cinema7={openStudio,openLook,THEMES};
})();
