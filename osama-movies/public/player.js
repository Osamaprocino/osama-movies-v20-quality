/* مشغّل المشاهدة: زجاج سائل + تقديم/ترجيع 10ث + السرعة + تحميل + ترجمة فورية */
(function(){
const $=s=>document.querySelector(s);
const video=()=>$('#video');
const LS={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const RATES=[0.5,0.75,1,1.25,1.5,1.75,2];
const TR_LANGS=[['ar','العربية'],['en','English'],['ru','Русский'],['tr','Türkçe'],['fr','Français'],['de','Deutsch'],['es','Español']];

let movie=null,hideTimer=null,lastTap=0,tapTimer=null,pseudoFs=false;
const S={tracks:[],track:null,target:LS.get('osama_tr_lang',''),cues:[],tr:{},status:'',busy:0,gen:0};

function fmtTime(s){s=Math.max(0,Math.floor(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')}
function ico(btn,name){btn.innerHTML=`<i data-lucide="${name}"></i>`+(btn.querySelector('b')?'':'');icons()}
function setIcon(btn,name){const b=btn.querySelector('b');btn.innerHTML=`<i data-lucide="${name}"></i>`+(b?b.outerHTML:'');icons()}

/* ---------- الواجهة العامة ---------- */
function setMovie(m){
  movie=m;S.gen++;S.tracks=(m.subtitles||[]).slice();S.track=null;S.cues=[];S.tr={};S.status='';
  $('#pl-caption').textContent='';$('#pl-caption').classList.remove('on');
  closeMenus();showUI();updatePlayIcon();
  const v=video();v.playbackRate=Number(LS.get('osama_rate','1'))||1;v.volume=Number(LS.get('osama_vol','1'));v.muted=LS.get('osama_muted','0')==='1';
  updateRate();updateVolIcon();$('#pl-volume').value=v.muted?0:v.volume;
  $('#pl-fill').style.width='0%';$('#pl-buf').style.width='0%';$('#pl-knob').style.insetInlineStart='0%';$('#pl-time').textContent='0:00 / 0:00';
  buildCC();
}
function unlocked(m){
  // اختيار مسار تلقائي إذا كان المستخدم قد فعّل الترجمة سابقاً
  if(LS.get('osama_cc_on','0')==='1'&&S.tracks.length&&!S.track)selectTrack(S.tracks[0].id);
}
function locked(){video().pause();closeMenus()}

/* ---------- التشغيل ---------- */
function toggle(){const v=video();if(v.paused)v.play().catch(()=>{});else v.pause()}
function updatePlayIcon(){
  const v=video(),p=v.paused;
  setIcon($('#pl-play'),p?'play':'pause');setIcon($('#pl-big'),'play');
  $('#pl').classList.toggle('paused',p);$('#pl-big').classList.toggle('hidden',!p||v.seeking&&false);
  $('#pl-play').setAttribute('aria-label',t(p?'player.play':'player.pause'));
}
function skip(d){
  const v=video();if(!isFinite(v.duration))return;
  v.currentTime=Math.min(v.duration,Math.max(0,v.currentTime+d));
  const tap=$(d<0?'#pl-tap-back':'#pl-tap-fwd');tap.classList.remove('flash');void tap.offsetWidth;tap.classList.add('flash');
  say((d>0?'+':'−')+Math.abs(d)+' '+t('player.sec'));
}
let toastT=null;
function say(msg){const el=$('#pl-toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.add('hidden'),900)}

/* ---------- إظهار/إخفاء الأزرار ---------- */
function showUI(){
  const pl=$('#pl');pl.classList.remove('ui-hidden');clearTimeout(hideTimer);
  hideTimer=setTimeout(()=>{if(!video().paused&&!pl.querySelector('.pl-menu:not(.hidden)'))pl.classList.add('ui-hidden')},3200);
}

/* ---------- شريط التقدم ---------- */
function seekFromEvent(e){
  const r=$('#pl-seek').getBoundingClientRect();
  return Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
}
function initSeek(){
  const el=$('#pl-seek'),tip=$('#pl-tip');let drag=false;
  const move=e=>{const f=seekFromEvent(e);const v=video();if(isFinite(v.duration)){tip.textContent=fmtTime(f*v.duration);tip.style.left=(f*100)+'%';tip.classList.remove('hidden');if(drag){v.currentTime=f*v.duration;paintProgress()}}};
  el.addEventListener('pointerdown',e=>{drag=true;el.setPointerCapture(e.pointerId);el.classList.add('drag');move(e)});
  el.addEventListener('pointermove',move);
  el.addEventListener('pointerup',e=>{drag=false;el.classList.remove('drag');try{el.releasePointerCapture(e.pointerId)}catch{}});
  el.addEventListener('pointerleave',()=>{if(!drag)tip.classList.add('hidden')});
  el.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){skip(-5);e.preventDefault()}else if(e.key==='ArrowRight'){skip(5);e.preventDefault()}});
}
function paintProgress(){
  const v=video(),d=v.duration;if(!isFinite(d)||!d)return;
  const f=v.currentTime/d*100;
  $('#pl-fill').style.width=f+'%';$('#pl-knob').style.left=f+'%';
  $('#pl-time').textContent=fmtTime(v.currentTime)+' / '+fmtTime(d);
  $('#pl-seek').setAttribute('aria-valuenow',Math.round(f));
  if(v.buffered.length){let end=0;for(let i=0;i<v.buffered.length;i++)if(v.buffered.start(i)<=v.currentTime+0.5)end=Math.max(end,v.buffered.end(i));$('#pl-buf').style.width=(end/d*100)+'%'}
}

/* ---------- الصوت والسرعة ---------- */
function updateVolIcon(){const v=video();const n=v.muted||v.volume===0?'volume-x':v.volume<0.5?'volume-1':'volume-2';setIcon($('#pl-mute'),n)}
function updateRate(){const r=video().playbackRate;$('#pl-speed-btn').textContent=(r===1?'1':String(r))+'×'}
function setRate(r){video().playbackRate=r;LS.set('osama_rate',String(r));updateRate();buildSpeed();say(r+'×')}
function buildSpeed(){
  const m=$('#pl-menu-speed'),cur=video().playbackRate;
  m.innerHTML=`<div class="pl-menu-h">${t('player.speed')}</div>`+RATES.map(r=>`<button type="button" role="menuitemradio" aria-checked="${r===cur}" class="${r===cur?'on':''}" data-rate="${r}"><span>${r===1?t('player.normal'):r+'×'}</span><i data-lucide="check"></i></button>`).join('');
  m.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{setRate(Number(b.dataset.rate));closeMenus()});icons();
}
function closeMenus(){document.querySelectorAll('.pl-menu').forEach(m=>m.classList.add('hidden'))}
function toggleMenu(id){
  const m=$(id),was=!m.classList.contains('hidden');closeMenus();
  if(!was){if(id==='#pl-menu-speed')buildSpeed();else buildCC();m.classList.remove('hidden');icons()}
  showUI();
}

/* ---------- ملء الشاشة / نافذة عائمة ---------- */
function isFs(){return !!document.fullscreenElement||pseudoFs}
async function toggleFs(){
  const pl=$('#pl');
  if(isFs()){
    if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
    pseudoFs=false;pl.classList.remove('pseudo-fs');document.body.classList.remove('no-scroll');
    try{screen.orientation&&screen.orientation.unlock&&screen.orientation.unlock()}catch{}
  }else if(pl.requestFullscreen){
    try{await pl.requestFullscreen({navigationUI:'hide'});try{await screen.orientation.lock('landscape')}catch{}}catch{pseudoFs=true;pl.classList.add('pseudo-fs');document.body.classList.add('no-scroll')}
  }else{pseudoFs=true;pl.classList.add('pseudo-fs');document.body.classList.add('no-scroll')}
  updateFsIcon();
}
function updateFsIcon(){setIcon($('#pl-fs'),isFs()?'minimize':'maximize');$('#pl').classList.toggle('is-fs',isFs())}
async function togglePip(){
  const v=video();
  try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await v.requestPictureInPicture()}catch{toast(t('player.pipFail'),'error')}
}

/* =====================================================
   الترجمة (Subtitles) + الترجمة الفورية (Translate)
   ===================================================== */
function parseTime(str){const m=String(str).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);if(!m)return null;return Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3])+(m[4]?Number(m[4].padEnd(3,'0')):0)/1000}
function parseSubs(text){
  text=text.replace(/\r\n?/g,'\n').replace(/^﻿/,'');const cues=[];
  for(const block of text.split(/\n{2,}/)){
    const lines=block.split('\n');const i=lines.findIndex(l=>l.includes('-->'));if(i<0)continue;
    const [a,rest]=lines[i].split('-->');const s=parseTime(a),e=parseTime(String(rest||'').trim().split(/\s+/)[0]);if(s===null||e===null||e<=s)continue;
    const tx=lines.slice(i+1).join('\n').replace(/\{\\[^}]*\}/g,'').replace(/<\/?[a-z][^>]*>/gi,'').replace(/&nbsp;/g,' ').split('\n').map(l=>l.trim()).filter(Boolean).join('\n');
    if(tx)cues.push({s,e,t:tx});
  }
  return cues.sort((x,y)=>x.s-y.s);
}
function decodeBuf(buf){
  let txt=new TextDecoder('utf-8').decode(buf);if(!txt.includes('�'))return txt;
  let best=txt,bs=-1;
  for(const [enc,re] of [['windows-1256',/[ء-ي]/g],['windows-1251',/[а-яА-Я]/g]]){try{const s=new TextDecoder(enc).decode(buf);const c=(s.match(re)||[]).length;if(c>bs){bs=c;best=s}}catch{}}
  return best;
}
function targetLang(){return S.target==='off'?'':(S.target||I18N.lang())}
function activeSourceLang(){return S.track?S.track.lang:'und'}
function needTranslate(){const tl=targetLang();return !!tl&&!!S.track&&tl!==activeSourceLang()}

