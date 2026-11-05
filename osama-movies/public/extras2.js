/* ===================================================================
   extras2.js — إضافات الإصدار 11 (تغليف الواجهة الحالية دون تعديل منطقها):
   قوائم الرئيسية والتوصيات • فلاتر الكتالوج • تقييمات • مسلسلات/حلقات • وضع الأطفال والقفل العمري
   حظر/كتم • @إشارات وتثبيت وروابط الزمن • محفوظات Shorts • لوحة المبدع • مشاهدة جماعية
   Push • دخول Google/Telegram • تحميل للمشاهدة بلا إنترنت • إيماءات المشغّل ومؤقت النوم
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
async function api(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Lang':I18N.lang()},body:body===undefined?undefined:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null,closeModal=()=>window.Extras&&Extras.closeModal();
const byId=id=>moviesData.find(m=>m.id===id);
const stars=(v,cls='')=>{const r=Math.round(v*2)/2;return `<span class="stars ${cls}" aria-label="${v}/5">`+[1,2,3,4,5].map(i=>`<i class="${r>=i?'full':r>=i-0.5?'half':''}">★</i>`).join('')+'</span>'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const sec2=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};

/* =====================================================
   1) قوائم الرئيسية (استمر في المسلسل • لأنك شاهدت • الأعلى تقييماً …)
   ===================================================== */
let rowsBox=null,rowsSeq=0;
function ensureRows(){
  if(rowsBox&&rowsBox.isConnected)return rowsBox;
  const first=[...$$('#home-view .section-head')].find(h=>!h.closest('#continue-row'));if(!first)return null;
  rowsBox=document.createElement('section');rowsBox.id='home-rows';first.parentNode.insertBefore(rowsBox,first);return rowsBox;
}
const ROW_TITLE={next_up:()=>t('rows.next_up'),because:r=>t('rows.because',{title:r.title||''}),for_you:r=>t('rows.for_you',{cat:catLabel(r.category||'')}),top_rated:()=>t('rows.top_rated'),trending:()=>t('rows.trending'),new:()=>t('rows.new')};
async function refreshRows(){
  const box=ensureRows();if(!box)return;const seq=++rowsSeq;
  let d;try{d=await api('/api/home/lists')}catch{return}
  if(seq!==rowsSeq)return;
  const rows=d.rows.map(r=>({...r,items:r.ids.map(byId).filter(Boolean)})).filter(r=>r.items.length);
  box.innerHTML=rows.map(r=>`<div class="hrow" data-k="${esc(r.key)}"><div class="section-head"><div><h3>${esc(ROW_TITLE[r.key]?ROW_TITLE[r.key](r):r.key)}</h3></div></div><div class="hrow-scroll">${r.items.map(m=>card(m)).join('')}</div></div>`).join('');
  box.querySelectorAll('[data-movie]').forEach(c=>c.onclick=()=>{const m=byId(c.dataset.movie);if(m)openPlayer(m)});
  icons();
}
const _updateHero=window.updateHero;
if(_updateHero)window.updateHero=function(){const r=_updateHero.apply(this,arguments);refreshRows();return r};
document.addEventListener('auth:changed',()=>{paintKidsMode();if(moviesData.length)refreshRows()});
document.addEventListener('tabchange',e=>{if(e.detail==='home')refreshRows()});

/* =====================================================
   2) فلاتر الكتالوج والبحث بالممثل/المخرج/الوسم
   ===================================================== */
const flt={year:'',director:'',cast:'',tag:'',age:'',minRating:'',sort:''};
const fltActive=()=>Object.values(flt).some(Boolean);
const _renderMovies=window.renderMovies;
window.renderMovies=function(list,target='#movie-grid'){
  if(target==='#movie-grid'){
    const q=(($('#search-input')||{}).value||'').trim().toLowerCase();
    if(q){const have=new Set(list.map(m=>m.id));
      const hit=m=>[m.director,m.series,m.country,...(m.cast||[]),...(m.tags||[])].some(v=>String(v||'').toLowerCase().includes(q));
      list=list.concat(moviesData.filter(m=>!have.has(m.id)&&hit(m)&&(typeof activeCategory==='undefined'||activeCategory==='all'||m.category===activeCategory)))}
    if(fltActive()){
      list=list.filter(m=>(!flt.year||String(m.year)===flt.year)&&(!flt.director||m.director===flt.director)&&(!flt.cast||(m.cast||[]).includes(flt.cast))
        &&(!flt.tag||(m.tags||[]).includes(flt.tag))&&(!flt.age||(typeof m.ageRating==='number'&&m.ageRating<=Number(flt.age)))&&(!flt.minRating||(m.rating&&m.rating.avg>=Number(flt.minRating))));
      const by={new:(a,b)=>b.createdAt.localeCompare(a.createdAt),rating:(a,b)=>((b.rating||{}).avg||0)-((a.rating||{}).avg||0),views:(a,b)=>(b.views||0)-(a.views||0),year:(a,b)=>(b.year||0)-(a.year||0)};
      if(by[flt.sort])list=[...list].sort(by[flt.sort]);
    }
    const c=$('#movies-count');if(c)c.textContent=fmt(list.length);
  }
  return _renderMovies.call(this,list,target);
};
function uniq(f){const o={};for(const m of moviesData){const v=f(m);(Array.isArray(v)?v:[v]).forEach(x=>{if(x!==undefined&&x!==''&&x!==null)o[x]=(o[x]||0)+1})}return Object.entries(o).sort((a,b)=>b[1]-a[1]).map(x=>x[0])}
function paintFilterBar(){
  const panel=$('#search-panel');if(!panel)return;
  let bar=$('#flt-bar');
  if(!bar){bar=document.createElement('div');bar.id='flt-bar';bar.className='flt-bar';panel.appendChild(bar)}
  const sel=(k,label,opts,fmtOpt)=>`<label class="flt"><span>${esc(label)}</span><select data-f="${k}"><option value="">${esc(t('flt.any'))}</option>${opts.map(o=>`<option value="${esc(o)}"${String(flt[k])===String(o)?' selected':''}>${esc(fmtOpt?fmtOpt(o):o)}</option>`).join('')}</select></label>`;
  bar.innerHTML=sel('year',t('flt.year'),uniq(m=>m.year).sort((a,b)=>b-a))+sel('director',t('flt.director'),uniq(m=>m.director))+sel('cast',t('flt.cast'),uniq(m=>m.cast).slice(0,60))+sel('tag',t('flt.tag'),uniq(m=>m.tags).slice(0,60),x=>'#'+x)
    +sel('age',t('flt.age'),[0,7,10,13,16,18],x=>x?`≤ ${x}+`:t('age.all'))+sel('minRating',t('flt.rating'),[4,3,2],x=>'★ '+x+'+')+sel('sort',t('flt.sort'),['new','rating','views','year'],x=>t('flt.s_'+x))
    +(fltActive()?`<button type="button" class="ghost-btn" id="flt-clear"><i data-lucide="x"></i><span>${esc(t('flt.clear'))}</span></button>`:'');
  bar.querySelectorAll('select').forEach(s=>s.onchange=()=>{flt[s.dataset.f]=s.value;applyFilters();paintFilterBar()});
  const c=$('#flt-clear');if(c)c.onclick=()=>{Object.keys(flt).forEach(k=>flt[k]='');applyFilters();paintFilterBar()};
  icons();
}
const _applyFilters=window.applyFilters;
window.applyFilters=function(){const r=_applyFilters.apply(this,arguments);return r};
document.addEventListener('click',e=>{if(e.target.closest('#search-open'))setTimeout(()=>{if(!$('#search-panel').classList.contains('hidden'))paintFilterBar()},30)});

/* =====================================================
   3) صفحة الفيلم: بيانات الكتالوج • التقييم • الحلقات • المتشابهة
   ===================================================== */
