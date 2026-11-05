/* لوحة الإدارة — خانة بحث داخل القائمة + إغلاقها عند اختيار أمر */
(function(){
const nav=document.querySelector('.admin-nav');if(!nav)return;
const inp=document.createElement('input');inp.className='nav-find';inp.type='search';inp.placeholder='ابحث في الأوامر…';inp.setAttribute('aria-label','بحث في الأوامر');
nav.parentNode.insertBefore(inp,nav);
const norm=s=>String(s||'').replace(/[ً-ٟ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').toLowerCase().trim();
inp.addEventListener('input',()=>{const q=norm(inp.value);nav.querySelectorAll('button').forEach(b=>b.classList.toggle('nf-hide',!!q&&!norm(b.textContent).includes(q)))});
inp.addEventListener('keydown',e=>{if(e.key==='Enter'){const b=[...nav.querySelectorAll('button:not(.nf-hide)')][0];if(b)b.click()}});
nav.addEventListener('click',e=>{if(e.target.closest('button')){inp.value='';nav.querySelectorAll('.nf-hide').forEach(b=>b.classList.remove('nf-hide'));setTimeout(()=>{try{closeSide()}catch{}},0)}});
})();
