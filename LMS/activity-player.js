// This script executes inside an opaque-origin sandbox; it has no LMS session access.
(async()=>{
 const d=document.body.dataset,loading=document.getElementById('activity-loading');
 try{
  // H5P uses storage for UI preferences. Supply frame-local memory, not LMS-origin storage.
  for(const name of ['localStorage','sessionStorage']){const values=new Map();Object.defineProperty(window,name,{value:{getItem:k=>values.has(String(k))?values.get(String(k)):null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size;}}});}
  await new H5PStandalone.H5P(document.getElementById('h5p-container'),{embedType:'div',h5pJsonPath:d.assets.replace(/\/$/,''),frameJs:d.vendor+'frame.bundle.js',frameCss:d.vendor+'styles/h5p.css',id:d.activity,xAPIObjectIRI:'urn:advancedcpe:activity:'+d.activity,reportingIsEnabled:true,frame:true,copyright:true,export:false,embed:false,assetsRequestFetchOptions:{credentials:'omit'}});
  loading.textContent='Complete the entire activity. Your completion will be saved automatically.';
  H5P.externalDispatcher.on('xAPI',event=>{
   const s=event.data?.statement,verb=s?.verb?.id?.split('/').pop();
   if(s?.object?.id!=='urn:advancedcpe:activity:'+d.activity||s?.result?.completion!==true||!['completed','answered','passed'].includes(verb))return;
   parent.postMessage({type:'acpe-activity-complete',token:d.token,activityId:d.activity,objectId:s.object.id,verb,completed:true},new URL(d.assets).origin);
  });
 }catch(e){loading.textContent='This activity could not load. Return to the lesson and reopen it, or contact Advanced CPE. '+e.message;}
})();