const serCache={};
function seriesNext(m){const s=serCache[m.id];return s&&s.next?byId(s.next.id):null}
function ageChip(m){return typeof m.ageRating==='number'?`<span class="age-chip a${m.ageRating}">${m.ageRating?m.ageRating+'+':esc(t('age.all'))}</span>`:''}
function detailBox(){
  let b=$('#detail-extra');
  if(!b){const d=$('#detail-description');if(!d)return null;b=document.createElement('div');b.id='detail-extra';d.insertAdjacentElement('afterend',b)}
  return b;
}
async function paintDetailExtras(m){
  const b=detailBox();if(!b)return;
  const chips=[m.year,m.country,m.language].filter(Boolean).map(x=>`<span class="cat-chip">${esc(x)}</span>`).join('');
  const info=[];
  if(m.director)info.push(`<div><b>${esc(t('flt.director'))}:</b> <a data-flt="director" data-v="${esc(m.director)}">${esc(m.director)}</a></div>`);
  if((m.cast||[]).length)info.push(`<div><b>${esc(t('flt.cast'))}:</b> ${m.cast.map(c=>`<a data-flt="cast" data-v="${esc(c)}">${esc(c)}</a>`).join('، ')}</div>`);
  if((m.tags||[]).length)info.push(`<div class="tagline">${m.tags.map(c=>`<a data-flt="tag" data-v="${esc(c)}">#${esc(c)}</a>`).join(' ')}</div>`);
  b.innerHTML=`<div class="dx-top">${ageChip(m)}${chips}<span class="dx-rating" id="dx-rating"></span></div>${info.join('')}<div id="dx-series"></div>`;
  b.querySelectorAll('[data-flt]').forEach(a=>a.onclick=()=>{Object.keys(flt).forEach(k=>flt[k]='');flt[a.dataset.flt]=a.dataset.v;switchTab('home');applyFilters();$('#search-panel').classList.remove('hidden');paintFilterBar();window.scrollTo({top:0})});
  paintRating(m);paintSeries(m);
}
async function paintRating(m){
  const el=$('#dx-rating');if(!el)return;
  let d;try{d=await api(`/api/movies/${encodeURIComponent(m.id)}/ratings?limit=1`)}catch{return}
  if(currentMovie!==m||!el.isConnected)return;
  if(d.count)m.rating={avg:d.avg,count:d.count};
  el.innerHTML=`${stars(d.avg||0)} <b>${d.count?d.avg:'—'}</b> <small>(${fmt(d.count)})</small> <button type="button" class="ghost-btn dx-rate" id="dx-rate"><i data-lucide="star"></i><span>${esc(t(d.mine?'rate.edit':'rate.btn'))}</span></button>`;
  $('#dx-rate').onclick=()=>openRatings(m);icons();
}
async function openRatings(m){
  let d;try{d=await api(`/api/movies/${encodeURIComponent(m.id)}/ratings?limit=20`)}catch(e){toast(e.message,'error');return}
  let pick=d.mine?d.mine.stars:0;
  const el=modal(`<h3 class="rt-h">${esc(m.title)}</h3>
    <div class="rt-sum">${stars(d.avg,'big')}<b>${d.count?d.avg:'—'}</b><small>${esc(t('rate.count',{n:fmt(d.count)}))}</small></div>
    <div class="rt-dist">${[5,4,3,2,1].map(i=>`<div><span>${i}★</span><i><b style="width:${d.count?Math.round(d.dist[i-1]/d.count*100):0}%"></b></i><em>${d.dist[i-1]}</em></div>`).join('')}</div>
    ${me?`<div class="rt-mine"><div class="rt-pick" id="rt-pick">${[1,2,3,4,5].map(i=>`<button type="button" data-s="${i}" aria-label="${i}">★</button>`).join('')}</div>
      <textarea id="rt-text" rows="2" maxlength="600" placeholder="${esc(t('rate.ph'))}">${esc(d.mine?d.mine.review:'')}</textarea>
      <div class="rt-btns"><button class="primary-btn" id="rt-save" type="button"><i data-lucide="check"></i><span>${esc(t('rate.save'))}</span></button>${d.mine?`<button class="ghost-btn danger-ghost" id="rt-del" type="button">${esc(t('rate.remove'))}</button>`:''}</div><div class="auth-error" id="rt-err"></div></div>`
      :`<button class="primary-btn" id="rt-login" type="button">${esc(t('cm.loginToComment'))}</button>`}
    <div class="rt-list">${d.reviews.map(r=>`<div class="rt-item"><span class="avatar avatar-sm">${avatarHTML(r.author)}</span><div><div class="rt-who"><strong>${esc(r.author.name)}${vbHTML(r.author)}</strong> ${stars(r.stars,'sm')}<time>${esc(timeAgo(r.updatedAt))}</time></div><p>${esc(r.review)}</p></div></div>`).join('')||`<div class="cm-empty">${esc(t('rate.noReviews'))}</div>`}</div>`,{cls:'rt-card'});
  const paint=()=>el.querySelectorAll('#rt-pick button').forEach(b=>b.classList.toggle('on',Number(b.dataset.s)<=pick));
  paint();
  el.querySelectorAll('#rt-pick button').forEach(b=>b.onclick=()=>{pick=Number(b.dataset.s);paint()});
  const lg=el.querySelector('#rt-login');if(lg)lg.onclick=()=>{closeModal();openAuth('login')};
  const sv=el.querySelector('#rt-save');
  if(sv)sv.onclick=async()=>{
    if(!pick){el.querySelector('#rt-err').textContent=t('rate.pick');return}
    try{const r=await api(`/api/movies/${encodeURIComponent(m.id)}/rate`,'POST',{stars:pick,review:el.querySelector('#rt-text').value});m.rating={avg:r.avg,count:r.count};closeModal();toast(t('rate.saved'));paintRating(m)}
    catch(e){el.querySelector('#rt-err').textContent=e.message}
  };
  const dl=el.querySelector('#rt-del');if(dl)dl.onclick=async()=>{try{await api(`/api/movies/${encodeURIComponent(m.id)}/rate`,'DELETE');closeModal();paintRating(m)}catch(e){toast(e.message,'error')}};
}
async function paintSeries(m){
  const box=$('#dx-series');if(!box||!m.series)return;
  let d;try{d=await api(`/api/movies/${encodeURIComponent(m.id)}/series`)}catch{return}
  if(!d.series||currentMovie!==m)return;serCache[m.id]=d;
  const cur=d.seasons.find(s=>s.episodes.some(e=>e.id===m.id))||d.seasons[0];
  const draw=n=>{const s=d.seasons.find(x=>x.n===n)||cur;
    box.innerHTML=`<div class="ser-head"><strong>${esc(d.series)}</strong><div class="ser-tabs">${d.seasons.map(x=>`<button type="button" data-n="${x.n}" class="${x.n===s.n?'on':''}">${esc(t('ser.season',{n:x.n}))}</button>`).join('')}</div></div>
      <div class="ser-eps">${s.episodes.map(e=>`<button type="button" class="ser-ep${e.id===m.id?' on':''}" data-id="${esc(e.id)}"><span class="ep-n">${e.episode||'·'}</span><span class="ep-t">${esc(e.title)}</span>${e.id===m.id?`<i data-lucide="play"></i>`:''}</button>`).join('')}</div>`;
    box.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>draw(Number(b.dataset.n)));
    box.querySelectorAll('.ser-ep').forEach(b=>b.onclick=()=>{const x=byId(b.dataset.id);if(x&&x.id!==m.id)openPlayer(x,'next')});icons()};
  draw(cur.n);
}
async function paintSimilar(m){
  try{const d=await api(`/api/movies/${encodeURIComponent(m.id)}/similar`);if(currentMovie!==m)return;
    const list=d.items.map(byId).filter(Boolean);if(list.length)renderMovies(list,'#related-grid')}catch{}
}

