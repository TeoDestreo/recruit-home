ALTER TABLE course_activities RENAME TO course_activities_legacy;

CREATE TABLE course_activities (
  course_id TEXT NOT NULL REFERENCES courses(id),
  package_id TEXT NOT NULL REFERENCES activity_packages(id),
  required INTEGER NOT NULL DEFAULT 0 CHECK(required IN(0,1)),
  PRIMARY KEY(course_id,package_id)
);

INSERT INTO course_activities(course_id,package_id,required)
SELECT course_id,package_id,required FROM course_activities_legacy;

DROP TABLE course_activities_legacy;
CREATE INDEX course_activities_package ON course_activities(package_id);