async function selectTrack(id){
  S.gen++;S.tr={};S.status='';
  if(!id){S.track=null;S.cues=[];$('#pl-caption').classList.remove('on');LS.set('osama_cc_on','0');buildCC();return}
  const tr=S.tracks.find(x=>x.id===id);if(!tr)return;
  S.track=tr;LS.set('osama_cc_on','1');
  if(!tr.cues){
    S.status=t('cc.loading');buildCC();
    try{const r=await fetch(`/api/movies/${encodeURIComponent(movie.id)}/subtitles/${encodeURIComponent(id)}`);const d=await r.json();if(!r.ok)throw new Error(d.error);tr.cues=d.cues}
    catch(e){toast(e.message||t('err.generic'),'error');S.track=null;S.status='';buildCC();return}
  }
  S.cues=tr.cues;S.status='';buildCC();renderCue(true);pump();
}
function loadLocal(file){
  const rd=new FileReader();
  rd.onload=()=>{
    const cues=parseSubs(decodeBuf(new Uint8Array(rd.result)));
    if(!cues.length){toast(t('cc.badFile'),'error');return}
    const id='local-'+Date.now();
    S.tracks.push({id,lang:'und',label:file.name.replace(/\.(srt|vtt)$/i,'').slice(0,28),cues,local:true});
    selectTrack(id);toast(t('cc.loaded'));
  };
  rd.readAsArrayBuffer(file);
}