/* =====================================================
   4) القفل العمري + وضع الأطفال
   ===================================================== */
const kidsOn=()=>!!(me&&me.kids&&me.kids.on);
function ageBlockedLocal(m){
  if(kidsOn())return typeof m.ageRating!=='number'||m.ageRating>(me.kids.maxAge||7);
  return !!(me&&me.age&&typeof m.ageRating==='number'&&m.ageRating>me.age);
}
const _openPlayer2=window.openPlayer;
window.openPlayer=function(movie,source){
  if(movie&&ageBlockedLocal(movie)){
    modal(`<div class="age-lock"><i data-lucide="shield-alert"></i><h3>${esc(t(kidsOn()?'kids.blockedT':'age.blockedT'))}</h3><p>${esc(t(kidsOn()?'kids.blockedD':'age.blockedD',{n:movie.ageRating}))}</p></div>`);return;
  }
  const r=_openPlayer2.apply(this,arguments);
  if(movie){paintDetailExtras(movie);paintSimilar(movie);paintParty();paintOfflineBtn(movie);applySavedSpeed()}
  return r;
};
function paintKidsMode(){
  document.body.classList.toggle('kids-mode',kidsOn());
  let chip=$('#kids-chip');
  if(kidsOn()){if(!chip){chip=document.createElement('div');chip.id='kids-chip';chip.className='kids-chip lg';chip.innerHTML=`<i data-lucide="baby"></i><span></span>`;document.body.appendChild(chip);icons()}chip.querySelector('span').textContent=t('kids.chip',{n:me.kids.maxAge})}
  else if(chip)chip.remove();
}

/* =====================================================
   5) الملف الشخصي: وضع الأطفال • الإشعارات • المحظورون • ربط الحسابات
   ===================================================== */
function pinModal({title,desc,needNewPin,needMax,onSubmit,usePassword}){
  const el=modal(`<h3>${esc(title)}</h3><p class="muted-p">${esc(desc||'')}</p>
    ${needMax?`<label class="flt"><span>${esc(t('kids.maxAge'))}</span><select id="pm-max"><option value="7">7+</option><option value="10" selected>10+</option><option value="13">13+</option></select></label>`:''}
    <label class="flt"><span>${esc(needNewPin?t('kids.newPin'):t('kids.pin'))}</span><input id="pm-pin" inputmode="numeric" maxlength="6" autocomplete="off" dir="ltr" type="password"></label>
    ${usePassword?`<label class="flt"><span>${esc(t('kids.orPassword'))}</span><input id="pm-pass" type="password" autocomplete="current-password" dir="ltr"></label>`:''}
    <button class="primary-btn" id="pm-ok" type="button"><i data-lucide="check"></i><span>${esc(t('common.confirm'))}</span></button><div class="auth-error" id="pm-err"></div>`);
  el.querySelector('#pm-ok').onclick=async()=>{
    try{await onSubmit({pin:el.querySelector('#pm-pin').value.trim(),password:(el.querySelector('#pm-pass')||{}).value||'',maxAge:Number((el.querySelector('#pm-max')||{}).value||10)});closeModal()}
    catch(e){el.querySelector('#pm-err').textContent=e.message}
  };
}
async function afterKidsChange(user){setMe(user);await loadMovies();refreshRows();paintKidsMode();paintProfileExtra()}
function pushSupported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
async function pushState(){
  if(!pushSupported())return 'unsupported';
  if(Notification.permission==='denied')return 'denied';
  try{const reg=await navigator.serviceWorker.ready;return (await reg.pushManager.getSubscription())?'on':'off'}catch{return 'off'}
}
async function pushToggle(on){
  const reg=await navigator.serviceWorker.ready;
  if(!on){const s=await reg.pushManager.getSubscription();if(s){await api('/api/push/subscribe','DELETE',{endpoint:s.endpoint}).catch(()=>{});await s.unsubscribe()}return}
  const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error(t('push.denied'));
  const k=await api('/api/push/key');if(!k.enabled)throw new Error(t('push.off'));
  const raw=atob(k.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((k.publicKey.length+3)%4));
  const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await api('/api/push/subscribe','POST',{subscription:sub.toJSON(),lang:I18N.lang()});
}
async function paintProfileExtra(){
  const grid=$('#profile-view .profile-grid');if(!grid||!me)return;
  let card=$('#pf-extra2');if(!card){card=document.createElement('div');card.id='pf-extra2';card.className='glass profile-card';grid.appendChild(card)}
  const [ps,bl,prov]=await Promise.all([pushState(),api('/api/user/blocks').catch(()=>({blocked:[],muted:[]})),api('/api/auth/providers').catch(()=>({}))]);
  const k=me.kids&&me.kids.on;
  card.innerHTML=`
    <h3 class="card-h"><i data-lucide="baby"></i><span>${esc(t('kids.title'))}</span></h3>
    <p class="muted-p">${esc(t('kids.desc'))}</p>
    <div class="pf-row"><span>${esc(k?t('kids.on',{n:me.kids.maxAge}):t('kids.offTxt'))}</span><button class="${k?'secondary-btn':'primary-btn'}" id="kids-toggle" type="button">${esc(t(k?'kids.disable':'kids.enable'))}</button></div>
    ${me.hasKidsPin?`<button class="ghost-btn" id="kids-pin" type="button"><i data-lucide="key-round"></i><span>${esc(t('kids.changePin'))}</span></button>`:''}
    <h3 class="card-h"><i data-lucide="bell-ring"></i><span>${esc(t('push.title'))}</span></h3>
    <div class="pf-row"><span>${esc(t('push.state_'+ps))}</span>${ps==='unsupported'||ps==='denied'?'':`<button class="${ps==='on'?'secondary-btn':'primary-btn'}" id="push-toggle" type="button">${esc(t(ps==='on'?'push.disable':'push.enable'))}</button>`}</div>
    ${ps==='on'?`<button class="ghost-btn" id="push-test" type="button"><i data-lucide="send"></i><span>${esc(t('push.test'))}</span></button>`:''}
    <h3 class="card-h"><i data-lucide="user-x"></i><span>${esc(t('blk.title'))}</span></h3>
    <div class="blk-list">${[...bl.blocked.map(u=>({...u,k:'block'})),...bl.muted.map(u=>({...u,k:'mute'}))].map(u=>`<div class="blk-item"><span class="avatar avatar-sm">${avatarHTML({name:u.displayName,avatarUrl:u.avatarUrl,initial:Array.from(u.displayName)[0]})}</span><span>${esc(u.displayName)} <small>${esc(t(u.k==='block'?'blk.blocked':'blk.muted'))}</small></span><button type="button" class="ghost-btn" data-un="${esc(u.username)}" data-k="${u.k}">${esc(t('blk.undo'))}</button></div>`).join('')||`<div class="muted-p">${esc(t('blk.none'))}</div>`}</div>
    ${(prov.google||prov.telegram)?`<h3 class="card-h"><i data-lucide="link"></i><span>${esc(t('oauth.link'))}</span></h3><div id="oauth-link" class="oauth-btns"></div>`:''}`;
  icons();
  $('#kids-toggle').onclick=()=>{
    if(!k)pinModal({title:t('kids.enable'),desc:t('kids.enableDesc'),needNewPin:!me.hasKidsPin,needMax:true,onSubmit:async v=>{const d=await api('/api/user/kids','POST',{on:true,maxAge:v.maxAge,pin:v.pin});await afterKidsChange(d.user)}});
    else pinModal({title:t('kids.disable'),desc:t('kids.disableDesc'),usePassword:!me.oauth,onSubmit:async v=>{const d=await api('/api/user/kids','POST',{on:false,pin:v.pin,password:v.password});await afterKidsChange(d.user)}});
  };
  const kp=$('#kids-pin');if(kp)kp.onclick=()=>{
    const el=modal(`<h3>${esc(t('kids.changePin'))}</h3><p class="muted-p">${esc(t('kids.changePinDesc'))}</p>
      <label class="flt"><span>${esc(t('kids.pin'))}</span><input id="cp-old" inputmode="numeric" maxlength="6" type="password" dir="ltr" autocomplete="off"></label>
      ${me.oauth?'':`<label class="flt"><span>${esc(t('kids.orPassword'))}</span><input id="cp-pass" type="password" dir="ltr" autocomplete="current-password"></label>`}
      <label class="flt"><span>${esc(t('kids.newPin'))}</span><input id="cp-new" inputmode="numeric" maxlength="6" type="password" dir="ltr" autocomplete="off"></label>
      <button class="primary-btn" id="cp-ok" type="button"><i data-lucide="check"></i><span>${esc(t('common.confirm'))}</span></button><div class="auth-error" id="cp-err"></div>`);
    el.querySelector('#cp-ok').onclick=async()=>{try{const d=await api('/api/user/kids/pin','POST',{pin:el.querySelector('#cp-old').value.trim(),password:(el.querySelector('#cp-pass')||{}).value||'',newPin:el.querySelector('#cp-new').value.trim()});setMe(d.user);closeModal();toast(t('kids.pinSaved'))}catch(e){el.querySelector('#cp-err').textContent=e.message}};
  };
  const pt=$('#push-toggle');if(pt)pt.onclick=async()=>{try{await pushToggle(ps!=='on');paintProfileExtra()}catch(e){toast(e.message,'error')}};
  const pz=$('#push-test');if(pz)pz.onclick=async()=>{try{const r=await api('/api/push/test','POST',{});toast(r.sent?t('push.sent'):t('push.notSent'),r.sent?'success':'info')}catch(e){toast(e.message,'error')}};
  card.querySelectorAll('[data-un]').forEach(b=>b.onclick=async()=>{try{await api(`/api/users/${encodeURIComponent(b.dataset.un)}/${b.dataset.k}`,'DELETE');paintProfileExtra()}catch(e){toast(e.message,'error')}});
  if($('#oauth-link'))mountOAuth($('#oauth-link'),prov,true);
}
document.addEventListener('tabchange',e=>{if(e.detail==='profile')paintProfileExtra()});

