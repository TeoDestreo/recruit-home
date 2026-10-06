// In-memory checks only. Run: node LMS/migrations/verify.cjs
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync(join(__dirname, '../schema.sql'), 'utf8'));
db.exec(readFileSync(join(__dirname, '0001_auth_progress.sql'), 'utf8'));
db.exec(`INSERT INTO users (id,email,name) VALUES ('u','learner@example.com','Learner');
INSERT INTO courses (id,title,description,category,level,hours)
VALUES ('c','Course','Description','General','Basic',1);
INSERT INTO enrollments (user_id,course_id) VALUES ('u','c');`);
assert.throws(() => db.exec("INSERT INTO users (id,email,name) VALUES ('other','LEARNER@example.com','Other')"), /UNIQUE/);
assert.throws(() => db.exec("INSERT INTO certificates (id,user_id,course_id) VALUES ('cert','u','c')"), /completion is required/);
assert.throws(() => db.exec("INSERT INTO course_progress (user_id,course_id,position_seconds) VALUES ('u','c',-1)"), /CHECK/);
assert.throws(() => db.exec("INSERT INTO course_progress (user_id,course_id) VALUES ('missing','c')"), /FOREIGN KEY/);
db.exec("INSERT INTO course_progress (user_id,course_id,position_seconds,watched_seconds) VALUES ('u','c',30,20)");
assert.equal(db.prepare('SELECT position_seconds FROM course_progress').get().position_seconds, 30);
db.exec("UPDATE enrollments SET completed_at=CURRENT_TIMESTAMP WHERE user_id='u' AND course_id='c'");
db.exec("INSERT INTO certificates (id,user_id,course_id) VALUES ('cert','u','c')");
assert.throws(() => db.exec("INSERT INTO certificates (id,user_id,course_id) VALUES ('cert2','u','c')"), /UNIQUE/);
assert.throws(() => db.exec("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES ('hash','u',100,50)"), /CHECK/);
db.exec("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES ('hash','u',100,200)");
db.close();
console.log('PASS: migration, unique emails, sessions, progress, foreign keys, completion requirement, and unique certificates.');