/* بحث ثنائي عن المقطع الحالي */
function cueAt(time){
  const c=S.cues;let lo=0,hi=c.length-1,found=-1;
  while(lo<=hi){const mid=(lo+hi)>>1;if(c[mid].s<=time){found=mid;lo=mid+1}else hi=mid-1}
  // قد تتداخل المقاطع: نتحقق من الأخيرة والتي قبلها
  for(let i=found;i>=0&&i>found-3;i--)if(time<c[i].e)return i;
  return -1;
}
let lastIdx=-2,lastTarget='';
function renderCue(force){
  const cap=$('#pl-caption');
  if(!S.track||!S.cues.length){if(cap.classList.contains('on')){cap.classList.remove('on');cap.textContent=''}return}
  const idx=cueAt(video().currentTime);
  const key=idx+'|'+(needTranslate()?targetLang():'');
  if(!force&&idx===lastIdx&&key===lastTarget)return;
  lastIdx=idx;lastTarget=key;
  if(idx<0){cap.classList.remove('on');cap.textContent='';cap.dataset.orig='';return}
  const orig=S.cues[idx].t;
  const tx=needTranslate()?(S.tr[targetLang()]||{})[idx]:undefined;
  cap.textContent=tx!==undefined?tx:orig;cap.classList.add('on');
  cap.dataset.orig=orig.replace(/\s*\n\s*/g,' ');cap.dataset.tr=(tx!==undefined&&tx!==orig)?'1':'0';
  cap.classList.toggle('pending',needTranslate()&&tx===undefined);
  if(needTranslate()&&tx===undefined)pump();
}

