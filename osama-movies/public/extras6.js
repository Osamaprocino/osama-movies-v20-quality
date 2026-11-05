/* ===================================================================
   extras6.js — الإصدار 14: تخصيص القناة (اسم/رابط/صورة/بانر) • البث المباشر للمشاهدين • إخفاء النشر عند إيقافه
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
async function api(url,method='GET',body){
  const r=await fetch(url,{method,headers:body instanceof FormData?{'X-Lang':I18N.lang()}:{'Content-Type':'application/json','X-Lang':I18N.lang()},body:body===undefined?undefined:(body instanceof FormData?body:JSON.stringify(body))});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null,closeModal=()=>window.Extras&&Extras.closeModal();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* =====================================================
   1) تخصيص قناتي
   ===================================================== */
async function openCustomize(){
  if(!me){openAuth('login');return}
  let st={};try{st=await api('/api/user/channel-style')}catch{}
  const link=h=>`${location.origin}/c/${h||me.username}`;
  const el=modal(`<h3><i data-lucide="palette"></i> ${esc(t('cust.title'))}</h3>
   <div class="cust-banner" id="cu-banner" style="${st.bannerUrl?`background-image:url('${esc(st.bannerUrl)}')`:''}"><div class="cust-actions"><label class="ghost-btn"><i data-lucide="image"></i><span>${esc(t('cust.banner'))}</span><input type="file" id="cu-bfile" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" class="ghost-btn" id="cu-brm"><i data-lucide="trash-2"></i></button></div></div>
   <div class="cust-ava"><span class="avatar avatar-xl" id="cu-ava">${avatarHTML(me)}</span><label class="secondary-btn"><i data-lucide="camera"></i><span>${esc(t('cust.avatar'))}</span><input type="file" id="cu-afile" accept="image/jpeg,image/png,image/webp" hidden></label></div>
   <form id="cu-form" class="pub-form" autocomplete="off">
    <label><span>${esc(t('cust.name'))}</span><input name="name" maxlength="40" value="${esc(st.name||'')}" placeholder="${esc(me.displayName||me.username)}"></label>
    <label><span>${esc(t('cust.handle'))}</span><input name="handle" dir="ltr" maxlength="24" value="${esc(st.handle||'')}" placeholder="${esc(me.username)}"></label>
    <div class="cust-link"><code id="cu-link" dir="ltr">${esc(link(st.handle))}</code><button type="button" class="ghost-btn" id="cu-copy"><i data-lucide="copy"></i><span>${esc(t('cust.copy'))}</span></button></div>
    <p class="muted-p pub-note">${esc(t('cust.handleHint'))}</p>
    <label><span>${esc(t('cust.bio'))}</span><textarea name="bio" rows="3" maxlength="200">${esc(st.bio||'')}</textarea></label>
    <div class="auth-error" id="cu-err"></div>
    <button class="primary-btn" type="submit"><i data-lucide="check"></i><span>${esc(t('cust.save'))}</span></button>
   </form>`,{cls:'pub-card'});
  const f=el.querySelector('#cu-form'),err=el.querySelector('#cu-err');
  f.handle.oninput=()=>{el.querySelector('#cu-link').textContent=link(f.handle.value.trim().toLowerCase().replace(/^@/,''))};
  el.querySelector('#cu-copy').onclick=async()=>{try{await navigator.clipboard.writeText(el.querySelector('#cu-link').textContent);toast(t('cust.copied'),'success')}catch{}};
  el.querySelector('#cu-bfile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const fd=new FormData();fd.append('banner',file);
    try{const d=await api('/api/user/channel/banner','POST',fd);el.querySelector('#cu-banner').style.backgroundImage=`url('${d.bannerUrl}')`;toast(t('cust.saved'),'success')}catch(x){err.textContent=x.message}};
  el.querySelector('#cu-brm').onclick=async()=>{try{await api('/api/user/channel/banner','DELETE');el.querySelector('#cu-banner').style.backgroundImage='';}catch(x){err.textContent=x.message}};
  el.querySelector('#cu-afile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const fd=new FormData();fd.append('avatar',file);
    try{const d=await api('/api/user/avatar','POST',fd);if(d.user){me.avatarUrl=d.user.avatarUrl;el.querySelector('#cu-ava').innerHTML=avatarHTML(me)}toast(t('cust.saved'),'success')}catch(x){err.textContent=x.message}};
  f.onsubmit=async e=>{e.preventDefault();err.textContent='';
    try{await api('/api/user/channel-style','PUT',{name:f.name.value,handle:f.handle.value,bio:f.bio.value});toast(t('cust.saved'),'success');closeModal();if(typeof Extras!=='undefined')Extras.openChannel(me.username)}
    catch(x){err.textContent=x.message}};
  icons();
}

