// "Install app" button: native prompt where the browser offers one, Add to Home Screen steps on iPhone/iPad.
(()=>{
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
 if(standalone)return;
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 let deferred=null,button=null,help=null;
 function showHelp(){
  if(!help){
   help=document.createElement('div');help.className='install-help';help.setAttribute('role','dialog');help.setAttribute('aria-modal','true');help.setAttribute('aria-labelledby','install-help-title');
   help.innerHTML='<div class="install-help-card"><h2 id="install-help-title">Add Advanced CPE to your Home Screen</h2><ol><li>Tap the <b>Share</b> button <span aria-hidden="true">(the square with an arrow pointing up)</span>.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol><p>It opens full screen, like an app.</p><button type="button" class="install-help-close">Got it</button></div>';
   help.addEventListener('click',e=>{if(e.target===help||e.target.closest('.install-help-close'))closeHelp();});
   addEventListener('keydown',e=>{if(e.key==='Escape'&&help&&!help.hidden)closeHelp();});
   document.body.append(help);
  }
  help.hidden=false;help.querySelector('button').focus();
 }
 function closeHelp(){help.hidden=true;button?.focus();}
 function addButton(){
  if(button)return;
  const nav=document.querySelector('header nav>div')||document.querySelector('header nav')||document.querySelector('header');
  if(!nav)return;
  button=document.createElement('button');button.type='button';button.className='install-app';button.textContent='Install app';
  button.addEventListener('click',async()=>{
   if(deferred){const prompt=deferred;deferred=null;prompt.prompt();const {outcome}=await prompt.userChoice;if(outcome==='accepted')button.remove();}
   else showHelp();
  });
  nav.append(button);
 }
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;document.readyState==='loading'?document.addEventListener('DOMContentLoaded',addButton):addButton();});
 addEventListener('appinstalled',()=>{button?.remove();button=null;});
 if(ios)document.readyState==='loading'?document.addEventListener('DOMContentLoaded',addButton):addButton();
})();
