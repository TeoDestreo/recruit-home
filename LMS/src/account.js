const json=v=>Response.json(v,{headers:{'Cache-Control':'private, no-store'}});
const fields={first_name:50,last_name:50,organization:150,job_title:100,city:100,region:100,country:100,phone:40,designation:100,license_number:80,license_region:100};
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
export async function accountRoute(request,env,user){
 if(request.method==='POST'){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'JSON required.');
  const raw=await request.text();if(raw.length>8192)fail(413,'Profile is too large.');let d;try{d=JSON.parse(raw);}catch{fail(400,'Invalid profile.');}if(!d||typeof d!=='object'||Array.isArray(d))fail(400,'Invalid profile.');
  const values={};for(const [key,max] of Object.entries(fields)){if(typeof d[key]!=='string'||d[key].length>max)fail(400,'Invalid profile field: '+key);values[key]=d[key].trim();}
  if(!values.first_name||!values.last_name||!values.country)fail(400,'First name, last name and country are required.');
  if(typeof d.marketing_opt_in!=='boolean')fail(400,'Invalid updates preference.');
  const keys=Object.keys(fields),name=values.first_name+' '+values.last_name;
  await env.DB.batch([
   env.DB.prepare('UPDATE users SET name=? WHERE id=?').bind(name,user.id),
   env.DB.prepare(`INSERT INTO user_profiles(user_id,${keys.join(',')},marketing_opt_in,marketing_consent_at) VALUES(${Array(keys.length+3).fill('?').join(',')}) ON CONFLICT(user_id) DO UPDATE SET ${keys.map(k=>k+'=excluded.'+k).join(',')},marketing_consent_at=CASE WHEN excluded.marketing_opt_in=0 THEN NULL WHEN user_profiles.marketing_opt_in=0 THEN excluded.marketing_consent_at ELSE user_profiles.marketing_consent_at END,marketing_opt_in=excluded.marketing_opt_in`).bind(user.id,...keys.map(k=>values[k]),d.marketing_opt_in?1:0,d.marketing_opt_in?Math.floor(Date.now()/1000):null)
  ]);
  return json({ok:true,name});
 }
 if(request.method!=='GET')fail(405,'Method not allowed.');
 const saved=await env.DB.prepare('SELECT * FROM user_profiles WHERE user_id=?').bind(user.id).first();
 const profile={};for(const k of Object.keys(fields))profile[k]=saved?.[k]||'';
 if(!saved){const names=user.name.split(' ');profile.first_name=names.shift()||'';profile.last_name=names.join(' ');}
 profile.marketing_opt_in=!!saved?.marketing_opt_in;
 const grants=(await env.DB.prepare(`SELECT c.title,c.course_code,a.course_id,a.expires_at,a.revoked_at,CASE WHEN a.revoked_at IS NOT NULL THEN 'revoked' WHEN a.expires_at IS NOT NULL AND a.expires_at<=unixepoch() THEN 'expired' ELSE 'active' END status FROM course_access a LEFT JOIN courses c ON c.id=a.course_id WHERE a.user_id=? ORDER BY a.rowid DESC`).bind(user.id).all()).results;
 const learning=(await env.DB.prepare(`SELECT c.id,c.title,c.course_code,c.duration_seconds,c.published,c.deleted_at,COALESCE(p.watched_seconds,0) watched_seconds,e.completed_at FROM enrollments e JOIN courses c ON c.id=e.course_id LEFT JOIN course_progress p ON p.course_id=c.id AND p.user_id=e.user_id WHERE e.user_id=? ORDER BY c.category,c.course_code`).bind(user.id).all()).results;
 const certificates=(await env.DB.prepare('SELECT id,course_title,learner_name,issued_at FROM certificates WHERE user_id=? ORDER BY issued_at DESC').bind(user.id).all()).results;
 return json({user:{name:user.name,email:user.email},profile,access:{billing:'one_time',recurring:false,grants,libraryActive:grants.some(g=>g.status==='active'&&g.course_id===null)},learning,certificates});
}
