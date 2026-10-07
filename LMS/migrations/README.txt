Future incremental D1 migrations belong here as numbered SQL files.
The initial schema is ../schema.sql and has already been applied remotely.
0001_auth_progress.sql adds password hashes, expiring sessions, course progress,
case-insensitive unique emails, and one certificate per completed course.
Passwords must be hashed by the backend; this schema does not implement login.
Apply the baseline schema.sql first on a fresh database, then use migrations apply.
Do not execute numbered migrations manually: Wrangler tracks which have run.
The unique indexes intentionally fail if existing duplicate records need review.
0011_password_reset.sql adds expiring, single-use password-reset token storage.
0012_annual_library_access.sql gives existing library grants one year from grant.
0013_multiple_course_activities.sql allows multiple Lumi activities per course.
0014_unified_learning_items.sql adds course/article content metadata, module
selection and publication flags, and Free/Course Pack access. It seeds module
settings for the existing catalog and adds the four current article entries while
preserving learner progress, quiz, activity, payment, and certificate records.