/* ---------- حظر وكتم من التعليقات وصفحة القناة ---------- */
function blockUser(username,done){
  const el=modal(`<h3>${esc(t('blk.confirmT',{u:username}))}</h3><p class="muted-p">${esc(t('blk.confirmD'))}</p>
    <div class="rt-btns"><button class="primary-btn danger" id="bk-block" type="button">${esc(t('blk.block'))}</button><button class="secondary-btn" id="bk-mute" type="button">${esc(t('blk.mute'))}</button></div>`);
  const go=k=>async()=>{try{await api(`/api/users/${encodeURIComponent(username)}/${k}`,'POST',{});closeModal();toast(t(k==='block'?'blk.done':'blk.doneMute'));if(done)done()}catch(e){toast(e.message,'error')}};
  el.querySelector('#bk-block').onclick=go('block');el.querySelector('#bk-mute').onclick=go('mute');
}
new MutationObserver(()=>{
  const act=$('#channel-view .ch-actions');if(!act||$('#ch-block')||$('#ch-edit'))return;
  const u=(($('#channel-view .ch-info small')||{}).textContent||'').replace('@','');if(!u)return;
  act.insertAdjacentHTML('beforeend',`<button class="ghost-btn" id="ch-block" type="button"><i data-lucide="user-x"></i><span>${esc(t('blk.block'))}</span></button>`);
  $('#ch-block').onclick=()=>{if(requireLogin())blockUser(u,()=>Extras.openChannel(u))};icons();
}).observe(document.body,{childList:true,subtree:true});

/* ---------- نص التعليق: @إشارات + روابط الزمن ---------- */
function cmText(c,type){
  let h=esc(c.text);
  h=h.replace(/@([\p{L}\p{N}_.-]{3,24})/gu,'<a class="mention" data-user="$1">@$1</a>');
  if(type==='movie')h=h.replace(/(^|[\s(])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])/g,(m,a,ts)=>{const p=ts.split(':').map(Number);const s=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];return `${a}<a class="ts" data-ts="${s}">${ts}</a>`});
  return h;
}
document.addEventListener('click',e=>{
  const m=e.target.closest&&e.target.closest('a.mention');if(m){e.preventDefault();Extras.openChannel(m.dataset.user);return}
  const ts=e.target.closest&&e.target.closest('a.ts');if(ts){e.preventDefault();const v=$('#video');if(v){v.currentTime=Number(ts.dataset.ts);v.play().catch(()=>{});$('#player').scrollIntoView({behavior:'smooth',block:'center'})}}
});
// اقتراح أسماء عند كتابة @
let sug=null,sugTimer=null;
document.addEventListener('input',e=>{
  const ta=e.target;if(!(ta instanceof HTMLTextAreaElement)||!ta.closest('.cm-box'))return;
  const m=/@([\p{L}\p{N}_.-]{1,24})$/u.exec(ta.value.slice(0,ta.selectionStart));
  clearTimeout(sugTimer);if(!m){hideSug();return}
  sugTimer=setTimeout(async()=>{
    try{const list=await api(`/api/users/suggest?q=${encodeURIComponent(m[1])}`);if(!list.length){hideSug();return}
      if(!sug){sug=document.createElement('div');sug.className='mention-sug glass';ta.closest('.cm-box').appendChild(sug)}
      sug.innerHTML=list.map(u=>`<button type="button" data-u="${esc(u.username)}"><span class="avatar avatar-sm">${avatarHTML({name:u.displayName,avatarUrl:u.avatarUrl,initial:Array.from(u.displayName)[0]})}</span>${esc(u.displayName)} <small>@${esc(u.username)}</small></button>`).join('');
      sug.querySelectorAll('button').forEach(b=>b.onmousedown=ev=>{ev.preventDefault();const pre=ta.value.slice(0,ta.selectionStart).replace(/@([\p{L}\p{N}_.-]{1,24})$/u,'@'+b.dataset.u+' ');ta.value=pre+ta.value.slice(ta.selectionStart);ta.focus();ta.dispatchEvent(new Event('input',{bubbles:true}));hideSug()});
    }catch{}
  },180);
});
function hideSug(){if(sug){sug.remove();sug=null}}
document.addEventListener('focusout',()=>setTimeout(hideSug,150));

/* =====================================================
   6) Shorts: حفظ • قوائم • عرض عريض • إغلاق التعليقات
   ===================================================== */
