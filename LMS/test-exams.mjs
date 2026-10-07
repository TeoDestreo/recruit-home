import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from './src/index.js';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const f of ['schema.sql','migrations/0001_auth_progress.sql','migrations/0002_playback.sql','migrations/0003_paid_access.sql','migrations/0004_checkout.sql','migrations/0005_profiles_iolta.sql','seed-courses.sql','catalog-metadata.sql','migrations/0006_topic_library.sql'])db.exec(readFileSync(new URL(f,import.meta.url),'utf8'));
// Verify the migration preserves issued certificates but clears unissued old completions.
db.exec(`INSERT INTO users(id,email,name) VALUES('legacy','legacy@example.invalid','Legacy learner');
 INSERT INTO enrollments(user_id,course_id,completed_at) VALUES('legacy','course-4',CURRENT_TIMESTAMP),('legacy','course-5',CURRENT_TIMESTAMP);
 INSERT INTO certificates(id,user_id,course_id,learner_name,course_title,completed_at) VALUES('00000000-0000-4000-8000-000000000001','legacy','course-4','Legacy learner','Legacy title',CURRENT_TIMESTAMP);`);
db.exec(readFileSync(new URL('migrations/0007_course_tests.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('migrations/0008_admin_activities.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('migrations/0009_video_sources.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('migrations/0010_accounts_course_trash.sql',import.meta.url),'utf8'));
assert.ok(db.prepare("SELECT completed_at FROM enrollments WHERE course_id='course-4'").get().completed_at);
assert.equal(db.prepare("SELECT completed_at FROM enrollments WHERE course_id='course-5'").get().completed_at,null);
const questions=Array.from({length:10},(_,i)=>({prompt:`Fixture concept ${i+1}?`,options:[`Correct fixture ${i}`,`Wrong fixture ${i}`,`Another wrong fixture ${i}`],correct:0}));
for(let i=4;i<=16;i++)db.prepare('INSERT INTO course_quizzes(course_id,version,questions_json,published) VALUES(?,1,?,1)').run('course-'+i,JSON.stringify(questions));
for(const f of ['0011_password_reset.sql','0012_annual_library_access.sql','0013_multiple_course_activities.sql','0014_unified_learning_items.sql'])db.exec(readFileSync(new URL('migrations/'+f,import.meta.url),'utf8'));
for(const f of readdirSync(new URL('migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')&&Number(f.slice(0,4))>14).sort())db.exec(readFileSync(new URL('migrations/'+f,import.meta.url),'utf8'));
function statement(sql,args=[]){return {bind(...values){return statement(sql,values);},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}};}};}
const env={DB:{prepare:statement,async batch(items){db.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}},ASSETS:{fetch(){return new Response('asset');}}};
const hash=async v=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))).toString('hex');
let cookie='';
async function login(id){db.prepare('INSERT OR IGNORE INTO users(id,email,name,email_verified_at) VALUES(?,?,?,unixepoch())').run(id,id+'@example.invalid',id);const token=crypto.randomUUID().replaceAll('-','').repeat(2);db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').run(await hash(token),id);cookie='__Host-acpe_session='+token;}
async function req(path,data,headers={}){return worker.fetch(new Request('https://lms.test/api'+path,{method:data===undefined?'GET':'POST',headers:{Origin:'https://lms.test',Cookie:cookie,...headers,...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})}),env);}
async function json(path,data){const r=await req(path,data);assert.equal(r.status,200,await r.clone().text());return r.json();}
function grant(id){db.prepare('INSERT INTO course_access(id,user_id,payment_reference) VALUES(?,?,?)').run(id,id,'fixture-'+id);}
async function watched(id,course='course-4'){await json(`/courses/${course}/start`,{});db.prepare('UPDATE course_progress SET watched_seconds=(SELECT duration_seconds*.96 FROM courses WHERE id=?) WHERE user_id=? AND course_id=?').run(course,id,course);}
function answers(attemptId,correctCount){const qs=JSON.parse(db.prepare('SELECT questions_json FROM quiz_attempts WHERE id=?').get(attemptId).questions_json);return qs.map((q,i)=>i<correctCount?q.correct:(q.correct+1)%q.options.length);}
const path='/courses/course-4/test';
assert.equal((await req(path)).status,401);assert.equal((await req(path+'/start',{})).status,401);assert.equal((await req(path+'/submit',{})).status,401);
await login('payer');assert.equal((await req(path)).status,402);assert.equal((await req(path+'/start',{})).status,402);grant('payer');
assert.equal((await req(path+'/start',{})).status,403);assert.equal((await req(path+'/start',{}, {Origin:'https://evil.test'})).status,403);
assert.equal((await req('/courses/course-1/test/start',{})).status,404);
assert.equal((await req(path+'/start')).status,405);assert.equal((await req(path,{})).status,405);
await watched('payer');assert.equal((await req('/courses/course-4/certificate',{})).status,403);
let attempt=await json(path+'/start',{});
assert.equal(attempt.questions.length,10);assert.equal(attempt.attemptNumber,1);
assert.ok(attempt.questions.every(q=>Object.keys(q).sort().join(',')==='options,prompt'));
assert.equal(attempt.status.attemptsUsed,0);assert.equal(attempt.status.attemptsRemaining,3);
assert.deepEqual(await json(path+'/start',{}),attempt);
assert.equal((await req(path+'/submit',{attemptId:attempt.attemptId,answers:[0]})).status,400);
assert.equal((await req(path+'/submit',{attemptId:attempt.attemptId,answers:Array(10).fill(-1)})).status,400);
assert.equal((await req(path+'/submit',{attemptId:attempt.attemptId,answers:Array(10).fill('0')})).status,400);
assert.equal((await json(path)).attemptsUsed,0);
const ownerCookie=cookie;await login('other');grant('other');
assert.equal((await req(path+'/submit',{attemptId:attempt.attemptId,answers:Array(10).fill(0)})).status,404);
cookie=ownerCookie;
let result=await json(path+'/submit',{attemptId:attempt.attemptId,answers:answers(attempt.attemptId,7),score:100,passed:true});
assert.equal(result.score,70);assert.equal(result.passed,false);assert.equal(result.status.attemptsRemaining,2);
assert.ok(!('answers' in result)&&!('questions' in result)&&!('correct' in result));
assert.equal((await req('/courses/course-4/certificate',{})).status,403);
// A repeated submission cannot alter the score or consume another attempt.
assert.deepEqual(await json(path+'/submit',{attemptId:attempt.attemptId,answers:answers(attempt.attemptId,10)}),result);
assert.throws(()=>db.prepare('UPDATE quiz_attempts SET score=100,passed=1 WHERE id=?').run(attempt.attemptId),/cannot be changed/);
assert.ok(!db.prepare('PRAGMA table_info(quiz_attempts)').all().some(c=>c.name==='answers'));
await login('payer');assert.equal((await json(path)).attemptsRemaining,2);
attempt=await json(path+'/start',{});assert.equal(attempt.attemptNumber,2);
// Updating the bank does not change a started test's grading snapshot.
db.exec("UPDATE course_quizzes SET version=2,questions_json='[]' WHERE course_id='course-4'");
assert.deepEqual(await json(path+'/start',{}),attempt);
result=await json(path+'/submit',{attemptId:attempt.attemptId,answers:answers(attempt.attemptId,8)});
assert.equal(result.score,80);assert.equal(result.passed,true);assert.ok(result.status.certificateId);
assert.equal(db.prepare("SELECT COUNT(*) n FROM certificates WHERE user_id='payer'").get().n,1);
assert.ok(db.prepare("SELECT completed_at FROM enrollments WHERE user_id='payer'").get().completed_at);
assert.equal((await req(path+'/start',{})).status,409);
assert.deepEqual(await json(path+'/submit',{attemptId:attempt.attemptId,answers:[]}),result);
const certificate=await json('/courses/course-4/certificate',{});assert.equal(certificate.certificate.id,result.status.certificateId);
db.exec("UPDATE course_access SET revoked_at=unixepoch() WHERE user_id='payer'");
assert.equal((await req(path)).status,402);assert.equal((await req(path+'/submit',{attemptId:attempt.attemptId})).status,402);
assert.equal((await req('/certificates/'+result.status.certificateId)).status,200);
db.prepare("UPDATE course_quizzes SET version=1,questions_json=? WHERE course_id='course-4'").run(JSON.stringify(questions));
await login('fails');grant('fails');await watched('fails');
for(let n=1;n<=3;n++){
 const a=await json(path+'/start',{});assert.equal(a.attemptNumber,n);
 const r=await json(path+'/submit',{attemptId:a.attemptId,answers:answers(a.attemptId,7)});assert.equal(r.passed,false);assert.equal(r.status.attemptsRemaining,3-n);
}
await login('fails');assert.equal((await json(path)).attemptsRemaining,0);assert.equal((await req(path+'/start',{})).status,403);
assert.equal((await req('/courses/course-4/certificate',{})).status,403);
assert.equal(db.prepare("SELECT COUNT(*) n FROM quiz_attempts WHERE user_id='fails'").get().n,3);
// Limits are per course, not a single library-wide counter.
await watched('fails','course-5');assert.equal((await json('/courses/course-5/test/start',{})).attemptNumber,1);
await login('concurrent');grant('concurrent');await watched('concurrent');
const parallelStarts=await Promise.all([json(path+'/start',{}),json(path+'/start',{})]);
assert.equal(parallelStarts[0].attemptId,parallelStarts[1].attemptId);
attempt=parallelStarts[0];
const parallelResults=await Promise.all([json(path+'/submit',{attemptId:attempt.attemptId,answers:answers(attempt.attemptId,7)}),json(path+'/submit',{attemptId:attempt.attemptId,answers:answers(attempt.attemptId,10)})]);
assert.equal(parallelResults[0].score,parallelResults[1].score);assert.equal((await json(path)).attemptsUsed,1);
// A completed enrollment alone cannot bypass the DB certificate gate.
db.exec("UPDATE enrollments SET completed_at=CURRENT_TIMESTAMP WHERE user_id='fails' AND course_id='course-4'");
assert.throws(()=>db.exec("INSERT INTO certificates(id,user_id,course_id,learner_name,course_title,completed_at) VALUES('invalid','fails','course-4','Fails','Fixture',CURRENT_TIMESTAMP)"),/passing test/);
await login('legacy');assert.equal((await req('/certificates/00000000-0000-4000-8000-000000000001')).status,200);
grant('legacy');assert.equal((await req(path+'/start',{})).status,409);
// Every video exposes a safe ten-question test once its viewing requirement is met.
await login('all-courses');grant('all-courses');
for(let i=4;i<=16;i++){await watched('all-courses','course-'+i);const a=await json(`/courses/course-${i}/test/start`,{});assert.equal(a.questions.length,10);assert.ok(a.questions.every(q=>!('correct' in q)));}
assert.equal(db.prepare('SELECT count(*) n FROM course_quizzes WHERE published=1').get().n,13);
console.log('PASS: 13 course tests, watch/access/CSRF gates, private keys, incomplete submissions, 70% fail/80% pass, three-attempt lockout, per-course limits, ownership, reload persistence, frozen grading, retries/concurrency, certificate issuance and legacy preservation.');
db.close();
