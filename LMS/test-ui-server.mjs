// Isolated localhost-only UI fixture. Uses in-memory data; never connects to D1 or PayPal.
// Run after node LMS/build.cjs. Only allowlisted dist files are served.
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {readFileSync,readdirSync,existsSync,statSync,createReadStream} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import worker from './dist/_worker.js';
import {MemoryBucket} from './test-r2.mjs';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const f of ['schema.sql','migrations/0001_auth_progress.sql','migrations/0002_playback.sql','migrations/0003_paid_access.sql','migrations/0004_checkout.sql','migrations/0005_profiles_iolta.sql','seed-courses.sql','catalog-metadata.sql','migrations/0006_topic_library.sql','migrations/0007_course_tests.sql','migrations/0008_admin_activities.sql'])db.exec(readFileSync(new URL(f,import.meta.url),'utf8'));
db.exec(readFileSync(new URL('migrations/0009_video_sources.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('migrations/0010_accounts_course_trash.sql',import.meta.url),'utf8'));
db.exec(`INSERT INTO users(id,email,name,email_verified_at) VALUES('ui-fixture','local-only@example.invalid','Local Test Learner',unixepoch());
INSERT INTO admins(user_id) VALUES('ui-fixture');
INSERT INTO course_access(id,user_id,payment_reference) VALUES('local-access','ui-fixture','local-only');
INSERT INTO enrollments(user_id,course_id) SELECT 'ui-fixture',id FROM courses WHERE asset_key IS NOT NULL AND duration_seconds>0;
INSERT INTO course_progress(user_id,course_id,watched_seconds,watched_ranges) SELECT 'ui-fixture',id,duration_seconds*.96,json_array(json_array(0,duration_seconds*.96)) FROM courses WHERE asset_key IS NOT NULL AND duration_seconds>0;`);
const token=crypto.randomUUID().replaceAll('-','').repeat(2),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').run(hash,'ui-fixture');
// Obvious synthetic questions intentionally make UI pass/fail testing reproducible.
const questions=Array.from({length:10},(_,i)=>({prompt:`Local UI fixture ${i+1}: choose the correct test option.`,options:['Correct test option','Incorrect test option','Another incorrect option'],correct:0}));
db.prepare('INSERT INTO course_quizzes(course_id,version,questions_json,published) SELECT id,1,?,1 FROM courses WHERE asset_key IS NOT NULL AND duration_seconds>0').run(JSON.stringify(questions));
for(const f of ['0011_password_reset.sql','0012_annual_library_access.sql','0013_multiple_course_activities.sql','0014_unified_learning_items.sql'])db.exec(readFileSync(new URL('migrations/'+f,import.meta.url),'utf8'));
for(const f of readdirSync(new URL('migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')&&Number(f.slice(0,4))>14).sort())db.exec(readFileSync(new URL('migrations/'+f,import.meta.url),'utf8'));
function statement(sql,args=[]){return {bind(...a){return statement(sql,a);},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}};}};}
const root=resolve('LMS/dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.txt':'text/plain'};
const env={COURSE_STORAGE:new MemoryBucket(),DB:{prepare:statement,async batch(items){db.exec('BEGIN');try{const result=[];for(const item of items)result.push(await item.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},ASSETS:{fetch(request){let p=resolve(root,'.'+decodeURIComponent(new URL(request.url).pathname));if(!p.startsWith(root+sep)&&p!==root)return new Response('Not found',{status:404});if(!existsSync(p)&&existsSync(p+'.html'))p+='.html';if(existsSync(p)&&statSync(p).isDirectory())p=resolve(p,'index.html');if(!existsSync(p)||!types[extname(p)])return new Response('Not found',{status:404});return new Response(readFileSync(p),{headers:{'Content-Type':types[extname(p)]}});}}};
createServer(async(req,res)=>{try{
 if(req.headers.host!=='127.0.0.1:8791'){res.writeHead(403).end();return;}
 const url='http://127.0.0.1:8791'+req.url;
 if(new URL(url).pathname==='/api/courses/course-4/video'){
  const p=resolve('LMS/Courses/course 4.mp4');if(!existsSync(p)){res.writeHead(404).end();return;}
  const size=statSync(p).size,range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||''),start=range?Number(range[1]):0,end=range&&range[2]?Math.min(size-1,Number(range[2])):size-1;
  res.writeHead(range?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});createReadStream(p,{start,end}).pipe(res);return;
 }
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const r=await worker.fetch(new Request(url,{method:req.method,headers:{...req.headers,cookie:'acpe_session='+token},...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env);
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
}catch(e){console.error(e.message);res.writeHead(500).end('Local preview failed');}}).listen(8791,'127.0.0.1',()=>console.log('Local-only assessment UI fixture: http://127.0.0.1:8791/LMS/ (synthetic learner; no production writes)'));