/* ترجمة الأسطر على دفعات، الأقرب إلى موضع التشغيل أولاً */
const CHUNK=30;
async function pump(){
  if(!needTranslate()||S.busy>=2)return;
  const lang=targetLang(),gen=S.gen;
  const store=S.tr[lang]||(S.tr[lang]={});
  const n=S.cues.length;if(!n)return;
  const cur=Math.max(0,cueAt(video().currentTime)),startChunk=Math.floor(cur/CHUNK);
  const chunks=Math.ceil(n/CHUNK);
  S.pending=S.pending||new Set();
  let pick=-1;
  for(let k=0;k<chunks;k++){
    const c=(startChunk+k)%chunks;
    if(S.pending.has(lang+c))continue;
    let done=true;for(let i=c*CHUNK;i<Math.min(n,(c+1)*CHUNK);i++)if(store[i]===undefined){done=false;break}
    if(!done){pick=c;break}
  }
  if(pick<0){S.status=t('cc.done');updateCCStatus();return}
  S.busy++;S.pending.add(lang+pick);
  const from=pick*CHUNK,to=Math.min(n,from+CHUNK);
  const texts=S.cues.slice(from,to).map(c=>c.t.replace(/\s*\n\s*/g,' ').slice(0,500));
  const srcLang=S.track&&S.track.lang!=='und'?S.track.lang:'auto';
  try{
    const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts,to:lang,from:srcLang})});
    const d=await r.json().catch(()=>({}));
    if(gen!==S.gen)return;
    if(!r.ok)throw new Error(d.error||t('cc.fail'));
    d.translations.forEach((tx,i)=>{store[from+i]=tx||S.cues[from+i].t});
    const have=Object.keys(store).length;S.status=t('cc.translating',{p:Math.min(100,Math.round(have/n*100))});updateCCStatus();
    lastIdx=-2;renderCue(true);
  }catch(e){
    if(gen===S.gen){S.status=t('cc.fail');updateCCStatus();if(!S.warned){S.warned=true;toast(e.message||t('cc.fail'),'error')}}
    S.busy--;S.pending.delete(lang+pick);return;
  }
  S.busy--;S.pending.delete(lang+pick);
  if(gen===S.gen)pump();
}
function updateCCStatus(){const el=document.querySelector('#pl-menu-cc .cc-status');if(el)el.textContent=S.status}

function buildCC(){
  const m=$('#pl-menu-cc');if(!m)return;
  const tl=S.target===''?I18N.lang():S.target;
  const trk=S.tracks.map(x=>`<button type="button" role="menuitemradio" class="${S.track&&S.track.id===x.id?'on':''}" data-track="${escapeHtml(x.id)}"><span>${escapeHtml(x.label)}</span><i data-lucide="check"></i></button>`).join('');
  m.innerHTML=`
    <div class="pl-menu-h">${t('cc.subtitles')}</div>
    <button type="button" role="menuitemradio" class="${!S.track?'on':''}" data-track=""><span>${t('cc.off')}</span><i data-lucide="check"></i></button>
    ${trk}
    <button type="button" data-local><span><i data-lucide="upload"></i> ${t('cc.loadFile')}</span></button>
    ${S.tracks.length?'':`<p class="cc-note">${t('cc.none')}</p>`}
    <div class="pl-menu-h">${t('cc.translateTo')}</div>
    <button type="button" role="menuitemradio" class="${S.target==='off'?'on':''}" data-tl="off"><span>${t('cc.noTranslate')}</span><i data-lucide="check"></i></button>
    ${TR_LANGS.map(([c,n])=>`<button type="button" role="menuitemradio" class="${S.target!=='off'&&tl===c?'on':''}" data-tl="${c}"><span>${n}</span><i data-lucide="check"></i></button>`).join('')}
    <div class="cc-status">${escapeHtml(S.status||'')}</div>`;
  m.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>{selectTrack(b.dataset.track);});
  m.querySelectorAll('[data-tl]').forEach(b=>b.onclick=()=>{
    S.target=b.dataset.tl;LS.set('osama_tr_lang',S.target);S.warned=false;S.gen++;S.pending=new Set();S.busy=0;
    S.status=needTranslate()?t('cc.translating',{p:0}):'';buildCC();lastIdx=-2;renderCue(true);pump();
  });
  m.querySelector('[data-local]').onclick=()=>$('#pl-sub-file').click();
  icons();
}

