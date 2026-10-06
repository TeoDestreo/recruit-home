const el=id=>document.getElementById(id);
el('print').onclick=()=>window.print();
(async()=>{
  try{
    const id=new URLSearchParams(location.search).get('id');
    if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('This certificate link is invalid.');
    const response=await fetch(`/api/certificates/${id}`,{credentials:'same-origin'}),data=await response.json();
    if(response.status===401)throw Error('Please sign in from the learning library to view this certificate.');
    if(!response.ok)throw Error(data.error||'Unable to load certificate.');
    const c=data.certificate;
    el('learner').textContent=c.learner_name;el('course').textContent=c.course_title;
    el('completed').textContent=new Date(c.completed_at.replace(' ','T')+'Z').toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
    el('certificate-id').textContent=c.id;
    document.title=`Certificate - ${c.course_title} - Advanced CPE`;
    el('message').hidden=true;el('certificate').hidden=false;el('print').hidden=false;
  }catch(e){el('message').textContent=e.message;}
})();
