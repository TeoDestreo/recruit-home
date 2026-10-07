// Shared header: shows Log in / Create account or My account / Admin / Sign out, and marks the current section.
(()=>{
 const nav=document.querySelector('.acpe-nav');if(!nav)return;
 const here=location.pathname;
 for(const a of nav.querySelectorAll('.acpe-links a:not([data-signed-out])')){const path=a.getAttribute('href').split('?')[0];if(path==='/LMS/'?/^\/LMS\/(index\.html)?$/.test(here):here.startsWith(path.replace(/\.html$/,'')))a.setAttribute('aria-current','page');}
 function set(user){for(const e of nav.querySelectorAll('[data-signed-in]'))e.hidden=!user;for(const e of nav.querySelectorAll('[data-signed-out]'))e.hidden=!!user;for(const e of nav.querySelectorAll('[data-admin]'))e.hidden=!user?.admin;const account=nav.querySelector('a[href="/LMS/account"]');if(account)account.title=user?user.name+' · profile, membership and receipts':'';}
 nav.querySelector('[data-signout]').addEventListener('click',async()=>{if(window.acpeSignOut)return window.acpeSignOut();try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});}catch{}location.href='/LMS/';});
 window.acpeNavSet=set;
 fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>set(d?.user||null)).catch(()=>{});
})();