/* ---------- زخرفة صفحة أي قناة: بانر + اسم مخصص + نبذة + زر التخصيص ---------- */
function watchChannel(){
  const v=$('#channel-view');if(!v)return;
  let busy=false;
  new MutationObserver(async()=>{
    if(busy)return;
    const small=v.querySelector('.ch-info small[dir=ltr]'),head=v.querySelector('.ch-head');
    if(!small||!head)return;
    const uname=small.textContent.replace('@','').trim();
    if(!uname||head.dataset.styled===uname)return;
    head.dataset.styled=uname;busy=true;
    try{
      const st=await api(`/api/users/${encodeURIComponent(uname)}/channel-style`);
      if(st.bannerUrl&&!v.querySelector('.ch-banner'))head.insertAdjacentHTML('beforebegin',`<div class="ch-banner" style="background-image:url('${esc(st.bannerUrl)}')"></div>`);
      const h2=head.querySelector('h2');if(st.name&&h2)h2.textContent=st.name;if(st.verified&&h2&&!h2.querySelector('.vb'))h2.insertAdjacentHTML('beforeend',`<i class="vb" title="${esc(t('ver.badge'))}"></i>`);
      if(st.handle){small.insertAdjacentHTML('afterend',`<small class="ch-handle" dir="ltr">${esc(location.host)}/c/${esc(st.handle)}</small>`)}
      if(st.bio){const st2=head.querySelector('.ch-stats');if(st2)st2.insertAdjacentHTML('beforebegin',`<p class="ch-bio">${esc(st.bio)}</p>`)}
      const ed=v.querySelector('#ch-edit');if(ed&&!v.querySelector('#ch-cust')){ed.insertAdjacentHTML('afterend',`<button class="secondary-btn" id="ch-cust" type="button"><i data-lucide="palette"></i><span>${esc(t('cust.btn'))}</span></button>`);$('#ch-cust').onclick=openCustomize;icons()}
      if(ed&&feat.userLive&&!v.querySelector('#ch-golive')){ed.insertAdjacentHTML('afterend',`<button class="secondary-btn" id="ch-golive" type="button"><i data-lucide="radio"></i><span>${esc(t('live.goBtn'))}</span></button>`);$('#ch-golive').onclick=openGoLive;icons()}
    }catch{}
    busy=false;
  }).observe(v,{childList:true,subtree:true});
}

/* =====================================================
   2) البث المباشر: القائمة + مشغّل المشاهدة
   ===================================================== */
