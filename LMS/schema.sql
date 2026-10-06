-- Initial schema already applied to remote D1. Future changes belong in migrations/.
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, level TEXT NOT NULL, hours REAL NOT NULL, asset_key TEXT, published INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS enrollments (user_id TEXT NOT NULL, course_id TEXT NOT NULL, enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, PRIMARY KEY (user_id, course_id), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id));
CREATE TABLE IF NOT EXISTS certificates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id));
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
