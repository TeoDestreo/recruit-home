-- CPE credits for each learning item (default 1), printed on completion certificates.
ALTER TABLE courses ADD COLUMN cpe_credits REAL NOT NULL DEFAULT 1 CHECK (cpe_credits >= 0 AND cpe_credits <= 100);
-- Certificates keep the credit value in effect when they were issued.
ALTER TABLE certificates ADD COLUMN cpe_credits REAL;
UPDATE certificates SET cpe_credits=(SELECT cpe_credits FROM courses WHERE courses.id=certificates.course_id);