let feat={userPublish:true,live:false};
function injectNav(){
  const nav=$('.side-nav');if(!nav||$('#nav-live'))return;
  nav.insertAdjacentHTML('beforeend',`<button type="button" id="nav-live"><i data-lucide="radio"></i><span>${esc(t('live.nav'))}</span><i class="live-dot hidden" id="live-dot"></i></button><button type="button" id="nav-customize"><i data-lucide="palette"></i><span>${esc(t('cust.nav'))}</span></button>`);
  $('#nav-live').onclick=()=>{closeSidebar();openLiveList()};
  $('#nav-customize').onclick=()=>{closeSidebar();openCustomize()};icons();
}
async function refreshFeatures(){
  try{feat=await api('/api/site/features')}catch{return}
  for(const id of ['#nav-publish','#nav-mine'])$$(id).forEach(b=>b.style.display=feat.userPublish?'':'none');
  const d=$('#live-dot');if(d)d.classList.toggle('hidden',!feat.live);
  paintBanner();
}
async function paintBanner(){
  let b=$('#live-banner');
  if(!feat.live){if(b)b.remove();return}
  let items=[];try{items=(await api('/api/live')).items}catch{return}
  if(!items.length){if(b)b.remove();return}
  const host=$('#tab-home')||$('#home-view')||$('main');if(!host)return;
  if(!b){host.insertAdjacentElement('afterbegin',Object.assign(document.createElement('button'),{id:'live-banner',type:'button',className:'live-banner'}));b=$('#live-banner')}
  const l=items[0];b.innerHTML=`<span class="live-badge">${esc(t('live.badge'))}</span><b>${esc(l.title)}</b><small>${l.owner?esc(l.owner.name)+' · ':''}${esc(t('live.viewers',{n:fmt(l.viewers)}))}</small><span class="live-go">${esc(t('live.watch'))}</span>`;
  b.onclick=()=>openLive(l.id);
}
async function openLiveList(){
  let items=[];try{items=(await api('/api/live')).items}catch(e){toast(e.message,'error');return}
  if(items.length===1&&!feat.userLive){openLive(items[0].id);return}
  modal(`<h3><i data-lucide="radio"></i> ${esc(t('live.title'))}</h3>${feat.userLive?`<button class="primary-btn" id="lv-golive" type="button"><i data-lucide="video"></i><span>${esc(t('live.goBtn'))}</span></button>`:''}${items.length?items.map(l=>`<button class="mine-item live-item" data-id="${esc(l.id)}" type="button"><span class="live-badge">${esc(t('live.badge'))}</span><div class="mine-info"><b>${esc(l.title)}</b><small>${l.owner?esc(l.owner.name)+' · ':''}${esc(t('live.viewers',{n:fmt(l.viewers)}))}</small></div></button>`).join(''):`<div class="cm-empty">${esc(t('live.none'))}</div>`}`);
  $$('.live-item').forEach(b=>b.onclick=()=>openLive(b.dataset.id));const gb=$('#lv-golive');if(gb)gb.onclick=()=>{closeModal();openGoLive()};icons();
}
let player=null;
function stopPlayer(){if(player){player.stop();player=null}}
async function openLive(id){
  stopPlayer();
  let info;try{info=await api('/api/live/'+encodeURIComponent(id))}catch(e){toast(e.message,'error');return}
  const el=modal(`<div class="live-wrap"><div class="live-stage"><video id="lv-video" playsinline autoplay controls></video><span class="live-badge live-corner">${esc(t('live.badge'))}</span><div class="live-msg" id="lv-msg">${esc(t('common.loading'))}</div></div>
   <h3 class="live-title">${esc(info.title)}</h3>${info.owner?`<button type="button" class="chan-meta live-owner" id="lv-owner"><b>${esc(info.owner.name)}${info.owner.verified?`<i class="vb" title="${esc(t('ver.badge'))}"></i>`:''}</b><small>@${esc(info.owner.username)}</small></button>`:''}<small id="lv-viewers">${esc(t('live.viewers',{n:fmt(info.viewers)}))}</small></div>`,{cls:'live-card'});
  document.dispatchEvent(new CustomEvent('live:open',{detail:{el,id,info}}));
  const video=el.querySelector('#lv-video'),msg=el.querySelector('#lv-msg');
  const ow=el.querySelector('#lv-owner');if(ow)ow.onclick=()=>{closeModal();Extras.openChannel(info.owner.username)};
  player=livePlayer(id,info,video,{
    onViewers:n=>{const e=$('#lv-viewers');if(e)e.textContent=t('live.viewers',{n:fmt(n)})},
    onPlaying:()=>msg.classList.add('hidden'),
    onEnded:()=>{msg.classList.remove('hidden');msg.textContent=t('live.ended')},
    onError:k=>{msg.classList.remove('hidden');msg.textContent=t(k==='unsupported'?'live.unsupported':k==='full'?'live.full':'err.generic')}
  });
  const obs=new MutationObserver(()=>{if(!document.body.contains(video)){stopPlayer();obs.disconnect()}});obs.observe(document.body,{childList:true,subtree:true});
}
/* مشغّل MSE: يضيف المقاطع القصيرة المستقلة تباعاً (sequence mode) ويبقى قرب الحافة الحيّة */
function livePlayer(id,info,video,cb){
  const vid=Math.random().toString(36).slice(2,12);let stopped=false,sb=null,ms=null,queue=[],started=false;
  if(!window.MediaSource||!MediaSource.isTypeSupported(info.mime)){setTimeout(()=>cb.onError('unsupported'),0);return{stop(){}}}
  ms=new MediaSource();video.src=URL.createObjectURL(ms);
  const pump=()=>{
    if(!sb||sb.updating)return;
    if(queue.length){try{sb.appendBuffer(queue.shift())}catch{}return}
    try{if(video.currentTime>40&&sb.buffered.length)sb.remove(0,video.currentTime-25)}catch{}
  };
  ms.addEventListener('sourceopen',()=>{
    try{sb=ms.addSourceBuffer(info.mime);sb.mode='sequence'}catch{cb.onError('unsupported');return}
    sb.addEventListener('updateend',()=>{
      if(!started&&sb.buffered.length){started=true;video.play().catch(()=>{});cb.onPlaying()}
      if(sb.buffered.length){const end=sb.buffered.end(sb.buffered.length-1);if(end-video.currentTime>7)video.currentTime=end-1.5}
      pump();
    });
    loop();
  },{once:true});
  async function loop(){
    let next=0;
    while(!stopped){
      let d;try{d=await api(`/api/live/${encodeURIComponent(id)}?v=${vid}`)}catch(e){if(e.code==='full')cb.onError('full');break}
      cb.onViewers(d.viewers);
      if(next===0&&d.latest>0)next=Math.max(1,d.latest-1);
      while(next>0&&next<=d.latest&&!stopped){
        const r=await fetch(`/api/live/${encodeURIComponent(id)}/seg/${next}`);
        if(r.status===404){next=d.latest;continue}
        if(!r.ok)break;
        queue.push(await r.arrayBuffer());pump();next++;
      }
      if(d.ended&&next>d.latest){cb.onEnded();break}
      await sleep(900);
    }
  }
  return{stop(){stopped=true;try{video.pause();video.removeAttribute('src');video.load()}catch{}}};
}