function shortRail(s,act){
  let h=act('save','bookmark',t('sv.save'),null,s.saved?'on':'')+act('addlist','folder-plus',t('sv.addList'),null);
  if(s.mine)h+=act('cmoff',s.commentsOff?'message-circle-off':'message-circle-more',t(s.commentsOff?'sv.cmOn':'sv.cmOff'),null,s.commentsOff?'on':'');
  return h;
}
function shortBadge(s){return s.hidden?`<span class="hid-chip" title="${esc(t('mod.reason_'+(s.modReason||'text')))}"><i data-lucide="eye-off"></i>${esc(t('mod.hidden'))}</span>`:''}
document.addEventListener('click',async e=>{
  const b=e.target.closest&&e.target.closest('#shorts-feed .rail-btn[data-act]');if(!b)return;
  const act=b.dataset.act;if(!['save','addlist','cmoff'].includes(act))return;
  e.stopPropagation();e.preventDefault();
  const card=b.closest('.short'),id=card.dataset.id;
  if(!me){toast(t('err.loginFirst'),'info');openAuth('login');return}
  try{
    if(act==='save'){const on=!b.classList.contains('on');await api(`/api/shorts/${encodeURIComponent(id)}/save`,'POST',{on});b.classList.toggle('on',on);toast(t(on?'sv.saved':'sv.unsaved'))}
    else if(act==='cmoff'){const off=!b.classList.contains('on');const r=await api(`/api/shorts/${encodeURIComponent(id)}/settings`,'PATCH',{commentsOff:off});b.classList.toggle('on',r.commentsOff);toast(t(r.commentsOff?'sv.cmOffDone':'sv.cmOnDone'))}
    else listPicker(id);
  }catch(x){toast(x.message,'error')}
},true);
async function listPicker(sid){
  let d=await api('/api/user/short-lists');
  const draw=()=>{const el=$('#ex-modal');if(!el)return;el.querySelector('.sl').innerHTML=d.lists.map(l=>`<button type="button" class="pl-pick" data-l="${esc(l.id)}"><i data-lucide="folder"></i><span>${esc(l.name)}</span><em>${l.count}</em></button>`).join('')||`<div class="muted-p">${esc(t('sv.noLists'))}</div>`;
    el.querySelectorAll('[data-l]').forEach(b=>b.onclick=async()=>{try{await api(`/api/user/short-lists/${b.dataset.l}/items`,'POST',{shortId:sid});closeModal();toast(t('sv.added'))}catch(x){toast(x.message,'error')}});icons()};
  modal(`<h3>${esc(t('sv.addList'))}</h3><div class="sl"></div><form class="sl-new" id="sl-form"><input maxlength="40" id="sl-name" placeholder="${esc(t('sv.newList'))}"><button class="primary-btn" type="submit"><i data-lucide="plus"></i></button></form>`);
  draw();
  $('#sl-form').onsubmit=async ev=>{ev.preventDefault();const n=$('#sl-name').value.trim();if(!n)return;try{await api('/api/user/short-lists','POST',{name:n});d=await api('/api/user/short-lists');$('#sl-name').value='';draw()}catch(x){toast(x.message,'error')}};
}
// عرض عريض (يملأ الشاشة / يحتويها)
function paintWide(){const on=LS.get('osama_wide','0')==='1';document.body.classList.toggle('shorts-wide',on);const b=$('#st-wide');if(b)b.classList.toggle('on',on)}
new MutationObserver(()=>{
  const tabs=$('#shorts-top .st-tabs');if(!tabs||$('#st-wide'))return;
  tabs.insertAdjacentHTML('beforeend',`<button type="button" id="st-wide" aria-label="${esc(t('sv.wide'))}"><i data-lucide="maximize-2"></i></button>`);
  $('#st-wide').onclick=()=>{LS.set('osama_wide',LS.get('osama_wide','0')==='1'?'0':'1');paintWide()};paintWide();icons();
}).observe(document.body,{childList:true,subtree:true});

/* =====================================================
   7) علامات التبويب الجديدة: لوحة المبدع + بلا إنترنت
   ===================================================== */
