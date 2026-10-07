ALTER TABLE courses ADD COLUMN content_type TEXT NOT NULL DEFAULT 'course' CHECK(content_type IN('course','guide','article'));
ALTER TABLE courses ADD COLUMN access_tier TEXT NOT NULL DEFAULT 'course_pack' CHECK(access_tier IN('free','course_pack'));
ALTER TABLE courses ADD COLUMN slug TEXT;

UPDATE courses SET content_type='guide',access_tier='free',slug=trim(replace(replace(topic_path,'/topics/',''),'/',''))
WHERE topic_path IS NOT NULL;

CREATE TABLE learning_modules (
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK(module_type IN('test','video','article','lumi')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN(0,1)),
  body TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(course_id,module_type)
);

INSERT INTO learning_modules(course_id,module_type,enabled,published,position)
SELECT id,'video',1,CASE WHEN asset_key IS NOT NULL OR youtube_id IS NOT NULL THEN 1 ELSE 0 END,1 FROM courses WHERE topic_path IS NULL;
INSERT INTO learning_modules(course_id,module_type,enabled,published,position)
SELECT c.id,'test',1,CASE WHEN q.published=1 THEN 1 ELSE 0 END,2 FROM courses c LEFT JOIN course_quizzes q ON q.course_id=c.id WHERE c.topic_path IS NULL;
INSERT INTO learning_modules(course_id,module_type,enabled,published,position)
SELECT id,'article',1,1,1 FROM courses WHERE topic_path IS NOT NULL;
INSERT INTO learning_modules(course_id,module_type,enabled,published,position)
SELECT DISTINCT c.id,'lumi',1,1,3 FROM courses c JOIN course_activities a ON a.course_id=c.id JOIN activity_packages p ON p.id=a.package_id AND p.status='ready';

CREATE INDEX learning_modules_published ON learning_modules(module_type,published,course_id);
CREATE UNIQUE INDEX courses_slug_unique ON courses(slug) WHERE slug IS NOT NULL;

INSERT INTO courses(id,title,description,category,level,hours,published,duration_seconds,course_code,topic_path,content_type,access_tier,slug) VALUES
('article-a-better-month-end-checklist','A better month-end checklist starts with ownership','A practical way to turn a list of tasks into a repeatable review process.','Practice notes','Foundational',0,1,0,'ART-101','/articles/a-better-month-end-checklist/','article','free','a-better-month-end-checklist'),
('article-three-views-of-client-funds','Three views of client funds—and why they matter','An introduction to the records behind a three-way reconciliation.','Law firm accounting','Foundational',0,1,0,'ART-102','/articles/three-views-of-client-funds/','article','free','three-views-of-client-funds'),
('article-organize-a-finance-document-library','A finance document library people can actually use','Simple naming and ownership choices that make records easier to find.','Practice notes','Foundational',0,1,0,'ART-103','/articles/organize-a-finance-document-library/','article','free','organize-a-finance-document-library'),
('article-choose-your-learning-path','Choose a learning path that fits your work','A focused starting point for nonprofit teams, bookkeepers, and law-firm staff.','Learning guide','Foundational',0,1,0,'ART-104','/articles/choose-your-learning-path/','article','free','choose-your-learning-path');
INSERT INTO learning_modules(course_id,module_type,enabled,published,body,position)
SELECT id,'article',1,1,'',1 FROM courses WHERE content_type='article';