/* =====================================================
   3) البث من حساب صاحب القناة
   ===================================================== */
const PICK=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'];
let air=null;
function recordOnce(stream,mime,ms){return new Promise(res=>{const parts=[];let rec;try{rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1200000,audioBitsPerSecond:96000})}catch{res(null);return}
  rec.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};rec.onstop=()=>res(new Blob(parts,{type:mime}));rec.start();setTimeout(()=>{if(rec.state!=='inactive')rec.stop()},ms)})}
function openGoLive(){
  if(!me){openAuth('login');return}
  if(air){toast(t('live.already'),'info');return}
  const el=modal(`<h3><i data-lucide="radio"></i> ${esc(t('live.goTitle'))}</h3><p class="muted-p">${esc(t('live.goSub'))}</p>
   <form id="gl-form" class="pub-form" autocomplete="off">
    <label><span>${esc(t('live.fTitle'))}</span><input name="title" maxlength="120" required></label>
    <label><span>${esc(t('live.fSrc'))}</span><select name="src"><option value="cam">${esc(t('live.srcCam'))}</option><option value="screen">${esc(t('live.srcScreen'))}</option></select></label>
    <p class="muted-p pub-note">${esc(t('live.rules'))}</p>
    <div class="auth-error" id="gl-err"></div>
    <button class="primary-btn" type="submit"><i data-lucide="radio"></i><span>${esc(t('live.start'))}</span></button></form>`,{cls:'pub-card'});
  const f=el.querySelector('#gl-form'),err=el.querySelector('#gl-err');
  f.onsubmit=async e=>{e.preventDefault();err.textContent='';
    const mime=PICK.find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m));
    if(!mime||!navigator.mediaDevices){err.textContent=t('live.noBrowser');return}
    let stream;
    try{stream=f.src.value==='screen'?await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true}):await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:true})}
    catch(x){err.textContent=t('live.noAccess');return}
    let info;try{info=await api('/api/live/start','POST',{title:f.title.value,mime})}catch(x){stream.getTracks().forEach(k=>k.stop());err.textContent=x.message;return}
    closeModal();beginAir(info,stream,mime);
  };
  icons();
}
function beginAir(info,stream,mime){
  air={id:info.id,stream,stop:false,n:0,viewers:0,t0:Date.now(),chain:Promise.resolve()};
  document.body.insertAdjacentHTML('beforeend',`<div class="onair glass" id="onair"><video id="oa-prev" muted playsinline autoplay></video><div class="oa-info"><span class="live-badge">${esc(t('live.badge'))}</span><b id="oa-time">0:00</b><small id="oa-v"></small></div><button type="button" class="secondary-btn oa-stop" id="oa-stop"><i data-lucide="square"></i><span>${esc(t('live.stop'))}</span></button></div>`);
  $('#oa-prev').srcObject=stream;$('#oa-stop').onclick=endAir;icons();
  stream.getVideoTracks().forEach(k=>k.addEventListener('ended',endAir));
  toast(t('live.started'),'success');
  (async()=>{while(air&&!air.stop){const blob=await recordOnce(stream,mime,2000);if(!blob||!blob.size)continue;const s=air;if(!s)break;
    s.chain=s.chain.then(()=>fetch(`/api/live/${s.id}/seg`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:blob}).then(r=>r.json()).then(d=>{if(d.n){s.n=d.n;s.viewers=d.viewers||0}else if(d.error&&!s.stop){toast(d.error,'error');endAir()}}).catch(()=>{}))}})();
  air.timer=setInterval(()=>{if(!air)return;const sec=Math.floor((Date.now()-air.t0)/1000);const e=$('#oa-time');if(e)e.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;const v=$('#oa-v');if(v)v.textContent=t('live.viewers',{n:fmt(air.viewers)})},1000);
}
async function endAir(){
  const s=air;if(!s)return;s.stop=true;air=null;clearInterval(s.timer);s.stream.getTracks().forEach(k=>k.stop());
  const bar=$('#onair');if(bar)bar.remove();
  try{await s.chain;await api(`/api/live/${s.id}/stop`,'POST',{})}catch{}
  toast(t('live.stopped'),'info');
}
window.addEventListener('beforeunload',e=>{if(air){e.preventDefault();e.returnValue=''}});

/* ---------- فتح رابط قناة الموقع من /c/handle ---------- */
function deepLinks(){
  const p=new URLSearchParams(location.search);
  if(p.get('site')==='1'&&window.Cinema5){setTimeout(()=>{window.Cinema5.openSiteChannel();history.replaceState(null,'','/')},900)}
  if(p.get('live')){setTimeout(()=>openLive(p.get('live')),900)}
}

function init(){injectNav();watchChannel();refreshFeatures();setInterval(refreshFeatures,30000);deepLinks()}
document.addEventListener('langchange',()=>{const a=$('#nav-live span');if(a)a.textContent=t('live.nav');const b=$('#nav-customize span');if(b)b.textContent=t('cust.nav')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Cinema6={openCustomize,openLive,openLiveList,openGoLive};
})();