function injectViews(){
  const content=$('main.content');if(!content||$('#creator-view'))return;
  content.insertAdjacentHTML('beforeend','<section class="view hidden" id="creator-view"></section><section class="view hidden" id="offline-view"></section>');
  const nav=$('.side-nav');
  nav.insertAdjacentHTML('beforeend',`<button data-tab="creator" id="nav-creator" type="button" class="hidden"><i data-lucide="chart-no-axes-column"></i><span>${esc(t('creator.nav'))}</span></button><button data-tab="offline" id="nav-offline" type="button"><i data-lucide="cloud-off"></i><span>${esc(t('off.nav'))}</span></button>`);
  nav.querySelectorAll('[data-tab="creator"],[data-tab="offline"]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  icons();
}
const _switchTab=window.switchTab;
window.switchTab=function(tab){
  if(tab==='creator'&&!me){openAuth('login');return}
  const r=_switchTab.apply(this,arguments);
  if(tab==='creator')renderCreator();if(tab==='offline')renderOffline();
  return r;
};
document.addEventListener('auth:changed',()=>{const n=$('#nav-creator');if(n)n.classList.toggle('hidden',!me||kidsOn())});

async function renderCreator(){
  const v=$('#creator-view');v.innerHTML=`<div class="cm-empty">${esc(t('common.loading'))}</div>`;
  let d;try{d=await api('/api/user/creator')}catch(e){v.innerHTML=`<div class="empty glass"><h3>${esc(e.message)}</h3></div>`;return}
  const T=d.totals,max=Math.max(1,...d.followersDaily.map(x=>x.n));
  const kpi=(i,l,n)=>`<div class="kpi glass"><i data-lucide="${i}"></i><div><strong>${fmtCompact(n)}</strong><span>${esc(l)}</span></div></div>`;
  v.innerHTML=`<div class="section-head"><div><h2>${esc(t('creator.title'))}</h2><p>${esc(t('creator.sub'))}</p></div></div>
    <div class="kpis">${kpi('zap',t('creator.shorts'),T.shorts)}${kpi('eye',t('creator.views'),T.views)}${kpi('thumbs-up',t('creator.likes'),T.likes)}${kpi('message-circle',t('creator.comments'),T.comments)}${kpi('share-2',t('creator.shares'),T.shares)}${kpi('users',t('creator.followers'),T.followers)}</div>
    <div class="glass cr-card"><h3>${esc(t('creator.newFollowers'))} <small>+${d.newFollowers30}</small></h3>
      <svg class="cr-chart" viewBox="0 0 300 70" preserveAspectRatio="none" role="img" aria-label="${esc(t('creator.newFollowers'))}">${d.followersDaily.map((x,i)=>`<rect x="${i*10+1}" width="8" y="${68-Math.round(x.n/max*64)}" height="${Math.max(2,Math.round(x.n/max*64))}" rx="2"><title>${esc(x.d)}: ${x.n}</title></rect>`).join('')}</svg></div>
    ${d.tags.length?`<div class="glass cr-card"><h3>${esc(t('creator.tags'))}</h3><div class="cr-tags">${d.tags.map(x=>`<span>#${esc(x.tag)} <b>${fmtCompact(x.views)}</b></span>`).join('')}</div></div>`:''}
    <div class="glass cr-card"><h3>${esc(t('creator.perShort'))}</h3>${d.shorts.length?`<div class="cr-table"><div class="cr-row head"><span></span><span>${esc(t('creator.views'))}</span><span>${esc(t('creator.likes'))}</span><span>${esc(t('creator.comments'))}</span><span>${esc(t('creator.eng'))}</span></div>${d.shorts.map(s=>`<button type="button" class="cr-row" data-id="${esc(s.id)}"><span class="cr-cap">${esc(s.caption||'—')}${s.hidden?` <em>${esc(t('mod.hidden'))}</em>`:''}${s.commentsOff?` <em>${esc(t('sv.cmOff'))}</em>`:''}</span><span>${fmtCompact(s.views)}</span><span>${fmtCompact(s.likes)}</span><span>${fmtCompact(s.comments)}</span><span>${s.engagement}%</span></button>`).join('')}</div>`:`<div class="muted-p">${esc(t('ch.none'))}</div>`}</div>`;
  v.querySelectorAll('.cr-row[data-id]').forEach(b=>b.onclick=()=>{document.dispatchEvent(new CustomEvent('shorts:open',{detail:b.dataset.id}));switchTab('shorts')});
  icons();
}

/* =====================================================
   8) تحميل للمشاهدة بلا إنترنت (IndexedDB)
   ===================================================== */
const OFF={
  db:null,
  open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('osama-offline',1);r.onupgradeneeded=()=>r.result.createObjectStore('movies',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
  async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction('movies',mode),st=tx.objectStore('movies');const rq=fn(st);tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})},
  get(id){return this.tx('readonly',s=>s.get(id)).catch(()=>null)},
  all(){return this.tx('readonly',s=>s.getAll()).catch(()=>[])},
  put(r){return this.tx('readwrite',s=>s.put(r))},
  del(id){return this.tx('readwrite',s=>s.delete(id))}
};
let offUrl=null;
async function paintOfflineBtn(m){
  const box=$('#movie-actions');if(!box||!window.indexedDB)return;
  let b=$('#act-offline');
  if(!b){box.insertAdjacentHTML('beforeend',`<button class="act-btn lg" id="act-offline" type="button"><i data-lucide="cloud-download"></i><span></span></button><button class="act-btn lg" id="act-party" type="button"><i data-lucide="users"></i><span>${esc(t('party.btn'))}</span></button>`);b=$('#act-offline');$('#act-party').onclick=startPartyFlow;icons()}
  const have=!!(await OFF.get(m.id));
  const lab=b.querySelector('span');lab.textContent=t(have?'off.saved':'off.save');b.classList.toggle('on',have);b.disabled=false;
  b.onclick=async()=>{
    if(currentMovie!==m&&currentMovie)m=currentMovie;
    if(have){if(confirm(t('off.removeQ'))){await OFF.del(m.id);paintOfflineBtn(m)}return}
    await downloadOffline(m,b);
  };
}
async function downloadOffline(m,btn){
  if(m.comingSoon)return;
  try{const est=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null;
    if(est&&m.fileSize&&est.quota-est.usage<m.fileSize*1.1){toast(t('off.noSpace'),'error');return}}catch{}
  const lab=btn.querySelector('span');btn.disabled=true;
  try{
    const r=await fetch(`/api/movies/${encodeURIComponent(m.id)}/download`);
    if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||t('err.generic'))}
    const total=Number(r.headers.get('content-length'))||m.fileSize||0,rd=r.body.getReader(),chunks=[];let got=0;
    for(;;){const {value,done}=await rd.read();if(done)break;chunks.push(value);got+=value.length;lab.textContent=total?Math.round(got/total*100)+'%':fmtBytes(got)}
    const blob=new Blob(chunks,{type:r.headers.get('content-type')||'video/mp4'});
    const meta={...m};delete meta.rating;
    await OFF.put({id:m.id,meta,blob,size:blob.size,savedAt:Date.now()});
    toast(t('off.done'));
  }catch(e){toast(e.message||t('off.fail'),'error')}
  finally{paintOfflineBtn(m)}
}
const fmtBytes=n=>n>1e9?(n/1e9).toFixed(2)+' GB':n>1e6?(n/1e6).toFixed(1)+' MB':Math.round(n/1e3)+' KB';
const _startPlayback=window.startPlayback;
window.startPlayback=async function(movie){
  const r=_startPlayback.apply(this,arguments);
  try{const rec=await OFF.get(movie.id);
    if(rec&&currentMovie&&currentMovie.id===movie.id){
      if(offUrl)URL.revokeObjectURL(offUrl);offUrl=URL.createObjectURL(rec.blob);
      const v=$('#video'),t0=v.currentTime||0;v.src=offUrl;v.load();if(t0)v.currentTime=t0;
    }}catch{}
  return r;
};
const _checkAccess=window.checkAccess;
window.checkAccess=async function(movie){
  if(navigator.onLine===false){const rec=await OFF.get(movie.id);if(rec){startPlayback(movie);return}}
  return _checkAccess.apply(this,arguments);
};
async function renderOffline(){
  const v=$('#offline-view');const list=await OFF.all();let q={usage:0,quota:0};try{q=await navigator.storage.estimate()}catch{}
  v.innerHTML=`<div class="section-head"><div><h2>${esc(t('off.title'))}</h2><p>${esc(t('off.sub'))}</p></div><span class="count-pill">${list.length}</span></div>
    ${q.quota?`<div class="off-quota"><i style="width:${Math.min(100,Math.round(q.usage/q.quota*100))}%"></i><small>${esc(t('off.usage',{u:fmtBytes(q.usage),q:fmtBytes(q.quota)}))}</small></div>`:''}
    ${list.length?`<div class="movie-grid" id="off-grid">${list.map(r=>`<div class="off-item">${card(r.meta)}<button class="ghost-btn danger-ghost off-del" data-id="${esc(r.id)}" type="button"><i data-lucide="trash-2"></i><span>${fmtBytes(r.size)}</span></button></div>`).join('')}</div>`:`<div class="empty glass"><i data-lucide="cloud-off"></i><h3>${esc(t('off.empty'))}</h3><p>${esc(t('off.emptyD'))}</p></div>`}`;
  v.querySelectorAll('[data-movie]').forEach(c=>c.onclick=()=>{const rec=list.find(r=>r.id===c.dataset.movie);if(rec){const m=byId(rec.id)||{...rec.meta,locked:false};openPlayer(m)}});
  v.querySelectorAll('.off-del').forEach(b=>b.onclick=async()=>{await OFF.del(b.dataset.id);renderOffline()});
  icons();
}

/* =====================================================
   9) مشاهدة جماعية (Watch Party)
   ===================================================== */
