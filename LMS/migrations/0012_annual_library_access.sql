UPDATE course_access
SET expires_at=granted_at+31536000
WHERE course_id IS NULL AND expires_at IS NULL;
