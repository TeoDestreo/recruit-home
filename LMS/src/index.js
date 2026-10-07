import {accountRoute} from './account.js';
import {isAdmin,adminRoute,activityState,requireActivity,activityPublic,learnerActivity} from './admin.js';
const encoder = new TextEncoder();
const json = (data, status=200, headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };
const hex = bytes => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex = s => Uint8Array.from(s.match(/../g),x=>parseInt(x,16));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async s => hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function passwordHash(password,salt=random()) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const result = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(salt),iterations:100000},key,256);
  return `pbkdf2-sha256$100000$${salt}$${hex(result)}`;
}
async function passwordMatches(password,stored) {
  const parts=(stored||'').split('$');
  const result=await passwordHash(password,parts[2]||'0'.repeat(64));
  if (!stored || stored.length!==result.length) return false;
  let different=0; for(let i=0;i<stored.length;i++) different|=stored.charCodeAt(i)^result.charCodeAt(i);
  return different===0;
}
function cookie(request,token,age=604800) {
  const secure=new URL(request.url).protocol==='https:';
  return `${secure?'__Host-':''}acpe_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
}
function articleHtml(value) {
  const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const source=String(value||'');
  if(!/<\/?[a-z][\s\S]*>/i.test(source))return source.split(/\n\s*\n/).map(p=>`<p>${escape(p).replaceAll('\n','<br>')}</p>`).join('');
  const allowed=new Set(['p','h2','h3','ul','ol','li','blockquote','strong','b','em','i','u','s','a','br','hr']);
  return (source.match(/<[^>]*>|[^<]+|</g)||[]).map(token=>{
    if(token[0]!=='<')return escape(token);
    const match=token.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i);if(!match)return escape(token);
    const [,closing,rawName,attrs]=match,name=rawName.toLowerCase();if(!allowed.has(name))return '';
    if(closing)return ['br','hr'].includes(name)?'':`</${name}>`;
    if(name!=='a')return ['br','hr'].includes(name)?`<${name}>`:`<${name}>`;
    const href=attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i),url=href?.[1]??href?.[2]??href?.[3]??'';
    if(!/^(https?:\/\/|mailto:)/i.test(url))return '<a>';
    return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">`;
  }).join('');
}
async function session(request,env) {
  const key=new URL(request.url).protocol==='https:'?'__Host-acpe_session':'acpe_session';
  const token=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1);
  if(!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const hash=await digest(token);
  const user=await env.DB.prepare('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>unixepoch()').bind(hash).first();
  return user?{...user,tokenHash:hash}:null;
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415,'JSON is required.');
  if(Number(request.headers.get('Content-Length'))>8192) fail(413,'Request is too large.');
  const text=await request.text(); if(text.length>8192) fail(413,'Request is too large.');
  try { const parsed=JSON.parse(text); if(!parsed || Array.isArray(parsed) || typeof parsed!=='object') throw Error(); return parsed; }
  catch { fail(400,'Invalid request.'); }
}
async function limit(env,key,max,period) {
  const now=Math.floor(Date.now()/1000), start=now-now%period;
  const row=await env.DB.prepare(`INSERT INTO auth_limits(key,window_start,attempts) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts`).bind(key,start).first();
  if(row.attempts>max) fail(429,'Too many attempts. Please try again later.');
}
async function auth(request,env,path) {
  const input=await body(request), email=String(input.email||'').trim().toLowerCase(), password=input.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<8||password.length>128) fail(400,'Enter a valid email and a password of 8–128 characters.');
  await limit(env,'ip:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),30,600);
  await limit(env,'email:'+await digest(email),10,600);
  let user;
  if(path.endsWith('/register')) {
    await verifySignup(request,env,input.turnstileToken);
    const fields={};
    for(const [key,max] of Object.entries({firstName:50,lastName:50,organization:150,jobTitle:100,city:100,region:100,country:100,designation:100,licenseNumber:80,licenseRegion:100,phone:40})) {
      if(input[key]!==undefined&&typeof input[key]!=='string')fail(400,'Invalid registration details.');
      fields[key]=(input[key]||'').trim();if(fields[key].length>max)fail(400,'Registration field is too long: '+key);
    }
    if(!fields.firstName||!fields.lastName||!fields.country)fail(400,'First name, last name, and country are required.');
    if(input.marketingOptIn!==undefined&&typeof input.marketingOptIn!=='boolean')fail(400,'Invalid updates preference.');
    const name=fields.firstName+' '+fields.lastName;
    const id=crypto.randomUUID(), hash=await passwordHash(password);
    const result=await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO users(id,email,name,password_hash) VALUES(?,?,?,?)').bind(id,email,name,hash),
      env.DB.prepare(`INSERT INTO user_profiles(user_id,first_name,last_name,organization,job_title,city,region,country,designation,license_number,license_region,phone,marketing_opt_in,marketing_consent_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=?)`).bind(id,fields.firstName,fields.lastName,fields.organization,fields.jobTitle,fields.city,fields.region,fields.country,fields.designation,fields.licenseNumber,fields.licenseRegion,fields.phone,input.marketingOptIn?1:0,input.marketingOptIn?Math.floor(Date.now()/1000):null,id)
    ]);
    if(!result[0].meta.changes) fail(409,'An account already exists for this email. Please sign in.');
    user={id,email,name};
  } else {
    const row=await env.DB.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').bind(email).first();
    if(!await passwordMatches(password,row?.password_hash)) fail(401,'Email or password is incorrect.');
    user={id:row.id,email:row.email,name:row.name};
  }
  const token=random();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at<=unixepoch()'),
    env.DB.prepare('DELETE FROM auth_limits WHERE window_start<unixepoch()-86400'),
    env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+604800)').bind(await digest(token),user.id)
  ]);
  return json({user:{...user,admin:await isAdmin(env,user)}},200,{'Set-Cookie':cookie(request,token)});
}
const RESET_REQUEST_MESSAGE='If an account matches that email, a password reset link will arrive shortly. The link expires in 30 minutes.';
async function requestPasswordReset(request,env) {
  if(!env.CF_EMAIL_API_TOKEN||!env.CF_ACCOUNT_ID)return json({error:'Password reset email is not configured yet.'},503);
  const input=await body(request),email=String(input.email||'').trim().toLowerCase();
  await limit(env,'reset:ip:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),20,3600);
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({message:RESET_REQUEST_MESSAGE});
  try { await limit(env,'reset:email:'+await digest(email),3,3600); }
  catch(error) { if(error.status===429)return json({message:RESET_REQUEST_MESSAGE}); throw error; }
  const user=await env.DB.prepare('SELECT id,email FROM users WHERE email=? COLLATE NOCASE').bind(email).first();
  if(!user)return json({message:RESET_REQUEST_MESSAGE});
  const token=random(),tokenHash=await digest(token),now=Math.floor(Date.now()/1000),base=new URL(request.url).origin;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=? OR expires_at<=?').bind(user.id,now),
    env.DB.prepare('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash,user.id,now+1800)
  ]);
  const link=`${base}/LMS/#reset=${token}`;
  try {
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,{
      method:'POST',headers:{Authorization:`Bearer ${env.CF_EMAIL_API_TOKEN}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
      body:JSON.stringify({to:user.email,from:env.PASSWORD_RESET_FROM||'noreply@advancedcpe.com',subject:'Reset your Advanced CPE password',
        text:`We received a request to reset your Advanced CPE password. Use this link within 30 minutes:\n\n${link}\n\nIf you did not request this, you can ignore this email. Your password will not change.`,
        html:`<p>We received a request to reset your Advanced CPE password.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 30 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email. Your password will not change.</p>`})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok||!result?.success)throw Object.assign(new Error('Cloudflare email request failed'),{code:`CF_EMAIL_HTTP_${response.status}`});
  } catch(error) {
    await env.DB.prepare('DELETE FROM password_reset_tokens WHERE token_hash=?').bind(tokenHash).run();
    console.error('Password reset email could not be sent',error?.code||'EMAIL_SEND_FAILED');
  }
  return json({message:RESET_REQUEST_MESSAGE});
}
async function completePasswordReset(request,env) {
  const input=await body(request),token=String(input.token||''),password=input.password;
  if(!/^[a-f0-9]{64}$/.test(token)||typeof password!=='string'||password.length<8||password.length>128)fail(400,'Use a valid reset link and a password of 8–128 characters.');
  await limit(env,'reset-complete:ip:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),20,3600);
  const consumed=await env.DB.prepare('UPDATE password_reset_tokens SET used_at=unixepoch() WHERE token_hash=? AND used_at IS NULL AND expires_at>unixepoch() RETURNING user_id').bind(await digest(token)).all();
  const userId=consumed.results?.[0]?.user_id;
  if(!userId)fail(400,'This reset link has expired or has already been used. Request a new one.');
  const passwordHashValue=await passwordHash(password);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(passwordHashValue,userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=? AND token_hash<>?').bind(userId,await digest(token))
  ]);
  return json({ok:true,message:'Your password has been changed. Please sign in with your new password.'},200,{'Set-Cookie':cookie(request,'',0)});
}
export function mergeRanges(ranges,start,end) {
  const sorted=[...ranges,[start,end]].sort((a,b)=>a[0]-b[0]), merged=[];
  for(const range of sorted) { const last=merged.at(-1); if(last&&range[0]<=last[1]+0.25) last[1]=Math.max(last[1],range[1]); else merged.push([...range]); }
  return merged;
}
async function verifySignup(request,env,token) {
  if(!env.TURNSTILE_SECRET) fail(503,'Account registration is temporarily unavailable.');
  if(typeof token!=='string'||!token||token.length>2048) fail(400,'Please complete the security check.');
  let verified;
  try {
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),
      body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token,remoteip:request.headers.get('CF-Connecting-IP')||undefined})
    });
    if(!response.ok) throw Error();
    verified=await response.json();
  }catch { fail(503,'The security check is temporarily unavailable. Please try again.'); }
  if(!verified.success||verified.hostname!==new URL(request.url).hostname||verified.action!=='signup') fail(400,'The security check failed or expired. Please try again.');
}
async function requireAccess(env,user,courseId) {
  if(await isAdmin(env,user))return;
  const course=await env.DB.prepare("SELECT access_tier FROM courses WHERE id=? AND published=1 AND deleted_at IS NULL").bind(courseId).first();
  if(course?.access_tier==='free')return;
  const access=await env.DB.prepare(`SELECT id FROM course_access WHERE user_id=? AND (course_id=? OR course_id IS NULL) AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>unixepoch()) LIMIT 1`).bind(user.id,courseId).first();
  if(!access) fail(402,'Paid enrollment is required to take this course.');
}
async function modulePublished(env,courseId,type){const row=await env.DB.prepare('SELECT enabled,published FROM learning_modules WHERE course_id=? AND module_type=?').bind(courseId,type).first();return row?.enabled===1&&row?.published===1;}
const PRICE='100.00', CURRENCY='USD', LIBRARY_ACCESS_SECONDS=365*24*60*60;
const paypalReady=env=>!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET);
async function libraryAccess(env,user) {
  return env.DB.prepare('SELECT id FROM course_access WHERE user_id=? AND course_id IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>unixepoch()) LIMIT 1').bind(user.id).first();
}
async function redeemCoupon(request,env,user) {
  const input=await body(request);
  await limit(env,'coupon:user:'+user.id,10,600);
  await limit(env,'coupon:ip:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),30,600);
  if(!env.FREE_ACCESS_CODE_HASH) fail(503,'Coupon redemption is temporarily unavailable.');
  const code=typeof input.code==='string'?input.code.trim():'';
  if(!code||code.length>128||await digest(code)!==env.FREE_ACCESS_CODE_HASH) fail(400,'This coupon code is not valid.');
  const reference='coupon:library-2026:'+user.id;
  const existing=await env.DB.prepare('SELECT revoked_at,expires_at FROM course_access WHERE payment_reference=?').bind(reference).first();
  if(existing&&existing.revoked_at!==null) fail(403,'This coupon access was revoked. Please contact Advanced CPE.');
  if(existing&&existing.expires_at!==null&&existing.expires_at<=Math.floor(Date.now()/1000))fail(409,'This coupon was already redeemed and its one-year access has expired. Contact your instructor for a new code.');
  await env.DB.prepare('INSERT INTO course_access(id,user_id,course_id,payment_reference,granted_at,expires_at) VALUES(?,?,NULL,?,unixepoch(),unixepoch()+?) ON CONFLICT(payment_reference) DO NOTHING').bind(crypto.randomUUID(),user.id,reference,LIBRARY_ACCESS_SECONDS).run();
  return json({ok:true,access:'library'});
}
async function paypalClient(env) {
  if(!paypalReady(env)) fail(503,'PayPal checkout is not configured yet. You can still redeem a coupon.');
  const base=env.PAYPAL_ENV==='sandbox'?'https://api-m.sandbox.paypal.com':'https://api-m.paypal.com';
  let token;
  try {
    const response=await fetch(base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw Error();
    token=(await response.json()).access_token;if(!token) throw Error();
  }catch {fail(502,'Unable to connect to PayPal. Please try again later.');}
  return async(path,method='GET',data,requestId)=>{
    try {
      const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});
      const result=await response.json();
      if(!response.ok) fail(502,'PayPal could not complete this request. Please retry to check your payment status.');
      return result;
    }catch(error){if(error.status)throw error;fail(502,'PayPal did not respond. Please retry to check your payment status.');}
  };
}
async function checkout(request,env,user,action) {
  const input=await body(request);
  await limit(env,'checkout:'+user.id,20,600);
  if(action==='create') {
    if(await libraryAccess(env,user)) fail(409,'You already have active library access.');
    const paypal=await paypalClient(env),id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO checkout_orders(id,user_id) VALUES(?,?)').bind(id,user.id).run();
    const origin=new URL(request.url).origin;
    const order=await paypal('/v2/checkout/orders','POST',{
      intent:'CAPTURE',purchase_units:[{reference_id:id,custom_id:id,description:'Advanced CPE — one year of video library access',amount:{currency_code:CURRENCY,value:PRICE}}],
      payment_source:{paypal:{experience_context:{brand_name:'Advanced CPE',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:origin+'/LMS/?checkout=return',cancel_url:origin+'/LMS/?checkout=cancel'}}}
    },id);
    const approval=order.links?.find(link=>['payer-action','approve'].includes(link.rel))?.href;
    let valid=false;try{const u=new URL(approval);valid=u.protocol==='https:'&&u.hostname===(env.PAYPAL_ENV==='sandbox'?'www.sandbox.paypal.com':'www.paypal.com');}catch{}
    if(!/^[A-Z0-9]{8,32}$/.test(order.id||'')||!valid) fail(502,'PayPal did not return a valid checkout link.');
    await env.DB.prepare('UPDATE checkout_orders SET paypal_order_id=? WHERE id=?').bind(order.id,id).run();
    return json({approvalUrl:approval,orderId:order.id});
  }
  if(typeof input.orderId!=='string'||!/^[A-Z0-9]{8,32}$/.test(input.orderId)) fail(400,'Invalid checkout reference.');
  const local=await env.DB.prepare('SELECT * FROM checkout_orders WHERE paypal_order_id=? AND user_id=?').bind(input.orderId,user.id).first();
  if(!local) fail(404,'Checkout not found for this account. Sign in with the account used to start checkout.');
  if(local.status==='COMPLETED') return json({ok:true,access:await libraryAccess(env,user)?'library':null});
  const paypal=await paypalClient(env);
  let order=await paypal('/v2/checkout/orders/'+local.paypal_order_id);
  if(order.status==='APPROVED') {
    // A stable request ID makes retries safe if capture succeeded but the response was lost.
    await paypal('/v2/checkout/orders/'+local.paypal_order_id+'/capture','POST',{},local.id+'-cap');
    order=await paypal('/v2/checkout/orders/'+local.paypal_order_id);
  }
  const unit=order.purchase_units?.[0],captures=unit?.payments?.captures,cap=captures?.[0];
  if(order.id!==local.paypal_order_id||order.status!=='COMPLETED'||order.intent!=='CAPTURE'||order.purchase_units?.length!==1||unit.custom_id!==local.id||unit.amount?.value!==PRICE||unit.amount?.currency_code!==CURRENCY||captures?.length!==1||cap.status!=='COMPLETED'||cap.amount?.value!==PRICE||cap.amount?.currency_code!==CURRENCY||!cap.id) fail(409,'Payment is not confirmed. No access has been granted. Please retry or contact Advanced CPE.');
  await env.DB.batch([
    env.DB.prepare("UPDATE checkout_orders SET status='COMPLETED',capture_id=?,completed_at=unixepoch() WHERE id=? AND status<>'COMPLETED'").bind(cap.id,local.id),
    env.DB.prepare('INSERT INTO course_access(id,user_id,course_id,payment_reference,granted_at,expires_at) VALUES(?,?,NULL,?,unixepoch(),unixepoch()+?) ON CONFLICT(payment_reference) DO NOTHING').bind(crypto.randomUUID(),user.id,'paypal:'+cap.id,LIBRARY_ACCESS_SECONDS)
  ]);
  return json({ok:true,access:'library'});
}
async function playback(request,env,user,course,action) {
  const data=await body(request);
  if(action==='start') {
    const token=random();
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO enrollments(user_id,course_id) VALUES(?,?)').bind(user.id,course.id),
      env.DB.prepare('INSERT OR IGNORE INTO course_progress(user_id,course_id) VALUES(?,?)').bind(user.id,course.id),
      env.DB.prepare('UPDATE course_progress SET playback_token=?,last_position=position_seconds,heartbeat_at=?,revision=revision+1 WHERE user_id=? AND course_id=?').bind(await digest(token),Date.now(),user.id,course.id)
    ]);
    const progress=await env.DB.prepare('SELECT position_seconds,watched_seconds FROM course_progress WHERE user_id=? AND course_id=?').bind(user.id,course.id).first();
    return json({token,...progress,duration_seconds:course.duration_seconds,video:course.youtube_id?{type:'youtube',id:course.youtube_id}:{type:'upload'}});
  }
  if(typeof data.position!=='number'||!Number.isFinite(data.position)||data.position<0||data.position>course.duration_seconds+1||typeof data.token!=='string') fail(400,'Invalid playback position.');
  const tokenHash=await digest(data.token);
  const p=await env.DB.prepare('SELECT * FROM course_progress WHERE user_id=? AND course_id=? AND playback_token=?').bind(user.id,course.id,tokenHash).first();
  if(!p) fail(409,'This video was opened elsewhere. Reopen the course to continue.');
  const now=Date.now(), elapsed=(now-p.heartbeat_at)/1000, position=Math.min(data.position,course.duration_seconds), delta=position-p.last_position;
  let ranges=JSON.parse(p.watched_ranges);
  if(data.playing===true&&elapsed>=0&&elapsed<=35&&delta>0&&delta<=Math.min(65,elapsed*2.05+1)) ranges=mergeRanges(ranges,p.last_position,position);
  const watched=ranges.reduce((sum,[a,b])=>sum+b-a,0);
  const result=await env.DB.prepare(`UPDATE course_progress SET position_seconds=?,watched_seconds=?,watched_ranges=?,last_position=?,heartbeat_at=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND course_id=? AND playback_token=? AND revision=?`).bind(position,watched,JSON.stringify(ranges),position,now,user.id,course.id,tokenHash,p.revision).run();
  if(!result.meta.changes) fail(409,'Progress changed in another window. Reopen the course.');
  const enrollment=await env.DB.prepare('SELECT completed_at FROM enrollments WHERE user_id=? AND course_id=?').bind(user.id,course.id).first();
  return json({watched_seconds:watched,position_seconds:position,completed_at:enrollment.completed_at});
}
async function issueCertificate(env,user,courseId) {
  const existing=await env.DB.prepare('SELECT id,learner_name,course_title,completed_at,issued_at FROM certificates WHERE user_id=? AND course_id=?').bind(user.id,courseId).first();
  if(existing)return existing;
  const passed=await env.DB.prepare('SELECT id FROM quiz_attempts WHERE user_id=? AND course_id=? AND passed=1 AND submitted_at IS NOT NULL').bind(user.id,courseId).first();
  if(!passed)fail(403,'Pass the course test with a score over 70% before requesting a certificate.');
  const enrollment=await env.DB.prepare('SELECT completed_at FROM enrollments WHERE user_id=? AND course_id=?').bind(user.id,courseId).first();
  if(!enrollment?.completed_at) fail(403,'Complete this course before requesting a certificate.');
  await env.DB.prepare(`INSERT INTO certificates(id,user_id,course_id,learner_name,course_title,completed_at)
    SELECT ?,e.user_id,e.course_id,u.name,c.title,e.completed_at FROM enrollments e
    JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
    WHERE e.user_id=? AND e.course_id=? AND e.completed_at IS NOT NULL
    ON CONFLICT(user_id,course_id) DO NOTHING`).bind(crypto.randomUUID(),user.id,courseId).run();
  return env.DB.prepare('SELECT id,learner_name,course_title,completed_at,issued_at FROM certificates WHERE user_id=? AND course_id=?').bind(user.id,courseId).first();
}
async function quizStatus(env,user,course){
  const rows=await env.DB.prepare('SELECT attempt_number,score,passed FROM quiz_attempts WHERE user_id=? AND course_id=? AND submitted_at IS NOT NULL ORDER BY attempt_number').bind(user.id,course.id).all();
  const progress=await env.DB.prepare('SELECT watched_seconds FROM course_progress WHERE user_id=? AND course_id=?').bind(user.id,course.id).first();
  const certificate=await env.DB.prepare('SELECT id FROM certificates WHERE user_id=? AND course_id=?').bind(user.id,course.id).first();
  const videoRequired=await modulePublished(env,course.id,'video')&&(course.asset_key||course.youtube_id)&&course.duration_seconds>0;
  return {...await activityState(env,user,course),attemptsUsed:rows.results.length,attemptsRemaining:3-rows.results.length,passed:rows.results.some(a=>a.passed===1),lastScore:rows.results.at(-1)?.score??null,bestScore:rows.results.length?Math.max(...rows.results.map(a=>a.score)):null,eligible:!videoRequired||(progress?.watched_seconds||0)>=course.duration_seconds*0.95,certificateId:certificate?.id||null};
}
function shuffled(values){
  const result=[...values];for(let i=result.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;
}
async function courseTest(request,env,user,course,action){
  if(action==='status')return json(await quizStatus(env,user,course));
  const input=await body(request);
  await limit(env,'quiz:'+user.id+':'+course.id,40,600);
  if(action==='submit'){
    if(typeof input.attemptId!=='string')fail(400,'Invalid test attempt.');
    const attempt=await env.DB.prepare('SELECT * FROM quiz_attempts WHERE id=? AND user_id=? AND course_id=?').bind(input.attemptId,user.id,course.id).first();
    if(!attempt)fail(404,'Test attempt not found.');
    if(attempt.submitted_at===null){
      await requireActivity(env,user,course);
      if(!(await quizStatus(env,user,course)).eligible)fail(403,'Watch at least 95% of the current video before submitting.');
      const questions=JSON.parse(attempt.questions_json),answers=input.answers;
      if(!Array.isArray(answers)||answers.length!==questions.length||answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=questions[i].options.length))fail(400,'Answer every question before submitting.');
      const right=questions.reduce((n,q,i)=>n+(q.correct===answers[i]?1:0),0),score=right*10;
      // Atomic compare-and-set: concurrent submissions and network retries grade once.
      await env.DB.prepare('UPDATE quiz_attempts SET submitted_at=unixepoch(),score=?,passed=? WHERE id=? AND user_id=? AND submitted_at IS NULL').bind(score,score>70?1:0,attempt.id,user.id).run();
    }
    const result=await env.DB.prepare('SELECT score,passed,attempt_number FROM quiz_attempts WHERE id=? AND user_id=?').bind(attempt.id,user.id).first();
    if(result.passed){if(!await modulePublished(env,course.id,'video'))await env.DB.prepare("INSERT INTO enrollments(user_id,course_id,completed_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,course_id) DO UPDATE SET completed_at=COALESCE(enrollments.completed_at,excluded.completed_at)").bind(user.id,course.id).run();await issueCertificate(env,user,course.id);}
    return json({score:result.score,passed:!!result.passed,attemptNumber:result.attempt_number,status:await quizStatus(env,user,course)});
  }
  const status=await quizStatus(env,user,course);
  if(status.passed||status.certificateId)fail(409,'You have already completed this course.');
  if(!status.eligible)fail(403,'Watch at least 95% of the video before taking the test.');
  if(status.attemptsRemaining===0)fail(403,'All three test attempts have been used.');
  await requireActivity(env,user,course);
  const draft=await env.DB.prepare('SELECT * FROM quiz_attempts WHERE user_id=? AND course_id=? AND submitted_at IS NULL').bind(user.id,course.id).first();
  if(draft)return json({attemptId:draft.id,attemptNumber:draft.attempt_number,questions:JSON.parse(draft.questions_json).map(q=>({prompt:q.prompt,options:q.options})),status});
  const bank=await env.DB.prepare('SELECT * FROM course_quizzes WHERE course_id=? AND published=1').bind(course.id).first();
  if(!bank)fail(503,'This course test is not available. Please contact Advanced CPE.');
  const raw=JSON.parse(bank.questions_json);
  if(!Array.isArray(raw)||raw.length!==10||raw.some(q=>typeof q.prompt!=='string'||!Array.isArray(q.options)||q.options.length<2||q.options.some(o=>typeof o!=='string')||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length))fail(503,'This test needs an administrator review.');
  const questions=shuffled(raw).map(q=>{const order=shuffled(q.options.map((_,i)=>i));return {prompt:q.prompt,options:order.map(i=>q.options[i]),correct:order.indexOf(q.correct)};});
  await env.DB.prepare(`INSERT INTO quiz_attempts(id,user_id,course_id,attempt_number,quiz_version,questions_json)
    SELECT ?,?,?,?, ?,? WHERE NOT EXISTS(SELECT 1 FROM quiz_attempts WHERE user_id=? AND course_id=? AND passed=1)
    ON CONFLICT(user_id,course_id,attempt_number) DO NOTHING`).bind(crypto.randomUUID(),user.id,course.id,status.attemptsUsed+1,bank.version,JSON.stringify(questions),user.id,course.id).run();
  const attempt=await env.DB.prepare('SELECT * FROM quiz_attempts WHERE user_id=? AND course_id=? AND submitted_at IS NULL').bind(user.id,course.id).first();
  if(!attempt)fail(409,'The test status changed in another window. Please reopen it.');
  return json({attemptId:attempt.id,attemptNumber:attempt.attempt_number,questions:JSON.parse(attempt.questions_json).map(q=>({prompt:q.prompt,options:q.options})),status});
}
async function video(request,env,course) {
  if(course.youtube_id)fail(409,'This course uses the embedded YouTube player.');
  const object=await env.COURSE_STORAGE.head(course.asset_key);
  if(!object) fail(404,'Video not found.');
  const headers=new Headers({'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, no-store','ETag':object.httpEtag});
  let start=0,end=object.size-1,status=200;
  const range=request.headers.get('Range');
  if(range) {
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match||(!match[1]&&!match[2])) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${object.size}`}});
    if(!match[1]) start=Math.max(0,object.size-Number(match[2]));
    else { start=Number(match[1]); if(match[2]) end=Math.min(end,Number(match[2])); }
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=object.size) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${object.size}`}});
    status=206; headers.set('Content-Range',`bytes ${start}-${end}/${object.size}`);
  }
  headers.set('Content-Length',String(end-start+1));
  if(request.method==='HEAD') return new Response(null,{status,headers});
  const file=await env.COURSE_STORAGE.get(course.asset_key,{range:{offset:start,length:end-start+1}});
  if(!file) fail(404,'Video not found.');
  return new Response(file.body,{status,headers});
}
async function learningPage(request,env,path){
  if(path==='/articles/'){
    const {results}=await env.DB.prepare("SELECT c.title,c.description,c.slug,c.category FROM courses c JOIN learning_modules m ON m.course_id=c.id AND m.module_type='article' AND m.enabled=1 AND m.published=1 WHERE c.content_type='article' AND c.published=1 AND c.deleted_at IS NULL ORDER BY c.category COLLATE NOCASE,c.title").all();
    const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    const cards=results.map(r=>`<article class="card"><span class="tag">${esc(r.category)}</span><h2><a href="/articles/${esc(r.slug)}/">${esc(r.title)}</a></h2><p>${esc(r.description)}</p><a href="/articles/${esc(r.slug)}/">Read article →</a></article>`).join('')||'<p>No articles are published yet.</p>';
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Articles | Advanced CPE</title><link rel="stylesheet" href="/site.css"></head><body><header><nav class="wrap nav"><a class="brand" href="/"><b>A+</b> Advanced CPE</a><div><a href="/LMS/">Course library</a><a href="/about/">About us</a><a href="/contact/">Contact us</a></div></nav></header><main><section class="hero"><div class="wrap"><p class="eyebrow">Articles</p><h1>Useful ideas for the work ahead.</h1><p>Free to explore, no sign-in required.</p></div></section><section class="wrap section grid resource-grid">${cards}</section></main></body></html>`;
    return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60'}});
  }
  if(!/^\/(topics|articles)\/[a-z0-9-]+\/$/.test(path))return null;
  const slug=path.split('/')[2],row=await env.DB.prepare("SELECT c.id,c.title,c.description,c.content_type,c.access_tier,c.published item_published,c.deleted_at,m.body,m.enabled,m.published module_published FROM courses c LEFT JOIN learning_modules m ON m.course_id=c.id AND m.module_type='article' WHERE c.slug=?").bind(slug).first();
  if(row&&(row.item_published!==1||row.deleted_at||row.enabled!==1||row.module_published!==1))return new Response('Not found',{status:404});
  if(!row||!row.body)return null;
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  if(row.access_tier==='course_pack'){
    const viewer=await session(request,env);let allowed=false;
    if(viewer)try{await requireAccess(env,viewer,row.id);allowed=true;}catch{}
    if(!allowed){const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Course Pack access | Advanced CPE</title><link rel="stylesheet" href="/site.css"><body><main class="wrap section"><h1>${esc(row.title)}</h1><p>${esc(row.description)}</p><h2>$100 USD · 1 year</h2><p>This learning item is included in the Course Pack. Sign in to check your access or create an account to enroll.</p><a class="button" href="/LMS/?login=1">Sign in or create an account</a> <a href="/pricing/">View pricing</a></main></body></html>`;return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});}
  }
  const body=articleHtml(row.body);
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(row.title)} | Advanced CPE</title><meta name="description" content="${esc(row.description)}"><link rel="stylesheet" href="/site.css"></head><body><header><nav class="wrap nav"><a class="brand" href="/"><b>A+</b> Advanced CPE</a><div><a href="/LMS/">Course library</a><a href="/law-firm-accounting/">Law firms</a><a href="/articles/">Articles</a><a href="/pricing/">Pricing</a></div></nav></header><main><section class="hero"><div class="wrap"><p class="eyebrow">${row.content_type==='guide'?'Free reading guide':'Article'}</p><h1>${esc(row.title)}</h1></div></section><article class="wrap section prose">${body}<p><a href="/LMS/">← Learning library</a></p></article></main></body></html>`;
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60'}});
}
async function route(request,env) {
  const url=new URL(request.url),path=url.pathname,method=request.method;
  const activityResponse=await activityPublic(request,env);if(activityResponse)return activityResponse;
  if(/^\/LMS\/admin(?:\/|\.html)?$/.test(path)){
    const admin=await session(request,env);
    if(!admin)return Response.redirect(url.origin+'/LMS/?login=1',302);
    if(!await isAdmin(env,admin))fail(403,'Administrator access required.');
    const asset=await env.ASSETS.fetch(new Request(url.origin+'/LMS/admin',request));
    const h=new Headers(asset.headers);h.set('Cache-Control','private, no-store');return new Response(asset.body,{status:asset.status,headers:h});
  }
  if(!path.startsWith('/api/')) {const page=await learningPage(request,env,path);return page||env.ASSETS.fetch(request);}
  if(!['GET','HEAD','POST'].includes(method)) fail(405,'Method not allowed.');
  if(method==='POST' && request.headers.get('Origin')!==url.origin) fail(403,'Request origin is not allowed.');
  if(path==='/api/health'&&method==='GET') { await env.DB.prepare('SELECT 1').first(); return json({ok:true}); }
  if(path==='/api/config'&&method==='GET') return json({turnstileSiteKey:env.TURNSTILE_SITE_KEY||null,checkoutAvailable:paypalReady(env),couponAvailable:!!env.FREE_ACCESS_CODE_HASH,passwordResetAvailable:!!env.CF_EMAIL_API_TOKEN,price:PRICE,currency:CURRENCY});
  if(['/api/auth/register','/api/auth/login'].includes(path)&&method==='POST') return auth(request,env,path);
  if(path==='/api/auth/password-reset/request'&&method==='POST')return requestPasswordReset(request,env);
  if(path==='/api/auth/password-reset/complete'&&method==='POST')return completePasswordReset(request,env);
  const user=await session(request,env);
  if(path==='/api/me'&&method==='GET') return json({user:user?{id:user.id,name:user.name,email:user.email,admin:await isAdmin(env,user)}:null});
  if(path==='/api/courses'&&method==='GET') {
    const uid=user?.id||'';
    const {results}=await env.DB.prepare(`SELECT c.id,c.title,c.description,c.category,c.level,c.duration_seconds,c.course_code,c.topic_path,c.content_type,c.access_tier,c.slug,
      CASE WHEN (c.asset_key IS NOT NULL OR c.youtube_id IS NOT NULL) AND c.duration_seconds>0 AND EXISTS(SELECT 1 FROM learning_modules m WHERE m.course_id=c.id AND m.module_type='video' AND m.enabled=1 AND m.published=1) THEN 1 ELSE 0 END available,
      e.completed_at,COALESCE(p.position_seconds,0) position_seconds,COALESCE(p.watched_seconds,0) watched_seconds,
      CASE WHEN c.access_tier='free' THEN 1 ELSE EXISTS(SELECT 1 FROM course_access a WHERE a.user_id=? AND (a.course_id=c.id OR a.course_id IS NULL) AND a.revoked_at IS NULL AND (a.expires_at IS NULL OR a.expires_at>unixepoch())) END has_access,
      EXISTS(SELECT 1 FROM learning_modules m WHERE m.course_id=c.id AND m.module_type='video' AND m.enabled=1 AND m.published=1) video_published,
      EXISTS(SELECT 1 FROM learning_modules m WHERE m.course_id=c.id AND m.module_type='test' AND m.enabled=1 AND m.published=1) test_published,
      EXISTS(SELECT 1 FROM learning_modules m WHERE m.course_id=c.id AND m.module_type='article' AND m.enabled=1 AND m.published=1) article_published,
      EXISTS(SELECT 1 FROM learning_modules m WHERE m.course_id=c.id AND m.module_type='lumi' AND m.enabled=1 AND m.published=1) lumi_published
      FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id AND e.user_id=?
      LEFT JOIN course_progress p ON p.course_id=c.id AND p.user_id=?
      WHERE c.published=1 AND c.deleted_at IS NULL ORDER BY c.category COLLATE NOCASE,CAST(substr(c.id,8) AS INTEGER),c.title`).bind(uid,uid,uid).all();
    return json({courses:results});
  }
  if(!user) fail(401,'Please sign in.');
  if(path==='/api/account')return accountRoute(request,env,user);
  if(path.startsWith('/api/admin/'))return adminRoute(request,env,user);
  const activityMatch=/^\/api\/courses\/([a-z0-9-]+)\/activity\/(launch|complete)$/.exec(path);
  if(activityMatch&&method==='POST'){
    const course=await env.DB.prepare('SELECT * FROM courses WHERE id=? AND published=1').bind(activityMatch[1]).first();if(!course)fail(404,'Course not found.');
    await requireAccess(env,user,course.id);await limit(env,'activity:'+user.id,120,600);return learnerActivity(request,env,user,course,activityMatch[2]);
  }
  const activitiesMatch=/^\/api\/courses\/([a-z0-9-]+)\/activities$/.exec(path);
  if(activitiesMatch&&method==='GET'){
    const course=await env.DB.prepare('SELECT * FROM courses WHERE id=? AND published=1 AND deleted_at IS NULL').bind(activitiesMatch[1]).first();
    if(!course||!(await modulePublished(env,course.id,'lumi')))fail(404,'Published Lumi module not found.');
    await requireAccess(env,user,course.id);return json(await activityState(env,user,course));
  }
  if(path==='/api/checkout/status'&&method==='GET') {
    await limit(env,'paypal-status:'+user.id,5,600);
    await paypalClient(env);
    return json({ready:true});
  }
  if(path==='/api/checkout/coupon'&&method==='POST') return redeemCoupon(request,env,user);
  if(path==='/api/checkout/create'&&method==='POST') return checkout(request,env,user,'create');
  if(path==='/api/checkout/capture'&&method==='POST') return checkout(request,env,user,'capture');
  if(path==='/api/auth/logout'&&method==='POST') { await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.tokenHash).run(); return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)}); }
  const quizMatch=/^\/api\/courses\/([a-z0-9-]+)\/test(?:\/(start|submit))?$/.exec(path);
  if(quizMatch){
    const action=quizMatch[2]||'status';
    if(method!==(action==='status'?'GET':'POST'))fail(405,'Method not allowed.');
    const course=await env.DB.prepare('SELECT * FROM courses WHERE id=? AND published=1').bind(quizMatch[1]).first();
    if(!course||!(await modulePublished(env,course.id,'test')))fail(404,'Published course test not found.');
    await requireAccess(env,user,course.id);
    return courseTest(request,env,user,course,action);
  }
  const certificateMatch=/^\/api\/certificates\/([a-f0-9-]{36})$/.exec(path);
  if(certificateMatch && method==='GET') {
    const certificate=await env.DB.prepare('SELECT id,learner_name,course_title,completed_at,issued_at FROM certificates WHERE id=? AND user_id=?').bind(certificateMatch[1],user.id).first();
    if(!certificate) fail(404,'Certificate not found.');
    return json({certificate});
  }
  const issueMatch=/^\/api\/courses\/([a-z0-9-]+)\/certificate$/.exec(path);
  if(issueMatch && method==='POST') {
    await body(request);
    const existing=await env.DB.prepare('SELECT id,learner_name,course_title,completed_at,issued_at FROM certificates WHERE user_id=? AND course_id=?').bind(user.id,issueMatch[1]).first();
    if(existing)return json({certificate:existing});
    await requireAccess(env,user,issueMatch[1]);return json({certificate:await issueCertificate(env,user,issueMatch[1])});
  }
  const match=/^\/api\/courses\/([a-z0-9-]+)\/(video|start|progress)$/.exec(path);
  if(match) {
    const course=await env.DB.prepare('SELECT * FROM courses WHERE id=? AND published=1').bind(match[1]).first();
    if(!course) fail(404,'Course not found.');
    if((!course.asset_key&&!course.youtube_id)||course.duration_seconds<=0||!(await modulePublished(env,course.id,'video'))) fail(409,'This course does not have a published video module.');
    await requireAccess(env,user,course.id);
    if(match[2]==='video'&&['GET','HEAD'].includes(method)) return video(request,env,course);
    if(['start','progress'].includes(match[2])&&method==='POST') return playback(request,env,user,course,match[2]);
    fail(405,'Method not allowed.');
  }
  fail(404,'Not found.');
}
export default { async fetch(request,env) {
  try {
    const response=await route(request,env);
    const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    if(new URL(request.url).pathname.startsWith('/api/activity-'))headers.set('Referrer-Policy','no-referrer');
    if(new URL(request.url).pathname.startsWith('/LMS/vendor/'))headers.set('Access-Control-Allow-Origin','*');
    if(!new URL(request.url).pathname.startsWith('/api/activity-player/'))headers.set('X-Frame-Options','DENY');
    if(new URL(request.url).pathname.startsWith('/LMS')) headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://s.ytimg.com; style-src 'self'; media-src 'self' blob:; connect-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    return new Response(response.body,{status:response.status,headers});
  } catch(error) { if(!error.status) console.error('LMS request failed',error.message); return json({error:error.status?error.message:'Something went wrong. Please try again.'},error.status||500); }
}};