/* ---------- الربط ---------- */
function init(){
  const v=video(),pl=$('#pl');
  v.controls=false;
  initSeek();
  v.addEventListener('play',()=>{updatePlayIcon();showUI()});
  v.addEventListener('pause',()=>{updatePlayIcon();showUI()});
  v.addEventListener('timeupdate',()=>{paintProgress();renderCue()});
  v.addEventListener('progress',paintProgress);v.addEventListener('loadedmetadata',paintProgress);
  v.addEventListener('seeked',()=>{renderCue(true)});
  v.addEventListener('waiting',()=>$('#pl-spinner').classList.remove('hidden'));
  ['playing','canplay','seeked','pause'].forEach(ev=>v.addEventListener(ev,()=>$('#pl-spinner').classList.add('hidden')));
  v.addEventListener('volumechange',()=>{updateVolIcon();LS.set('osama_vol',String(v.volume));LS.set('osama_muted',v.muted?'1':'0');if(document.activeElement!==$('#pl-volume'))$('#pl-volume').value=v.muted?0:v.volume});
  v.addEventListener('ratechange',()=>{updateRate()});
  v.addEventListener('error',()=>{if(v.getAttribute('src'))say(t('player.error'))});
  v.addEventListener('ended',()=>{updatePlayIcon();pl.classList.remove('ui-hidden')});

  $('#pl-play').onclick=toggle;$('#pl-big').onclick=e=>{e.stopPropagation();toggle()};
  $('#pl-back10').onclick=()=>skip(-10);$('#pl-fwd10').onclick=()=>skip(10);
  $('#pl-mute').onclick=()=>{v.muted=!v.muted;if(!v.muted&&v.volume===0)v.volume=.6};
  $('#pl-volume').oninput=e=>{v.volume=Number(e.target.value);v.muted=Number(e.target.value)===0};
  $('#pl-speed-btn').onclick=e=>{e.stopPropagation();toggleMenu('#pl-menu-speed')};
  $('#pl-cc-btn').onclick=e=>{e.stopPropagation();toggleMenu('#pl-menu-cc')};
  $('#pl-fs').onclick=toggleFs;
  if(document.pictureInPictureEnabled)$('#pl-pip').onclick=togglePip;else $('#pl-pip').classList.add('hidden');
  $('#pl-dl').onclick=()=>{if(movie)Social.download('movie',movie.id)};
  $('#pl-sub-file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)loadLocal(f)};
  document.addEventListener('fullscreenchange',updateFsIcon);
  document.querySelectorAll('.pl-menu').forEach(m=>m.addEventListener('click',e=>e.stopPropagation()));
  document.addEventListener('click',e=>{if(!e.target.closest('.pl-menu')&&!e.target.closest('.pl-btn'))closeMenus()});

  // لمس/نقر على المشهد: نقر مزدوج = ±10ث، نقر واحد = تشغيل/إيقاف (ماوس) أو إظهار الأزرار (لمس)
  pl.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')showUI()});
  pl.addEventListener('pointerup',e=>{
    if(e.target.closest('.pl-ui')||e.target.closest('.pl-big'))return;
    const r=pl.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,now=Date.now();
    const zone=x<0.35?-1:x>0.65?1:0;
    if(now-lastTap<300&&zone!==0){clearTimeout(tapTimer);lastTap=0;skip(zone*10);showUI();return}
    lastTap=now;clearTimeout(tapTimer);
    tapTimer=setTimeout(()=>{
      if(e.pointerType==='mouse')toggle();
      else{if(pl.classList.contains('ui-hidden'))showUI();else{closeMenus();pl.classList.add('ui-hidden')}}
    },250);
  });
  pl.addEventListener('dblclick',e=>{if(e.target.closest('.pl-ui'))return;const r=pl.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;if(x>=0.35&&x<=0.65)toggleFs()});

  // اختصارات لوحة المفاتيح (فقط في صفحة المشاهدة)
  document.addEventListener('keydown',e=>{
    if($('#player-view').classList.contains('hidden'))return;
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&document.activeElement.id!=='pl-volume')return;
    if(document.activeElement.closest&&document.activeElement.closest('.modal'))return;
    const k=e.key.toLowerCase();let used=true;
    if(k===' '||k==='k')toggle();
    else if(k==='arrowleft'||k==='j')skip(-10);
    else if(k==='arrowright'||k==='l')skip(10);
    else if(k==='arrowup'){v.volume=Math.min(1,v.volume+.05);v.muted=false}
    else if(k==='arrowdown')v.volume=Math.max(0,v.volume-.05);
    else if(k==='m')v.muted=!v.muted;
    else if(k==='f')toggleFs();
    else if(k==='c')toggleMenu('#pl-menu-cc');
    else if(e.key==='>'){const i=RATES.indexOf(v.playbackRate);setRate(RATES[Math.min(RATES.length-1,(i<0?2:i)+1)])}
    else if(e.key==='<'){const i=RATES.indexOf(v.playbackRate);setRate(RATES[Math.max(0,(i<0?2:i)-1)])}
    else if(k==='escape'&&pseudoFs)toggleFs();
    else used=false;
    if(used){e.preventDefault();showUI()}
  });
  document.addEventListener('tabchange',e=>{if(e.detail!=='player'){v.pause();if(isFs())toggleFs()}});
  document.addEventListener('langchange',()=>{buildCC();buildSpeed();updatePlayIcon()});
  buildSpeed();
}
document.addEventListener('DOMContentLoaded',init);
window.WatchPlayer={setMovie,unlocked,locked};
})();
