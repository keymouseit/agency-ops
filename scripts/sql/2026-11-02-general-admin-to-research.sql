-- Replace "Admin" with "Research" in the General group of the morning-plan task type dropdown.
-- Renames the existing row in place, so every role that had Admin now gets Research.
-- Existing tasks saved as 'admin' are untouched and still display as "Admin".
UPDATE "DailyTaskTypeOption"
SET "value" = 'general_research', "label" = 'Research'
WHERE "value" = 'admin' AND "groupLabel" = 'General'
  AND NOT EXISTS (SELECT 1 FROM "DailyTaskTypeOption" WHERE "value" = 'general_research');
