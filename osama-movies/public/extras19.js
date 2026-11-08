/* v20 — extras19: Media Session (أزرار قفل الشاشة/الإشعارات + الملصق) • Wake Lock (لا تنطفئ الشاشة أثناء المشاهدة).
   تدريجية: إن لم يدعمها المتصفح لا يحدث شيء. (التالي التلقائي ولوحة الاختصارات موجودتان أصلاً في extras سابقة.) */
(()=>{const v=document.getElementById('video');if(!v)return;
const cur=()=>{try{return typeof currentMovie!=='undefined'?currentMovie:null}catch{return null}};
const abs=u=>{try{return new URL(u,location.origin).href}catch{return ''}};
/* 1) Media Session */
const ms=navigator.mediaSession;
function meta(){const m=cur();if(!ms||!m||typeof MediaMetadata==='undefined')return;
 try{ms.metadata=new MediaMetadata({title:String(m.title||''),artist:'Cineo',album:Array.isArray(m.genre)?m.genre.join(' · '):String(m.category||m.genre||''),artwork:m.posterUrl?[{src:abs(m.posterUrl),sizes:'512x512'}]:[]})}catch{}}
if(ms){const h=(a,f)=>{try{ms.setActionHandler(a,f)}catch{}};
 h('play',()=>v.play().catch(()=>{}));h('pause',()=>v.pause());
 h('seekbackward',d=>{v.currentTime=Math.max(0,v.currentTime-((d&&d.seekOffset)||10))});
 h('seekforward',d=>{v.currentTime=Math.min(v.duration||1e9,v.currentTime+((d&&d.seekOffset)||10))});
 h('seekto',d=>{if(d&&typeof d.seekTime==='number')v.currentTime=d.seekTime});
 let last=0;const pos=()=>{const n=Date.now();if(n-last<1000||!isFinite(v.duration)||!v.duration)return;last=n;try{ms.setPositionState({duration:v.duration,playbackRate:v.playbackRate||1,position:Math.min(v.currentTime,v.duration)})}catch{}};
 v.addEventListener('timeupdate',pos);v.addEventListener('loadedmetadata',meta);v.addEventListener('play',()=>{meta();try{ms.playbackState='playing'}catch{}});
 v.addEventListener('pause',()=>{try{ms.playbackState='paused'}catch{}});v.addEventListener('emptied',()=>{try{ms.metadata=null;ms.playbackState='none'}catch{}})}
/* 2) Wake Lock: لا تنطفئ الشاشة أثناء المشاهدة */
let lock=null;
async function acquire(){if(!('wakeLock' in navigator)||lock||v.paused||document.hidden)return;try{lock=await navigator.wakeLock.request('screen');lock.addEventListener&&lock.addEventListener('release',()=>{lock=null})}catch{lock=null}}
function release(){try{lock&&lock.release&&lock.release()}catch{}lock=null}
v.addEventListener('play',acquire);v.addEventListener('pause',release);v.addEventListener('ended',release);v.addEventListener('emptied',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden)release();else acquire()});
})();