let party=null;
async function startPartyFlow(){
  if(!requireLogin()||!currentMovie)return;
  const m=currentMovie;
  const el=modal(`<h3><i data-lucide="users"></i> ${esc(t('party.title'))}</h3><p class="muted-p">${esc(t('party.desc'))}</p>
    <div class="seg" id="pt-ctl"><button type="button" data-c="host" class="on">${esc(t('party.ctlHost'))}</button><button type="button" data-c="all">${esc(t('party.ctlAll'))}</button></div>
    <button class="primary-btn" id="pt-create" type="button"><i data-lucide="play"></i><span>${esc(t('party.create'))}</span></button>
    <div class="muted-p">${esc(t('party.orJoin'))}</div>
    <form id="pt-join" class="sl-new"><input id="pt-code" maxlength="6" dir="ltr" placeholder="ABC123" style="text-transform:uppercase"><button class="secondary-btn" type="submit">${esc(t('party.join'))}</button></form><div class="auth-error" id="pt-err"></div>`);
  let ctl='host';el.querySelectorAll('#pt-ctl button').forEach(b=>b.onclick=()=>{ctl=b.dataset.c;el.querySelectorAll('#pt-ctl button').forEach(x=>x.classList.toggle('on',x===b))});
  $('#pt-create').onclick=async()=>{try{const r=await api('/api/party','POST',{movieId:m.id,control:ctl});closeModal();joinParty(r.code,true)}catch(e){$('#pt-err').textContent=e.message}};
  $('#pt-join').onsubmit=e=>{e.preventDefault();const c=$('#pt-code').value.trim().toUpperCase();if(c){closeModal();joinParty(c)}};
}
function paintParty(){if(!party)return;party.panel&&party.panel.classList.remove('hidden')}
async function joinParty(code,created){
  if(!me){window.__pendingParty=code;openAuth('login');return}
  leaveParty(true);
  let info;try{info=await api(`/api/party/${encodeURIComponent(code)}`)}catch(e){toast(e.message,'error');return}
  const m=byId(info.movieId);if(!m){toast(t('party.noMovie'),'error');return}
  if($('#player-view').classList.contains('hidden')||!currentMovie||currentMovie.id!==m.id)openPlayer(m,'direct');
  const p=party={code,movieId:m.id,hostId:info.hostId,control:info.control,members:info.members,applying:0,last:info.state,es:null,panel:null,me:me.id,needTap:false};
  const panel=document.createElement('aside');panel.className='party-panel glass';panel.id='party-panel';
  panel.innerHTML=`<div class="pp-head"><strong><i data-lucide="users"></i> <span id="pp-code" dir="ltr">${esc(code)}</span></strong><span id="pp-role" class="pp-role"></span><button type="button" class="icon-btn" id="pp-min" aria-label="min"><i data-lucide="chevron-down"></i></button></div>
    <div class="pp-body"><div class="pp-members" id="pp-members"></div><div class="pp-chat" id="pp-chat"></div>
    <form id="pp-form" class="pp-form"><input id="pp-in" maxlength="300" autocomplete="off" placeholder="${esc(t('party.say'))}"><button type="submit" class="icon-btn" aria-label="send"><i data-lucide="send"></i></button></form>
    <div class="pp-act"><button type="button" class="ghost-btn" id="pp-copy"><i data-lucide="link"></i><span>${esc(t('party.copy'))}</span></button><button type="button" class="ghost-btn" id="pp-sync"><i data-lucide="refresh-cw"></i><span>${esc(t('party.sync'))}</span></button><button type="button" class="ghost-btn danger-ghost" id="pp-leave"><i data-lucide="log-out"></i><span>${esc(t('party.leave'))}</span></button></div></div>`;
  $('#player-view').appendChild(panel);p.panel=panel;icons();
  $('#pp-min').onclick=()=>panel.classList.toggle('min');
  $('#pp-leave').onclick=()=>leaveParty();
  $('#pp-sync').onclick=()=>applyState(p.last,true);
  $('#pp-copy').onclick=async()=>{const url=`${location.origin}/?party=${code}`;try{if(navigator.share)await navigator.share({title:t('party.title'),url});else{await navigator.clipboard.writeText(url);toast(t('share.copied'))}}catch{}};
  $('#pp-form').onsubmit=async e=>{e.preventDefault();const i=$('#pp-in'),tx=i.value.trim();if(!tx)return;i.value='';try{await api(`/api/party/${code}/chat`,'POST',{text:tx})}catch(x){toast(x.message,'error')}};
  const canCtl=()=>p.hostId===p.me||p.control==='all';
  const paintRole=()=>{$('#pp-role').textContent=p.hostId===p.me?t('party.youHost'):canCtl()?t('party.youCtl'):t('party.watching');};
  const paintMembers=()=>{$('#pp-members').innerHTML=p.members.map(x=>`<span class="pp-m${x.host?' host':''}" title="${esc(x.name)}"><span class="avatar avatar-sm">${avatarHTML({name:x.name,avatarUrl:x.avatarUrl,initial:Array.from(x.name)[0]})}</span>${x.host?'<i data-lucide="crown"></i>':''}</span>`).join('');icons();paintRole()};
  const chat=m=>{const c=$('#pp-chat');c.insertAdjacentHTML('beforeend',`<div class="pp-msg${m.userId===p.me?' mine':''}"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`);c.scrollTop=c.scrollHeight;while(c.children.length>80)c.firstChild.remove()};
  info.chat.forEach(chat);paintMembers();
  const v=$('#video');
  p.applyState=applyState;
  function applyState(st,force){
    if(!st)return;p.last=st;
    const target=st.t;let drift=Math.abs(v.currentTime-target);
    p.applying++;
    const done=()=>setTimeout(()=>{p.applying=Math.max(0,p.applying-1)},400);
    if(v.readyState>0&&(force||drift>1.5))v.currentTime=target;
    if(Math.abs(v.playbackRate-st.rate)>0.01)v.playbackRate=st.rate;
    if(st.playing&&v.paused){v.play().catch(()=>{p.needTap=true;showTap()})}
    else if(!st.playing&&!v.paused)v.pause();
    done();
  }
  function showTap(){if($('#pp-tap'))return;panel.insertAdjacentHTML('afterbegin',`<button type="button" class="primary-btn" id="pp-tap"><i data-lucide="play"></i><span>${esc(t('party.tapPlay'))}</span></button>`);icons();$('#pp-tap').onclick=()=>{$('#pp-tap').remove();applyState(p.last,true)}}
  const send=(action,extra={})=>api(`/api/party/${code}/control`,'POST',{action,t:v.currentTime,...extra}).catch(()=>{});
  const onPlay=()=>{if(p.applying)return;canCtl()?send('play'):setTimeout(()=>applyState(p.last,true),300)};
  const onPause=()=>{if(p.applying||v.ended)return;canCtl()?send('pause'):setTimeout(()=>applyState(p.last,true),300)};
  const onSeek=()=>{if(p.applying)return;canCtl()?send(v.paused?'pause':'play'):setTimeout(()=>applyState(p.last,true),300)};
  const onRate=()=>{if(p.applying)return;canCtl()?send('rate',{rate:v.playbackRate}):applyState(p.last)};
  v.addEventListener('play',onPlay);v.addEventListener('pause',onPause);v.addEventListener('seeked',onSeek);v.addEventListener('ratechange',onRate);
  p.off=()=>{v.removeEventListener('play',onPlay);v.removeEventListener('pause',onPause);v.removeEventListener('seeked',onSeek);v.removeEventListener('ratechange',onRate)};
  const es=new EventSource(`/api/party/${encodeURIComponent(code)}/events`);p.es=es;
  es.addEventListener('init',e=>{const d=JSON.parse(e.data);p.hostId=d.hostId;p.control=d.control;p.members=d.members;paintMembers();const go=()=>applyState(d.state,true);v.readyState>0?go():v.addEventListener('loadedmetadata',go,{once:true})});
  es.addEventListener('state',e=>applyState(JSON.parse(e.data)));
  es.addEventListener('members',e=>{p.members=JSON.parse(e.data);paintMembers()});
  es.addEventListener('host',e=>{p.hostId=JSON.parse(e.data).hostId;paintMembers()});
  es.addEventListener('chat',e=>chat(JSON.parse(e.data)));
  es.onerror=()=>{if(es.readyState===2){toast(t('party.ended'),'info');leaveParty(true)}};
  toast(t(created?'party.created':'party.joined'));
}
function leaveParty(silent){
  const p=party;if(!p)return;party=null;
  try{p.es&&p.es.close()}catch{}try{p.off&&p.off()}catch{}
  if(p.panel)p.panel.remove();
  api(`/api/party/${p.code}/leave`,'POST',{}).catch(()=>{});
  if(!silent)toast(t('party.left'),'info');
}
document.addEventListener('tabchange',e=>{if(e.detail!=='player'&&party)leaveParty()});
const _hdl=window.handleDeepLink;
window.handleDeepLink=function(){
  const c=new URLSearchParams(location.search).get('party');
  if(c){history.replaceState(null,'','/');joinParty(c.toUpperCase().slice(0,6));return}
  return _hdl.apply(this,arguments);
};
document.addEventListener('auth:changed',()=>{if(me&&window.__pendingParty){const c=window.__pendingParty;window.__pendingParty=null;joinParty(c)}});

/* =====================================================
   10) المشغّل: سرعة محفوظة • إيماءات (صوت/سطوع/ضغط مطوّل) • مؤقت النوم
   ===================================================== */
