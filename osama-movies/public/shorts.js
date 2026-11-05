/* Shorts: تدفق عمودي بالتمرير، تفاعل، تعليقات، مشاركة، تحميل حقيقي، ونشر */
(function(){
const $=s=>document.querySelector(s);
const feed=()=>$('#shorts-feed');
const MAX_SEC=180,MAX_MB=200;
let items=[],hasMore=true,loading=false,active=null,io=null,muted=false,viewed=new Set(),openSheet=null,started=false,pendingOpen=null;
try{muted=localStorage.getItem('osama_shorts_muted')==='1'}catch{}

async function getJSON(url,opts={}){
  const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;throw e}
  return d;
}

/* ---------- بناء البطاقة ---------- */
function cardHTML(s){
  const act=(name,icon,label,n,extra='')=>`<button type="button" class="rail-btn lg ${extra}" data-act="${name}" aria-label="${escapeHtml(label)}"><i data-lucide="${icon}"></i>${n!==null?`<span>${n}</span>`:`<span class="lbl">${escapeHtml(label)}</span>`}</button>`;
  return `<article class="short" data-id="${escapeHtml(s.id)}">
    <div class="short-inner">
      <div class="short-stage">
        <video class="short-video" loop playsinline preload="none" ${s.posterUrl?`poster="${escapeHtml(s.posterUrl)}"`:''}></video>
        <div class="short-tap"></div>
        <div class="short-flash hidden"><i data-lucide="play"></i></div>
        <div class="short-heart hidden"><i data-lucide="thumbs-up"></i></div>
        <button type="button" class="short-sound lg" data-act="sound" aria-label="${escapeHtml(t('player.mute'))}"><i data-lucide="${muted?'volume-x':'volume-2'}"></i></button>
        <div class="short-meta">
          <button type="button" class="short-author" data-act="channel" data-user="${escapeHtml(s.author.username||'')}"><span class="avatar avatar-sm">${avatarHTML(s.author)}</span><strong>${escapeHtml(s.author.name)}${vbHTML(s.author)}</strong></button>
          ${s.caption?`<p class="short-cap">${capHTML(s.caption)}</p>`:''}
          ${window.Extras2?Extras2.shortBadge(s):''}
          <small class="short-sub"><span class="sv">${escapeHtml(viewsText(s.views))}</span> · ${escapeHtml(timeAgo(s.createdAt))}</small>
        </div>
        <div class="short-prog"><i></i></div>
      </div>
      <div class="short-rail">
        ${act('like','thumbs-up',t('act.like'),fmtCompact(s.likes),s.myReaction==='like'?'on':'')}
        ${act('dislike','thumbs-down',t('act.dislike'),null,s.myReaction==='dislike'?'on':'')}
        ${act('comments','message-circle',t('cm.title'),fmtCompact(s.comments))}
        ${act('share','share-2',t('act.share'),s.shares?fmtCompact(s.shares):null)}
        ${act('download','download',t('act.download'),null)}
        ${window.Extras2?Extras2.shortRail(s,act):''}
        ${s.mine?act('delete','trash-2',t('cm.delete'),null,'danger'):act('report','flag',t('rep.report'),null)}
      </div>
    </div>
    <div class="short-sheet lg hidden" role="dialog"><div class="sheet-head"><strong>${t('cm.title')}</strong><button type="button" class="icon-btn" data-act="close-sheet" aria-label="${escapeHtml(t('common.close'))}"><i data-lucide="x"></i></button></div><div class="sheet-body"></div></div>
  </article>`;
}
function capHTML(c){return escapeHtml(c).replace(/#([\p{L}\p{N}_]{2,40})/gu,'<a class="hashtag" role="button" tabindex="0" data-act="tag" data-tag="$1">#$1</a>')}
function byId(id){return items.find(x=>x.id===id)}
function cardOf(id){return feed().querySelector(`.short[data-id="${CSS.escape(id)}"]`)}

function paintCard(card,s){
  const like=card.querySelector('[data-act=like]'),dis=card.querySelector('[data-act=dislike]');
  like.classList.toggle('on',s.myReaction==='like');dis.classList.toggle('on',s.myReaction==='dislike');
  like.querySelector('span').textContent=fmtCompact(s.likes);
  card.querySelector('[data-act=comments] span').textContent=fmtCompact(s.comments);
  const sh=card.querySelector('[data-act=share] span');sh.textContent=s.shares?fmtCompact(s.shares):t('act.share');sh.classList.toggle('lbl',!s.shares);
}

/* ---------- تحميل التدفق ---------- */
async function loadMore(first){
  if(loading||!hasMore)return;loading=true;
  try{
    const d=await getJSON(`/api/shorts?offset=${items.length}&limit=8${first?`&first=${encodeURIComponent(first)}`:''}${window.__shortsQS||''}`);
    const fresh=d.items.filter(x=>!byId(x.id));
    items.push(...fresh);hasMore=d.hasMore;
    feed().insertAdjacentHTML('beforeend',fresh.map(cardHTML).join(''));
    fresh.forEach(s=>bindCard(cardOf(s.id)));
    observeAll();icons();
  }catch(e){toast(e.message,'error')}
  finally{loading=false;$('#shorts-empty').classList.toggle('hidden',items.length>0)}
}
async function reload(first){
  stopActive();items=[];hasMore=true;feed().innerHTML='';active=null;
  await loadMore(first);
  if(first&&cardOf(first))goTo(cardOf(first),false);
}

/* ---------- التشغيل التلقائي للبطاقة الظاهرة ---------- */
function observeAll(){
  if(io)io.disconnect();
  io=new IntersectionObserver(es=>{
    for(const e of es)if(e.isIntersecting&&e.intersectionRatio>=0.7)activate(e.target);
  },{root:feed(),threshold:[0.7]});
  feed().querySelectorAll('.short').forEach(c=>io.observe(c));
}
function vid(card){return card.querySelector('video')}
function ensureSrc(card){
  const s=byId(card.dataset.id),v=vid(card);if(!s||!v)return;
  if(!v.getAttribute('src')){v.src=s.videoUrl;v.preload='metadata'}
}
function stopActive(){if(active){const v=vid(active);if(v)v.pause()}}
function activate(card){
  if(active===card)return;
  stopActive();active=card;
  ensureSrc(card);
  const all=[...feed().children],i=all.indexOf(card);
  [all[i+1],all[i-1]].forEach(c=>c&&ensureSrc(c));
  all.forEach((c,k)=>{if(Math.abs(k-i)>2){const v=vid(c);if(v&&v.getAttribute('src')){v.pause();v.removeAttribute('src');v.load()}}});
  const v=vid(card);v.muted=muted;
  v.play().catch(()=>{v.muted=true;v.play().catch(()=>{})});
  updateSound(card);
  if(i>=all.length-3)loadMore();
  const id=card.dataset.id;
  clearTimeout(activate.t);
  activate.t=setTimeout(()=>{if(active===card&&!v.paused&&!viewed.has(id)){viewed.add(id);
    fetch(`/api/shorts/${encodeURIComponent(id)}/view`,{method:'POST'}).then(r=>r.json()).then(d=>{const s=byId(id);if(s&&d.views!==undefined){s.views=d.views;const el=card.querySelector('.sv');if(el)el.textContent=viewsText(d.views)}}).catch(()=>{})}},1500);
}
function updateSound(card){
  const v=vid(card),b=card.querySelector('[data-act=sound]');if(!b)return;
  setIconIn(b,v.muted?'volume-x':'volume-2');
}
function setIconIn(btn,name){btn.innerHTML=`<i data-lucide="${name}"></i>`;icons()}
function goTo(card,smooth=true){if(card)card.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start'})}
function step(d){
  const all=[...feed().children],i=all.indexOf(active);const n=all[Math.max(0,Math.min(all.length-1,(i<0?0:i)+d))];goTo(n);
}

/* ---------- أفعال البطاقة ---------- */
function flash(card,cls){const el=card.querySelector(cls);el.classList.remove('hidden','go');void el.offsetWidth;el.classList.add('go');setTimeout(()=>el.classList.add('hidden'),700)}
async function doReact(card,value){
  const s=byId(card.dataset.id);
  const r=await Social.react('short',s.id,s.myReaction,value);
  if(r){Object.assign(s,r);paintCard(card,s)}
}
function bindCard(card){
  const s=byId(card.dataset.id),v=vid(card);
  const prog=card.querySelector('.short-prog i');
  v.addEventListener('timeupdate',()=>{if(v.duration)prog.style.width=(v.currentTime/v.duration*100)+'%'});
  v.addEventListener('loadedmetadata',()=>{card.querySelector('.short-stage').dataset.fit=v.videoWidth>v.videoHeight?'contain':'cover'});
  v.addEventListener('error',()=>{if(v.getAttribute('src'))card.querySelector('.short-meta small').textContent=t('player.error')});
  // نقر: إيقاف/تشغيل، نقر مزدوج: إعجاب
  const tap=card.querySelector('.short-tap');let last=0,tm=null;
  tap.addEventListener('click',()=>{
    const now=Date.now();
    if(now-last<320){clearTimeout(tm);last=0;flash(card,'.short-heart');if(s.myReaction!=='like')doReact(card,'like');return}
    last=now;tm=setTimeout(()=>{if(v.paused){v.play().catch(()=>{});}else{v.pause();setIconIn(card.querySelector('.short-flash'),'pause');flash(card,'.short-flash')}},300);
  });
  card.addEventListener('click',async e=>{
    const b=e.target.closest('[data-act]');if(!b)return;
    const a=b.dataset.act;
    if(a==='like')doReact(card,'like');
    else if(a==='dislike')doReact(card,'dislike');
    else if(a==='comments')openComments(card);
    else if(a==='close-sheet')closeComments();
    else if(a==='share')Social.share({type:'short',id:s.id,title:s.caption||s.author.name});
    else if(a==='download')Social.download('short',s.id);
    else if(a==='sound'){muted=!muted;try{localStorage.setItem('osama_shorts_muted',muted?'1':'0')}catch{}document.querySelectorAll('.short video').forEach(x=>x.muted=muted);updateSound(card)}
    else if(a==='delete')removeShort(card,s);
    else if(a==='report'){if(window.Extras)Extras.report('short',s.id)}
    else if(a==='channel'){if(window.Extras&&b.dataset.user)Extras.openChannel(b.dataset.user)}
    else if(a==='tag'){document.dispatchEvent(new CustomEvent('shorts:tag',{detail:b.dataset.tag}))}
  });
}
async function removeShort(card,s){
  let ok=true;
  if(window.Swal&&Swal.fire){const r=await Swal.fire({title:t('shorts.deleteConfirm'),icon:'warning',showCancelButton:true,confirmButtonText:t('cm.delete'),cancelButtonText:t('common.cancel'),confirmButtonColor:'#d94b5b'});ok=!!r.isConfirmed}
  if(!ok)return;
  try{await getJSON(`/api/shorts/${encodeURIComponent(s.id)}`,{method:'DELETE'});
    const next=card.nextElementSibling||card.previousElementSibling;
    items=items.filter(x=>x.id!==s.id);if(active===card)active=null;card.remove();toast(t('shorts.deleted'));
    if(next)goTo(next,false);$('#shorts-empty').classList.toggle('hidden',items.length>0)}
  catch(e){toast(e.message,'error')}
}

/* ---------- التعليقات (لوحة سفلية) ---------- */
function openComments(card){
  closeComments();
  const s=byId(card.dataset.id),sheet=card.querySelector('.short-sheet');
  sheet.classList.remove('hidden');card.classList.add('sheet-open');
  openSheet={card,inst:Social.createComments(sheet.querySelector('.sheet-body'),{type:'short',id:s.id,onTotal:n=>{s.comments=n;paintCard(card,s)}})};
  icons();
}
function closeComments(){
  if(!openSheet)return;
  openSheet.inst.destroy();openSheet.card.querySelector('.short-sheet').classList.add('hidden');openSheet.card.classList.remove('sheet-open');openSheet=null;
}

/* ---------- النشر ---------- */
let upFile=null,upPoster=null,upBusy=false;
function resetUpload(){
  upFile=null;upPoster=null;$('#short-form').reset();$('#short-preview').classList.add('hidden');$('#short-drop').classList.remove('hidden');
  const pv=$('#short-preview-video');pv.pause();pv.removeAttribute('src');pv.load();
  $('#short-submit').disabled=true;$('#short-error').textContent='';$('#short-progress').classList.add('hidden');$('#short-progress i').style.width='0%';
}
function openUpload(){
  if(!requireLogin())return;
  resetUpload();$('#short-modal').classList.remove('hidden');icons();
}
function closeUpload(){if(upBusy)return;$('#short-modal').classList.add('hidden');resetUpload()}
function inspectVideo(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),v=document.createElement('video');
    v.preload='metadata';v.muted=true;v.playsInline=true;v.src=url;
    const fail=()=>{URL.revokeObjectURL(url);reject(new Error(t('shorts.unreadable')))};
    v.onerror=fail;
    v.onloadedmetadata=()=>{
      const dur=v.duration;
      if(!isFinite(dur)||!v.videoWidth){fail();return}
      v.currentTime=Math.min(1,dur/2);
      v.onseeked=()=>{
        try{
          const w=Math.min(540,v.videoWidth),h=Math.round(v.videoHeight*w/v.videoWidth);
          const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);
          c.toBlob(b=>{URL.revokeObjectURL(url);resolve({duration:dur,poster:b})},'image/jpeg',0.8);
        }catch{URL.revokeObjectURL(url);resolve({duration:dur,poster:null})}
      };
    };
  });
}
async function pickFile(file){
  const err=$('#short-error');err.textContent='';
  if(!file)return;
  if(!/^video\/(mp4|webm|quicktime)$/.test(file.type)){err.textContent=t('shorts.badType');return}
  if(file.size>MAX_MB*1024*1024){err.textContent=t('shorts.tooBig',{n:MAX_MB});return}
  try{
    const info=await inspectVideo(file);
    if(info.duration>MAX_SEC){err.textContent=t('shorts.tooLong',{n:MAX_SEC/60});return}
    upFile=file;upPoster=info.poster;
    const pv=$('#short-preview-video');pv.src=URL.createObjectURL(file);
    $('#short-preview').classList.remove('hidden');$('#short-drop').classList.add('hidden');$('#short-submit').disabled=false;
  }catch(e){err.textContent=e.message}
}
function submitUpload(e){
  e.preventDefault();if(!upFile||upBusy)return;
  const fd=new FormData();fd.append('caption',$('#short-caption').value.trim());fd.append('video',upFile,upFile.name);
  if(upPoster)fd.append('poster',upPoster,'poster.jpg');
  upBusy=true;$('#short-submit').disabled=true;$('#short-error').textContent='';$('#short-progress').classList.remove('hidden');
  const x=new XMLHttpRequest();x.open('POST','/api/shorts');x.setRequestHeader('X-Lang',I18N.lang());
  x.upload.onprogress=ev=>{if(ev.lengthComputable){const p=Math.round(ev.loaded/ev.total*100);$('#short-progress i').style.width=p+'%';$('#short-progress-n').textContent=p+'%'}};
  x.onload=async()=>{
    upBusy=false;let d={};try{d=JSON.parse(x.responseText)}catch{}
    if(x.status===201){$('#short-modal').classList.add('hidden');resetUpload();toast(t('shorts.published'));switchTab('shorts');await reload(d.id)}
    else{$('#short-error').textContent=d.error||t('err.generic');$('#short-submit').disabled=false;$('#short-progress').classList.add('hidden')}
  };
  x.onerror=()=>{upBusy=false;$('#short-error').textContent=t('err.network');$('#short-submit').disabled=false;$('#short-progress').classList.add('hidden')};
  x.send(fd);
}

