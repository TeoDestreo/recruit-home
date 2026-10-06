// Public smoke checks. Does not bypass Turnstile or grant payment entitlements.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin=process.argv[2];
if(!origin||!/^https:\/\/[a-z0-9.-]+$/.test(origin))throw Error('Supply the deployed HTTPS origin.');
async function request(path,data,headers={}){return fetch(origin+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});}
assert.equal((await request('/')).status,200);
assert.equal((await request('/LMS/')).status,200);
assert.equal((await (await request('/api/health')).json()).ok,true);
const {courses}=await (await request('/api/courses')).json();
assert.ok(Array.isArray(courses));assert.ok(courses.every(c=>typeof c.title==='string'&&typeof c.course_code==='string'));
assert.ok(courses.filter(c=>!c.available).every(c=>c.topic_path?.startsWith('/topics/')));
assert.equal(new Set(courses.map(c=>c.course_code)).size,courses.length);
for(const path of ['/about/','/contact/','/pricing/','/faq/','/how-it-works/','/privacy/','/law-firm-accounting/','/articles/','/learning-paths/','/certificates/','/support/','/LMS/register.html',...courses.filter(c=>!c.available).map(c=>c.topic_path)]){
 const page=await request(path);assert.equal(page.status,200,path);const html=await page.text();assert.ok(html.includes('916-500-0508'),path);assert.ok(!/coming[ -]soon/i.test(html),path);
}
assert.equal((await request('/favicon.svg')).status,200);
assert.equal((await request('/LMS/account')).status,200);
assert.equal((await request('/api/account',{})).status,401);
assert.equal((await request('/assets/learning-desk.png')).status,200);
assert.deepEqual(courses.map(c=>c.category),courses.map(c=>c.category).sort((a,b)=>a.localeCompare(b)));
assert.ok(courses.every(c=>!c.has_access&&!c.watched_seconds&&!('asset_key' in c)));
assert.ok((await (await request('/api/config')).json()).turnstileSiteKey);
const config=await (await request('/api/config')).json();
assert.equal(config.price,'100.00');assert.equal(config.currency,'USD');assert.equal(config.couponAvailable,true);
for(const path of ['/api/checkout/create','/api/checkout/capture','/api/checkout/coupon'])assert.equal((await request(path,{})).status,401);
assert.equal((await request('/api/courses/course-4/video')).status,401);
assert.equal((await request('/api/courses/course-4/start',{})).status,401);
assert.equal((await request('/api/courses/course-4/test')).status,401);
assert.equal((await request('/api/courses/course-4/test/start',{})).status,401);
assert.equal((await request('/api/courses/course-4/test/submit',{})).status,401);
for(const path of ['/api/admin/notes','/api/admin/courses','/api/admin/learners','/api/account'])assert.equal((await request(path)).status,401,path);
for(const path of ['/LMS/admin','/LMS/admin/','/LMS/admin.html']){const r=await fetch(origin+path,{redirect:'manual'});assert.equal(r.status,302,path);assert.ok(r.headers.get('location').includes('login=1'));}
assert.equal((await request('/api/courses/course-4/activity/launch',{})).status,401);
assert.equal((await request('/api/activity-player/'+'0'.repeat(64))).status,403);
const certificateInfo=await (await request('/certificates/')).text();assert.ok(certificateInfo.includes('over 70%')&&certificateInfo.includes('three submitted attempts'));
const signup=await request('/api/auth/register',{email:`rejected-${randomUUID()}@example.invalid`,password:'Test registration must fail',name:'Rejected signup'});
assert.equal(signup.status,400);assert.match((await signup.json()).error,/security check/i);
for(const path of ['/LMS/src/index.js','/LMS/schema.sql','/LMS/wrangler.toml','/_worker.js','/LMS/private/quiz-bank.cjs','/LMS/private/quiz-seed.sql','/LMS/prepare-tests.cjs']){
  const r=await request(path),text=await r.text();assert.ok(r.status===404||(!text.includes('CREATE TABLE')&&!text.includes('passwordHash')&&!text.includes('database_id')&&!text.includes('course_quizzes')&&!text.includes('correct:')&&!text.includes('module.exports')),path);
}
console.log('PASS: public pages, favicon/image, coded course listings and linked reading topics, protected media, signup challenge requirement, and source isolation. No accounts or purchases created.');
