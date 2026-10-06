CREATE TABLE IF NOT EXISTS user_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 first_name TEXT NOT NULL,
 last_name TEXT NOT NULL,
 organization TEXT NOT NULL DEFAULT '',
 job_title TEXT NOT NULL DEFAULT '',
 city TEXT NOT NULL DEFAULT '',
 region TEXT NOT NULL DEFAULT '',
 country TEXT NOT NULL DEFAULT '',
 designation TEXT NOT NULL DEFAULT '',
 license_number TEXT NOT NULL DEFAULT '',
 license_region TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '',
 marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK(marketing_opt_in IN (0,1)),
 marketing_consent_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO courses(id,title,description,category,level,hours,asset_key,published,duration_seconds) VALUES
('course-17','IOLTA & Client Trust Accounting Foundations','Planned course: understand the purpose of IOLTA, client trust funds, operating accounts, and the importance of jurisdiction-specific rules. Coursework is in development.','Law Firm & IOLTA Accounting','Introductory',0,NULL,1,0),
('course-18','Client Ledgers, Deposits & Disbursements','Planned course: organize matter-level ledgers, record deposits and disbursements, and document movements of client funds. Coursework is in development.','Law Firm & IOLTA Accounting','Introductory',0,NULL,1,0),
('course-19','Three-Way Trust Account Reconciliation','Planned course: compare bank records, the trust-account register, and individual client ledgers; investigate differences with a documented review process. Coursework is in development.','Law Firm & IOLTA Accounting','Intermediate',0,NULL,1,0),
('course-20','Trust Accounting Controls & Recordkeeping','Planned course: develop review workflows, supporting records, and safeguards for law-firm trust accounting. Requirements vary by jurisdiction. Coursework is in development.','Law Firm & IOLTA Accounting','Intermediate',0,NULL,1,0);
