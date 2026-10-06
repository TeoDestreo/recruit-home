// Produces private SQL for D1. Neither the bank nor generated SQL is deployed or committed.
const {writeFileSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const bank=require('./private/quiz-bank.cjs');
assert.deepEqual(bank.map(x=>x.courseId).sort(),Array.from({length:13},(_,i)=>'course-'+(i+4)).sort());
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const statements=bank.map(course=>{
 assert.ok(Number.isInteger(course.version)&&course.version>0);
 assert.equal(course.questions.length,10,course.courseId);
 assert.equal(new Set(course.questions.map(q=>q.prompt)).size,10);
 for(const q of course.questions){
  assert.ok(typeof q.prompt==='string'&&q.prompt.length>15);
  assert.ok(q.options.length>=3&&q.options.every(x=>typeof x==='string'&&x.length>0));
  assert.equal(new Set(q.options).size,q.options.length);
  assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<q.options.length);
 }
 return `INSERT INTO course_quizzes(course_id,version,questions_json,published) VALUES(${quote(course.courseId)},${course.version},${quote(JSON.stringify(course.questions))},1) ON CONFLICT(course_id) DO UPDATE SET version=excluded.version,questions_json=excluded.questions_json,published=1;`;
});
writeFileSync(join(__dirname,'private/quiz-seed.sql'),statements.join('\n')+'\n');
console.log('Validated 13 private course tests / 130 questions; prepared LMS/private/quiz-seed.sql.');
