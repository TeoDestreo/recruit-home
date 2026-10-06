ALTER TABLE courses ADD COLUMN course_code TEXT;
ALTER TABLE courses ADD COLUMN topic_path TEXT;
UPDATE courses SET course_code='NFP-'||(100+CAST(substr(id,8) AS INTEGER)) WHERE CAST(substr(id,8) AS INTEGER) BETWEEN 1 AND 16;
UPDATE courses SET course_code='LAW-'||(84+CAST(substr(id,8) AS INTEGER)) WHERE CAST(substr(id,8) AS INTEGER) BETWEEN 17 AND 20;
UPDATE courses SET topic_path='/topics/nonprofit-foundations/',description='Explore nonprofit accounting vocabulary, reporting responsibilities, and a practical learning path.' WHERE id='course-1';
UPDATE courses SET topic_path='/topics/nonprofit-systems/',description='Explore the tools and workflows behind a nonprofit finance system.' WHERE id='course-2';
UPDATE courses SET topic_path='/topics/income-donations/',description='Explore income documentation, donation records, and receivables workflows.' WHERE id='course-3';
UPDATE courses SET topic_path='/topics/trust-foundations/',description='Explore client trust accounting terminology, account separation, and jurisdiction-specific reference sources.' WHERE id='course-17';
UPDATE courses SET topic_path='/topics/client-ledgers/',description='Explore client and matter records, transaction documentation, and ledger review.' WHERE id='course-18';
UPDATE courses SET topic_path='/topics/trust-reconciliation/',description='Explore the relationship between bank statements, the trust register, and client ledgers.' WHERE id='course-19';
UPDATE courses SET topic_path='/topics/trust-controls/',description='Explore review responsibilities, documentation, and safeguards for client-fund records.' WHERE id='course-20';
INSERT INTO courses(id,title,description,category,level,hours,asset_key,published,duration_seconds,course_code,topic_path) VALUES
('course-21','Law Firm Bookkeeping & Account Structure','Organize operating accounts, matter records, and reporting responsibilities.','Law Firm & IOLTA Accounting','Introductory',0,NULL,1,0,'LAW-105','/topics/law-firm-bookkeeping/'),
('course-22','Fees, Retainers & Billing Workflows','Explore billing documentation and questions to resolve before moving client funds.','Law Firm & IOLTA Accounting','Introductory',0,NULL,1,0,'LAW-106','/topics/fees-retainers/'),
('course-23','Client Costs & Reimbursements','Connect matter-level expenses, approvals, and supporting documents.','Law Firm & IOLTA Accounting','Introductory',0,NULL,1,0,'LAW-107','/topics/client-costs/'),
('course-24','Receivables & Collections','Build an organized view of invoices, payment status, and follow-up ownership.','Law Firm & IOLTA Accounting','Introductory',0,NULL,1,0,'LAW-108','/topics/legal-receivables/'),
('course-25','Payment Processing & Exceptions','Map payment channels, fees, disputed payments, and review responsibilities.','Law Firm & IOLTA Accounting','Intermediate',0,NULL,1,0,'LAW-109','/topics/legal-payments/'),
('course-26','Month-End Close for Law Firms','Build a repeatable close checklist with documented reviews and open items.','Law Firm & IOLTA Accounting','Intermediate',0,NULL,1,0,'LAW-110','/topics/law-firm-close/'),
('course-27','Law Firm Financial Reporting','Connect financial reports, matter information, and management questions.','Law Firm & IOLTA Accounting','Intermediate',0,NULL,1,0,'LAW-111','/topics/law-firm-reporting/'),
('course-28','Accounting Systems & Data Handoffs','Plan permissions, migrations, and handoffs between billing and accounting tools.','Law Firm & IOLTA Accounting','Intermediate',0,NULL,1,0,'LAW-112','/topics/legal-systems/');
CREATE UNIQUE INDEX courses_code ON courses(course_code);
