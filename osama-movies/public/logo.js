/* شعار سينما أسامة: أيقونة SVG بدل الأيقونة العامة (يحتفظ بالنصوص والترجمة كما هي) */
(function(){
const SVG='<svg class="osama-logo" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="og@" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3b82f6"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient><linearGradient id="oy@" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="1" stop-color="#ffb347"/></linearGradient><radialGradient id="oh@" cx=".3" cy=".18" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect x="2" y="2" width="60" height="60" rx="18" fill="url(#og@)"/><rect x="2" y="2" width="60" height="60" rx="18" fill="url(#oh@)"/><g transform="translate(32 33)"><circle r="22" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".95" stroke-width="2.6"/><g fill="#fff"><circle cy="-15.5" r="3.7"/><circle cx="13.4" cy="-7.75" r="3.7"/><circle cx="13.4" cy="7.75" r="3.7"/><circle cy="15.5" r="3.7"/><circle cx="-13.4" cy="7.75" r="3.7"/><circle cx="-13.4" cy="-7.75" r="3.7"/></g><path d="M-4.6-6.4L7.4 0-4.6 6.4Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></g><path d="M51 7.5l1.9 4.6 4.6 1.9-4.6 1.9L51 20.5l-1.9-4.6-4.6-1.9 4.6-1.9z" fill="url(#oy@)"/></svg>';
let n=0;
function apply(){
  document.querySelectorAll('.brand .brand-icon,.brand-compact .brand-icon').forEach(el=>{
    if(el.querySelector('.osama-logo'))return;
    el.classList.add('has-logo');el.innerHTML=SVG.replace(/@/g,'_'+(++n));
  });
  document.querySelectorAll('.brand strong,.brand-compact strong').forEach(s=>s.classList.add('brand-name'));
  document.querySelectorAll('.brand small').forEach(s=>s.classList.add('brand-tag'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
document.addEventListener('langchange',apply);
})();
