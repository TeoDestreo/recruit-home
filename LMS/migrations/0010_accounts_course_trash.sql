ALTER TABLE courses ADD COLUMN deleted_at INTEGER;
CREATE INDEX courses_trash ON courses(deleted_at,published);