/* ---------- ربط عام ---------- */
async function enter(){
  if(!started){started=true;await loadMore(pendingOpen);if(pendingOpen&&cardOf(pendingOpen))goTo(cardOf(pendingOpen),false);pendingOpen=null}
  else if(active){const v=vid(active);v.muted=muted;v.play().catch(()=>{})}
}
function init(){
  $('#shorts-upload').onclick=openUpload;$('#shorts-empty-upload').onclick=openUpload;
  $('#short-close').onclick=closeUpload;$('#short-modal').onclick=e=>{if(e.target.id==='short-modal')closeUpload()};
  $('#short-file').onchange=e=>pickFile(e.target.files[0]);
  $('#short-drop').addEventListener('dragover',e=>{e.preventDefault()});
  $('#short-drop').addEventListener('drop',e=>{e.preventDefault();pickFile(e.dataTransfer.files[0])});
  $('#short-form').onsubmit=submitUpload;
  $('#shorts-prev').onclick=()=>step(-1);$('#shorts-next').onclick=()=>step(1);
  document.addEventListener('tabchange',e=>{
    if(e.detail==='shorts')enter();else{stopActive();closeComments()}
  });
  document.addEventListener('shorts:filter',e=>{window.__shortsQS=e.detail||'';if(started)reload();});
  document.addEventListener('shorts:open',e=>{pendingOpen=e.detail;if(started){reload(pendingOpen);pendingOpen=null}});
  document.addEventListener('auth:changed',()=>{if(started){const id=active&&active.dataset.id;reload(id)}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopActive();else if(active&&!$('#shorts-view').classList.contains('hidden'))vid(active).play().catch(()=>{})});
  document.addEventListener('social:updated',e=>{const d=e.detail;if(d.type!=='short')return;const s=byId(d.id);if(s){Object.assign(s,d.summary);const c=cardOf(d.id);if(c)paintCard(c,s)}});
  document.addEventListener('langchange',()=>{if(started){const id=active&&active.dataset.id;reload(id)}});
  document.addEventListener('keydown',e=>{
    if($('#shorts-view').classList.contains('hidden'))return;
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.querySelector('.modal:not(.hidden)'))return;
    if(e.key==='ArrowDown'||e.key==='j'){step(1);e.preventDefault()}
    else if(e.key==='ArrowUp'||e.key==='k'){step(-1);e.preventDefault()}
    else if(e.key===' '&&active){const v=vid(active);v.paused?v.play():v.pause();e.preventDefault()}
    else if(e.key==='m'&&active){muted=!muted;document.querySelectorAll('.short video').forEach(x=>x.muted=muted);updateSound(active)}
    else if(e.key==='Escape')closeComments();
  });
}
document.addEventListener('DOMContentLoaded',init);
})();
