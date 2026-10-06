CREATE TABLE course_quizzes (
 course_id TEXT PRIMARY KEY REFERENCES courses(id),
 version INTEGER NOT NULL CHECK(version>0),
 questions_json TEXT NOT NULL CHECK(json_valid(questions_json)),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1))
);
CREATE TABLE quiz_attempts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 course_id TEXT NOT NULL REFERENCES courses(id),
 attempt_number INTEGER NOT NULL CHECK(attempt_number BETWEEN 1 AND 3),
 quiz_version INTEGER NOT NULL,
 questions_json TEXT NOT NULL CHECK(json_valid(questions_json)),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 submitted_at INTEGER,
 score INTEGER CHECK(score BETWEEN 0 AND 100),
 passed INTEGER CHECK(passed IN (0,1)),
 UNIQUE(user_id,course_id,attempt_number),
 CHECK((submitted_at IS NULL AND score IS NULL AND passed IS NULL) OR
       (submitted_at IS NOT NULL AND score IS NOT NULL AND passed=(score>70)))
);
CREATE INDEX quiz_attempts_owner ON quiz_attempts(user_id,course_id,submitted_at);
CREATE TRIGGER quiz_results_immutable BEFORE UPDATE ON quiz_attempts
WHEN OLD.submitted_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Submitted test results cannot be changed'); END;
CREATE TRIGGER quiz_pass_completes_course AFTER UPDATE OF submitted_at ON quiz_attempts
WHEN NEW.passed=1 AND OLD.submitted_at IS NULL
BEGIN
 UPDATE enrollments SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)
 WHERE user_id=NEW.user_id AND course_id=NEW.course_id;
END;
CREATE TRIGGER certificates_require_test BEFORE INSERT ON certificates
WHEN NOT EXISTS(SELECT 1 FROM quiz_attempts WHERE user_id=NEW.user_id
 AND course_id=NEW.course_id AND passed=1 AND submitted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'A passing test is required for a new certificate'); END;
-- Preserve already issued certificates; viewing progress remains untouched.
UPDATE enrollments SET completed_at=NULL WHERE NOT EXISTS
 (SELECT 1 FROM certificates c WHERE c.user_id=enrollments.user_id AND c.course_id=enrollments.course_id);
