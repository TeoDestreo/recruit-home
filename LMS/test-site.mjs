import {readdirSync,readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('LMS/dist');
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
const pages=walk(root).filter(f=>f.endsWith('.html'));
assert.ok(!existsSync(join(root,'LMS/private')),'Private answer bank must never enter the static build.');
assert.ok(!walk(root).some(f=>/quiz-bank|quiz-seed|test-exams|prepare-tests/.test(f)));
for(const f of ['LMS/index.html','certificates/index.html','how-it-works/index.html','faq/index.html'])assert.ok(readFileSync(join(root,f),'utf8').includes('70%'),f+' must explain the test threshold');
for(const file of pages){
 const html=readFileSync(file,'utf8');assert.ok(!/coming[ -]soon/i.test(html),file);assert.ok(html.includes('favicon.svg'),file);
 for(const [,link] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(/^(https?:|tel:|mailto:|#)/.test(link))continue;
  const path=link.split(/[?#]/)[0];if(!path)continue;
  const target=['/LMS/admin','/LMS/account'].includes(path)?join(root,path+'.html'):path.startsWith('/')?join(root,path):resolve(dirname(file),path);
  assert.ok(existsSync(target),'Missing local target '+link+' in '+file);
  if(statSync(target).isDirectory())assert.ok(existsSync(join(target,'index.html')),target);
 }
}
console.log('PASS: '+pages.length+' built pages, all local links/assets, favicon, and no unfinished-course notices.');