function applySavedSpeed(){
  const v=$('#video');if(!v)return;
  const r=Number(LS.get('osama_rate','1'));
  const set=()=>{if(party)return;if(r&&r!==1&&Math.abs(v.playbackRate-r)>0.01){v.playbackRate=r}};
  v.addEventListener('loadedmetadata',set,{once:true});
}
document.addEventListener('ratechange',e=>{const v=e.target;if(v&&v.id==='video'&&!longPress.on&&!party){LS.set('osama_rate',String(v.playbackRate))}},true);
const longPress={on:false,prev:1,timer:null};
function initGestures(){
  const pl=$('#pl'),v=$('#video');if(!pl||pl.dataset.g2)return;pl.dataset.g2='1';
  pl.insertAdjacentHTML('beforeend',`<div class="pl-gauge lg hidden" id="pl-gauge"><i data-lucide="sun"></i><div><b id="pl-gauge-b"></b></div></div><div class="pl-bright" id="pl-bright"></div><div class="pl-fast lg hidden" id="pl-fast"><i data-lucide="fast-forward"></i>2×</div>`);
  let st=null,bright=Number(LS.get('osama_bright','1'));const br=$('#pl-bright');
  const setB=x=>{bright=Math.min(1,Math.max(0.3,x));br.style.background=`rgba(0,0,0,${(1-bright).toFixed(2)})`;LS.set('osama_bright',String(bright))};setB(bright);
  const gauge=(icon,val)=>{const g=$('#pl-gauge');g.classList.remove('hidden');g.querySelector('i,svg').outerHTML=`<i data-lucide="${icon}"></i>`;$('#pl-gauge-b').style.width=Math.round(val*100)+'%';icons();clearTimeout(gauge.t);gauge.t=setTimeout(()=>g.classList.add('hidden'),700)};
  pl.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'||e.target.closest('.pl-ui')||e.target.closest('.pl-big'))return;
    const r=pl.getBoundingClientRect();st={x:e.clientX,y:e.clientY,side:(e.clientX-r.left)/r.width<0.5?'L':'R',v0:v.volume,b0:bright,mode:null,h:r.height};
    clearTimeout(longPress.timer);
    longPress.timer=setTimeout(()=>{if(st&&!st.mode&&!party){longPress.on=true;longPress.prev=v.playbackRate;v.playbackRate=2;$('#pl-fast').classList.remove('hidden');st.mode='fast'}},450);
  });
  pl.addEventListener('pointermove',e=>{
    if(!st||e.pointerType==='mouse')return;
    const dy=st.y-e.clientY,dx=Math.abs(e.clientX-st.x);
    if(!st.mode){if(Math.abs(dy)>14&&Math.abs(dy)>dx*1.4){st.mode=st.side==='R'?'vol':'bri';clearTimeout(longPress.timer)}else if(dx>12)clearTimeout(longPress.timer)}
    if(st.mode==='vol'){v.volume=Math.min(1,Math.max(0,st.v0+dy/st.h*1.2));v.muted=v.volume===0;gauge(v.volume===0?'volume-x':'volume-2',v.volume)}
    else if(st.mode==='bri'){setB(st.b0+dy/st.h*1.2);gauge('sun',(bright-0.3)/0.7)}
  });
  const end=()=>{clearTimeout(longPress.timer);if(longPress.on){longPress.on=false;v.playbackRate=longPress.prev;$('#pl-fast').classList.add('hidden')}st=null};
  pl.addEventListener('pointerup',end);pl.addEventListener('pointercancel',end);
  // مؤقت النوم
  const grp=$('#pl-speed-btn').parentElement;
  grp.insertAdjacentHTML('afterbegin',`<button class="pl-btn" id="pl-sleep" type="button" aria-label="${esc(t('sleep.title'))}"><i data-lucide="moon"></i></button>`);
  let sleep=null;
  const paintSleep=()=>{const b=$('#pl-sleep');b.classList.toggle('on',!!sleep);b.title=sleep?t('sleep.on',{n:Math.max(1,Math.ceil((sleep.at-Date.now())/60000))}):t('sleep.title')};
  const setSleep=min=>{clearTimeout(sleep&&sleep.t);sleep=null;
    if(min==='end'){sleep={end:true,at:Date.now()+9e9};toast(t('sleep.endSet'))}
    else if(min){sleep={at:Date.now()+min*60000,t:setTimeout(()=>{v.pause();sleep=null;paintSleep();toast(t('sleep.done'),'info');document.exitFullscreen&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{})},min*60000)};toast(t('sleep.set',{n:min}))}
    paintSleep()};
  v.addEventListener('ended',()=>{if(sleep&&sleep.end){sleep=null;paintSleep();const nx=$('#pl-next');if(nx){clearInterval(window.__nt);nx.classList.add('hidden')}}});
  $('#pl-sleep').onclick=e=>{e.stopPropagation();
    const m=$('#pl-menu-speed');
    m.innerHTML=`<div class="pl-menu-h">${esc(t('sleep.title'))}</div>`+[[15,t('sleep.min',{n:15})],[30,t('sleep.min',{n:30})],[60,t('sleep.min',{n:60})],['end',t('sleep.end')],[0,t('sleep.off')]].map(([k,l])=>`<button type="button" role="menuitem" data-sl="${k}"><span>${esc(l)}</span></button>`).join('');
    m.classList.remove('hidden');m.querySelectorAll('[data-sl]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const k=b.dataset.sl;setSleep(k==='end'?'end':Number(k));m.classList.add('hidden')});
  };
  icons();
}

/* =====================================================
   11) تسجيل الدخول عبر Google / Telegram
   ===================================================== */
let provCache=null;
async function providers(){return provCache||(provCache=await api('/api/auth/providers').catch(()=>({})))}
function loadScript(src,attrs={}){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;Object.entries(attrs).forEach(([k,v])=>s.setAttribute(k,v));s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
async function mountOAuth(box,prov,link){
  box.innerHTML='';
  if(prov.google){
    const slot=document.createElement('div');slot.className='oauth-slot';box.appendChild(slot);
    try{await loadScript('https://accounts.google.com/gsi/client');
      google.accounts.id.initialize({client_id:prov.google.clientId,callback:async r=>{try{const d=await api('/api/auth/google','POST',{credential:r.credential,link:!!link});link?toast(t('oauth.linked')):afterAuth(d.user)}catch(e){toast(e.message,'error')}}});
      google.accounts.id.renderButton(slot,{theme:'outline',size:'large',shape:'pill',width:260,locale:I18N.lang()})}catch{slot.innerHTML=`<small class="muted-p">${esc(t('oauth.blocked'))}</small>`}
  }
  if(prov.telegram){
    const slot=document.createElement('div');slot.className='oauth-slot';box.appendChild(slot);
    window.__tgAuth=async u=>{try{const d=await api('/api/auth/telegram','POST',{data:u,link:!!link});link?toast(t('oauth.linked')):afterAuth(d.user)}catch(e){toast(e.message,'error')}};
    const sc=document.createElement('script');sc.async=true;sc.src='https://telegram.org/js/telegram-widget.js?22';
    Object.entries({'data-telegram-login':prov.telegram.bot,'data-size':'large','data-radius':'20','data-onauth':'__tgAuth(user)','data-request-access':'write'}).forEach(([k,v])=>sc.setAttribute(k,v));
    slot.appendChild(sc);
  }
}
async function initOAuth(){
  const prov=await providers();if(!prov.google&&!prov.telegram)return;
  for(const form of ['#login-form','#register-form']){
    const f=$(form);if(!f||f.querySelector('.oauth-btns'))continue;
    f.insertAdjacentHTML('beforeend',`<div class="oauth-sep"><span>${esc(t('oauth.or'))}</span></div><div class="oauth-btns" data-o></div>`);
  }
  const first=$('#login-form .oauth-btns');if(first)mountOAuth(first,prov,false);
  const sec=$('#register-form .oauth-btns');if(sec)sec.innerHTML=`<small class="muted-p">${esc(t('oauth.hintReg'))}</small>`;
}

/* =====================================================
   12) تهيئة
   ===================================================== */
function init(){
  injectViews();initOAuth();initGestures();paintKidsMode();
  document.addEventListener('langchange',()=>{const n=$('#nav-creator span');if(n)n.textContent=t('creator.nav');const o=$('#nav-offline span');if(o)o.textContent=t('off.nav');if(currentMovie&&!$('#player-view').classList.contains('hidden'))paintDetailExtras(currentMovie);paintKidsMode()});
  window.addEventListener('online',()=>{if(window.loadMovies)loadMovies().then(refreshRows)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);

window.Extras2={cmText,blockUser,shortRail,shortBadge,seriesNext,joinParty,OFF,refreshRows};
})();
