// Email verification, administrator coupon codes, captions/transcripts and receipts. In-memory only.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from './src/index.js';
import {MemoryBucket} from './test-r2.mjs';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync(new URL('schema.sql',import.meta.url),'utf8'));
for(const f of readdirSync(new URL('migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){if(f==='0006_topic_library.sql'){db.exec(readFileSync(new URL('seed-courses.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('catalog-metadata.sql',import.meta.url),'utf8'));}db.exec(readFileSync(new URL('migrations/'+f,import.meta.url),'utf8'));}
function statement(sql,args=[]){return {bind(...a){return statement(sql,a);},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}};}};}
const env={COURSE_STORAGE:new MemoryBucket(),DB:{prepare:statement,async batch(items){db.exec('BEGIN');try{const r=[];for(const s of items)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},ASSETS:{fetch:async()=>new Response('asset')},
 TURNSTILE_SECRET:'test-secret',CF_EMAIL_API_TOKEN:'test-email-token',CF_ACCOUNT_ID:'acct',PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret',PAYPAL_ENV:'sandbox'};
const hash=async v=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))).toString('hex');
const emails=[];let emailFails=false,paypalOrder=null;
globalThis.fetch=async(url,options={})=>{
 if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return Response.json({success:true,hostname:'lms.test',action:'signup'});
 if(url==='https://api.cloudflare.com/client/v4/accounts/acct/email/sending/send'){assert.equal(options.headers.Authorization,'Bearer test-email-token');if(emailFails)return Response.json({success:false},{status:500});emails.push(JSON.parse(options.body));return Response.json({success:true});}
 const u=new URL(url);assert.equal(u.hostname,'api-m.sandbox.paypal.com');
 if(u.pathname==='/v1/oauth2/token')return Response.json({access_token:'pp-token'});
 if(u.pathname==='/v2/checkout/orders'&&options.method==='POST'){const id=JSON.parse(options.body).purchase_units[0].custom_id;paypalOrder={id:'ORDER12345',local:id};return Response.json({id:'ORDER12345',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345'}]});}
 if(u.pathname==='/v2/checkout/orders/ORDER12345')return Response.json({id:'ORDER12345',status:'COMPLETED',intent:'CAPTURE',purchase_units:[{custom_id:paypalOrder.local,amount:{value:'100.00',currency_code:'USD'},payments:{captures:[{id:'CAPTURE9876',status:'COMPLETED',amount:{value:'100.00',currency_code:'USD'}}]}}]});
 throw Error('Unexpected fetch '+url);
};
let cookie='';
async function req(path,data,headers={}){return worker.fetch(new Request('https://lms.test'+path,{method:data===undefined?'GET':'POST',headers:{Origin:'https://lms.test',Cookie:cookie,...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);}
async function ok(path,data){const r=await req(path,data);assert.equal(r.status,200,path+': '+await r.clone().text());return r.json();}
async function status(path,data,expected){const r=await req(path,data);assert.equal(r.status,expected,path+': '+await r.clone().text());return r.json().catch(()=>null);}
async function login(id,{admin=false,verified=true}={}){db.prepare('INSERT OR IGNORE INTO users(id,email,name,email_verified_at) VALUES(?,?,?,?)').run(id,id+'@example.invalid',id,verified?Math.floor(Date.now()/1000):null);if(admin)db.prepare('INSERT OR IGNORE INTO admins(user_id) VALUES(?)').run(id);const t=crypto.randomUUID().replaceAll('-','').repeat(2);db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').run(await hash(t),id);cookie='__Host-acpe_session='+t;return cookie;}
const linkToken=(mail,kind)=>new RegExp(`#${kind}=([a-f0-9]{64})`).exec(mail.text)[1];
const now=()=>Math.floor(Date.now()/1000);

// ---------- Email verification ----------
const signup={email:'New.Learner@Example.com',password:'correct horse',firstName:'New',lastName:'Learner',country:'US',turnstileToken:'ok'};
const reg=await req('/api/auth/register',signup);assert.equal(reg.status,200);cookie=reg.headers.get('Set-Cookie').split(';')[0];
let body=await reg.json();assert.equal(body.user.emailVerified,false);assert.equal(body.verificationSent,true);
assert.equal(emails.length,1);assert.equal(emails[0].to,'new.learner@example.com');assert.match(emails[0].subject,/Confirm/);
const firstToken=linkToken(emails[0],'verify');
assert.equal((await ok('/api/me')).user.emailVerified,false);
// Unverified learners cannot redeem, buy or open courses, even with an access grant.
db.prepare("INSERT INTO course_access(id,user_id,course_id,payment_reference,expires_at) SELECT 'grant-new',id,NULL,'test:new',unixepoch()+999 FROM users WHERE email='new.learner@example.com'").run();
assert.match((await status('/api/checkout/coupon',{code:'anything'},403)).error,/confirm your email/);
await status('/api/checkout/create',{},403);
await status('/api/courses/course-4/start',{},403);
// Resend replaces the old link; three resends per hour.
assert.match((await ok('/api/auth/verify-email/resend',{})).message,/new confirmation link/);
const secondToken=linkToken(emails[1],'verify');assert.notEqual(firstToken,secondToken);
await status('/api/auth/verify-email',{token:firstToken},400);
await ok('/api/auth/verify-email/resend',{});await ok('/api/auth/verify-email/resend',{});await status('/api/auth/verify-email/resend',{},429);
const latest=linkToken(emails.at(-1),'verify');
// The link works without being signed in (e.g. opened on another device), once.
const learnerCookie=cookie;cookie='';
assert.match((await ok('/api/auth/verify-email',{token:latest})).message,/confirmed/);
await status('/api/auth/verify-email',{token:latest},400);
await status('/api/auth/verify-email',{token:'not-a-token'},400);
cookie=learnerCookie;assert.equal((await ok('/api/me')).user.emailVerified,true);
assert.equal((await ok('/api/auth/verify-email/resend',{})).alreadyVerified,true);
assert.equal((await ok('/api/courses/course-4/start',{})).captions,false);
// Expired links are rejected.
await login('expired-user',{verified:false});await ok('/api/auth/verify-email/resend',{});const expired=linkToken(emails.at(-1),'verify');
db.prepare('UPDATE email_verification_tokens SET expires_at=unixepoch()-1 WHERE user_id=?').run('expired-user');await status('/api/auth/verify-email',{token:expired},400);
// Email delivery failure: registration still succeeds, the learner is told, resend reports the failure.
emailFails=true;const reg2=await req('/api/auth/register',{...signup,email:'second@example.com'});assert.equal(reg2.status,200);assert.equal((await reg2.json()).verificationSent,false);
cookie=reg2.headers.get('Set-Cookie').split(';')[0];await status('/api/auth/verify-email/resend',{},502);emailFails=false;
// Without email configured, registration still works and resend explains why it can't send.
const savedToken=env.CF_EMAIL_API_TOKEN;delete env.CF_EMAIL_API_TOKEN;await status('/api/auth/verify-email/resend',{},503);env.CF_EMAIL_API_TOKEN=savedToken;
// A completed password reset proves inbox ownership.
cookie='';await ok('/api/auth/password-reset/request',{email:'second@example.com'});
await ok('/api/auth/password-reset/complete',{token:linkToken(emails.at(-1),'reset'),password:'another password'});
assert.ok(db.prepare("SELECT email_verified_at FROM users WHERE email='second@example.com'").get().email_verified_at);
// Existing accounts are verified by the migration; admins can verify a learner manually.
await login('admin',{admin:true});await login('support-case',{verified:false});const supportCookie=cookie;
await login('admin',{admin:true});const adminCookie=cookie;
assert.equal((await ok('/api/admin/learners')).learners.find(l=>l.id==='support-case').email_verified_at,null);
assert.equal((await ok('/api/admin/learners/support-case/verify-email',{})).changed,true);
assert.equal((await ok('/api/admin/learners/support-case/verify-email',{})).changed,false);
cookie=supportCookie;assert.equal((await ok('/api/me')).user.emailVerified,true);

// ---------- Coupon codes ----------
cookie=supportCookie;await status('/api/admin/coupons',undefined,403);
cookie=adminCookie;
const spring=await ok('/api/admin/coupons',{code:'SPRING-2027',label:'Spring cohort',accessDays:30,maxRedemptions:1,expiresAt:null});
assert.equal(spring.code,'SPRING-2027');
await status('/api/admin/coupons',{code:'spring-2027',label:'',accessDays:30,maxRedemptions:null,expiresAt:null},409);
await status('/api/admin/coupons',{code:'bad code!',label:'',accessDays:30,maxRedemptions:null,expiresAt:null},400);
await status('/api/admin/coupons',{code:'',label:'',accessDays:0,maxRedemptions:null,expiresAt:null},400);
await status('/api/admin/coupons',{code:'',label:'',accessDays:10,maxRedemptions:0,expiresAt:null},400);
await status('/api/admin/coupons',{code:'',label:'',accessDays:10,maxRedemptions:null,expiresAt:now()-10},400);
const generated=await ok('/api/admin/coupons',{code:'',label:'Open code',accessDays:365,maxRedemptions:null,expiresAt:now()+86400});
assert.match(generated.code,/^ACPE-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
env.FREE_ACCESS_CODE_HASH=await hash('freecpe2026');
await status('/api/admin/coupons',{code:'freecpe2026',label:'',accessDays:10,maxRedemptions:null,expiresAt:null},409);
// Redeem: case-insensitive, idempotent for the same learner, limited uses.
await login('coupon-a');const a=await ok('/api/checkout/coupon',{code:' spring-2027 '});
assert.equal(a.access,'library');assert.ok(Math.abs(a.expiresAt-(now()+30*86400))<5);
assert.equal((await ok('/api/checkout/coupon',{code:'SPRING-2027'})).expiresAt,a.expiresAt);
assert.ok((await ok('/api/courses')).courses.find(c=>c.id==='course-4').has_access);
await login('coupon-b');assert.match((await status('/api/checkout/coupon',{code:'SPRING-2027'},409)).error,/limit/);
// A learner who already has library access doesn't use up a code.
const before=db.prepare('SELECT count(*) n FROM coupon_redemptions').get().n;
cookie=(await login('coupon-a'));await status('/api/checkout/coupon',{code:generated.code},409);
assert.equal(db.prepare('SELECT count(*) n FROM coupon_redemptions').get().n,before);
// Disabled and ended codes stop working; the legacy secret code still works.
cookie=adminCookie;const list=(await ok('/api/admin/coupons')).coupons;assert.equal(list.find(c=>c.code==='SPRING-2027').redemptions,1);
await ok('/api/admin/coupons/'+generated.id,{label:'Open code',maxRedemptions:null,expiresAt:now()+86400,disabled:true});
await login('coupon-c');assert.match((await status('/api/checkout/coupon',{code:generated.code},400)).error,/no longer active/);
cookie=adminCookie;await ok('/api/admin/coupons/'+generated.id,{label:'Open code',maxRedemptions:null,expiresAt:now()+86400,disabled:false});
db.prepare('UPDATE coupon_codes SET expires_at=unixepoch()-1 WHERE id=?').run(generated.id);
// An already-ended code can still be edited without changing its date.
await ok('/api/admin/coupons/'+generated.id,{label:'Renamed',maxRedemptions:null,expiresAt:db.prepare('SELECT expires_at FROM coupon_codes WHERE id=?').get(generated.id).expires_at,disabled:false});
await login('coupon-c');await status('/api/checkout/coupon',{code:generated.code},400);
assert.equal((await ok('/api/checkout/coupon',{code:'freecpe2026'})).access,'library');
await login('coupon-d');await status('/api/checkout/coupon',{code:'nope-nope'},400);
cookie=adminCookie;const who=(await ok('/api/admin/coupons/'+spring.id+'/redemptions')).redemptions;assert.equal(who.length,1);assert.equal(who[0].email,'coupon-a@example.invalid');
// The coupon form shows when only database codes exist.
delete env.FREE_ACCESS_CODE_HASH;assert.equal((await ok('/api/config')).couponAvailable,true);
db.exec('UPDATE coupon_codes SET disabled_at=unixepoch()');assert.equal((await ok('/api/config')).couponAvailable,false);

// ---------- Captions and transcripts ----------
const course='course-4';const srt='1\r\n00:00:01,000 --> 00:00:03,000\r\nWelcome to <b>fund</b> accounting.\r\n\r\n2\r\n00:00:03,500 --> 00:00:05,000\r\nLet us begin.\r\n';
cookie=adminCookie;
assert.deepEqual(await ok('/api/admin/courses/'+course+'/captions',{captions:srt}),{captions:true,transcript:true,transcriptLength:'Welcome to fund accounting.\nLet us begin.'.length});
assert.equal((await ok('/api/admin/courses/'+course)).captions.captions,true);
await status('/api/admin/courses/'+course+'/captions',{captions:'no timings here'},400);
const topic=db.prepare('SELECT id FROM courses WHERE topic_path IS NOT NULL LIMIT 1').get().id;await status('/api/admin/courses/'+topic+'/captions',{transcript:'x'},400);
await login('no-access');await status('/api/courses/'+course+'/captions.vtt',undefined,402);await status('/api/courses/'+course+'/transcript',undefined,402);
cookie=(await login('coupon-a'));
const vtt=await req('/api/courses/'+course+'/captions.vtt');assert.equal(vtt.status,200);assert.equal(vtt.headers.get('Content-Type'),'text/vtt; charset=utf-8');
const vttText=await vtt.text();assert.match(vttText,/^WEBVTT\n\n1\n00:00:01\.000 --> 00:00:03\.000\n/);
assert.equal((await ok('/api/courses/'+course+'/transcript')).transcript,'Welcome to fund accounting.\nLet us begin.');
const started=await ok('/api/courses/'+course+'/start',{});assert.equal(started.captions,true);assert.equal(started.transcript,true);
// A supplied transcript replaces the derived one and survives removing captions.
cookie=adminCookie;await ok('/api/admin/courses/'+course+'/captions',{transcript:'﻿Official transcript.\r\nSecond paragraph.'});
await ok('/api/admin/courses/'+course+'/captions',{captions:null});
cookie=(await login('coupon-a'));await status('/api/courses/'+course+'/captions.vtt',undefined,404);
assert.equal((await ok('/api/courses/'+course+'/transcript')).transcript,'Official transcript.\nSecond paragraph.');
// Uploading captions later keeps the supplied transcript.
cookie=adminCookie;await ok('/api/admin/courses/'+course+'/captions',{captions:'WEBVTT\n\n00:01.000 --> 00:02.000\nHi'});
cookie=(await login('coupon-a'));assert.equal((await ok('/api/courses/'+course+'/transcript')).transcript,'Official transcript.\nSecond paragraph.');
cookie=adminCookie;await ok('/api/admin/courses/'+course+'/captions',{captions:null,transcript:null});
assert.equal(db.prepare('SELECT count(*) n FROM course_captions').get().n,0);

// ---------- Certificates in the admin console ----------
db.exec("UPDATE enrollments SET completed_at=CURRENT_TIMESTAMP WHERE user_id='coupon-a' AND course_id='course-4'");db.prepare("INSERT INTO enrollments(user_id,course_id,completed_at) SELECT 'coupon-a','course-4',CURRENT_TIMESTAMP WHERE NOT EXISTS(SELECT 1 FROM enrollments WHERE user_id='coupon-a' AND course_id='course-4')").run();
db.prepare("INSERT INTO quiz_attempts(id,user_id,course_id,attempt_number,quiz_version,questions_json,submitted_at,score,passed) VALUES('qa-cert','coupon-a','course-4',1,1,'[]',unixepoch(),90,1)").run();
db.prepare("INSERT INTO certificates(id,user_id,course_id,learner_name,course_title,completed_at) VALUES('11111111-2222-4333-8444-555555555555','coupon-a','course-4','coupon-a','Course 4',CURRENT_TIMESTAMP)").run();
cookie=adminCookie;assert.equal((await ok('/api/admin/learners/coupon-a')).certificates[0].id,'11111111-2222-4333-8444-555555555555');
assert.equal((await ok('/api/certificates/11111111-2222-4333-8444-555555555555')).certificate.learner_name,'coupon-a');
await login('nosy');await status('/api/certificates/11111111-2222-4333-8444-555555555555',undefined,404);

// ---------- CPE credits ----------
cookie=adminCookie;let c4=(await ok('/api/admin/courses/course-4')).course;assert.equal(c4.cpe_credits,1);
assert.equal((await ok('/api/courses')).courses.find(c=>c.id==='course-4').cpe_credits,1);
const saveCourse=(credits,rev)=>req('/api/admin/courses/course-4',{title:c4.title,description:c4.description,category:c4.category,course_code:c4.course_code,level:c4.level,published:true,revision:rev,content_type:c4.content_type,access_tier:c4.access_tier,slug:c4.slug,cpe_credits:credits});
for(const bad of [-1,101,1.234,'2',null])assert.equal((await saveCourse(bad,c4.admin_revision)).status,400,'credits '+bad);
assert.equal((await saveCourse(1.5,c4.admin_revision)).status,200);c4=(await ok('/api/admin/courses/course-4')).course;assert.equal(c4.cpe_credits,1.5);
// A new certificate records the course's credits; later changes don't alter it.
db.prepare("INSERT INTO enrollments(user_id,course_id,completed_at) VALUES('coupon-a','course-5',CURRENT_TIMESTAMP)").run();
db.prepare("INSERT INTO quiz_attempts(id,user_id,course_id,attempt_number,quiz_version,questions_json,submitted_at,score,passed) VALUES('qa-c5','coupon-a','course-5',1,1,'[]',unixepoch(),90,1)").run();
db.prepare("UPDATE courses SET cpe_credits=2.5 WHERE id='course-5'").run();
cookie=(await login('coupon-a'));const issued=(await ok('/api/courses/course-5/certificate',{})).certificate;assert.equal(issued.cpe_credits,2.5);
db.prepare("UPDATE courses SET cpe_credits=1 WHERE id='course-5'").run();
assert.equal((await ok('/api/certificates/'+issued.id)).certificate.cpe_credits,2.5);
assert.equal((await ok('/api/account')).certificates.find(c=>c.id===issued.id).cpe_credits,2.5);

// ---------- Article editor starting text ----------
// A guide with no saved article opens in the editor as formatted HTML, so saving keeps headings and lists.
cookie=adminCookie;const guide=(await ok('/api/admin/courses/course-23')).modules.find(m=>m.module_type==='article');
assert.match(guide.body,/^<p>[^<]+<\/p><h2>Build your understanding<\/h2><ul>(<li>[^<]+<\/li>){3}<\/ul><h2>A practical starting exercise<\/h2><p>/);
assert.ok(!guide.body.includes('•'));

// ---------- Receipts ----------
await login('buyer');const buyerCookie=cookie;
db.prepare("INSERT INTO user_profiles(user_id,first_name,last_name,country,organization) VALUES('buyer','Buyer','Person','US','Helping Hands Inc')").run();
const created=await ok('/api/checkout/create',{});assert.equal(created.orderId,'ORDER12345');
assert.deepEqual((await ok('/api/receipts')).receipts,[]);
const sentBefore=emails.length;
const captured=await ok('/api/checkout/capture',{orderId:'ORDER12345'});assert.equal(captured.access,'library');
assert.equal(emails.length,sentBefore+1);const receiptMail=emails.at(-1);assert.equal(receiptMail.to,'buyer@example.invalid');assert.match(receiptMail.subject,/receipt ACPE-/);assert.match(receiptMail.text,/receipt\.html\?id=/);
await ok('/api/checkout/capture',{orderId:'ORDER12345'});assert.equal(emails.length,sentBefore+1,'A retried capture must not send a second receipt.');
const receipts=(await ok('/api/receipts')).receipts;assert.equal(receipts.length,1);
assert.match(receipts[0].number,/^ACPE-[0-9A-F]{10}$/);assert.equal(receipts[0].amount,'100.00');assert.equal(receipts[0].currency,'USD');
const detail=(await ok('/api/receipts/'+receipts[0].id)).receipt;
assert.equal(detail.transactionId,'CAPTURE9876');assert.equal(detail.billedTo.organization,'Helping Hands Inc');assert.equal(detail.billedTo.email,'buyer@example.invalid');
assert.ok(detail.accessEnd-detail.accessStart===365*24*3600);
await login('someone-else');await status('/api/receipts/'+receipts[0].id,undefined,404);assert.deepEqual((await ok('/api/receipts')).receipts,[]);
cookie='';await status('/api/receipts',undefined,401);
console.log('PASS: email verification, coupon codes, captions/transcripts and receipts.');
