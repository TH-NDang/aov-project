-- Every market shares the default ruleset for its whole history (02-DATABASE, section 23). A market set up before
-- that convention starts its first assignment on the day it was set up, so the release check rejects the dates of
-- older patches. Its first assignment now starts at the shared origin instead; later assignments stay as they are.
UPDATE patch.region_ruleset_assignment assignment
SET valid_from = TIMESTAMPTZ '2000-01-01 00:00:00+00'
WHERE assignment.valid_from > TIMESTAMPTZ '2000-01-01 00:00:00+00'
  AND NOT EXISTS (
    SELECT 1
    FROM patch.region_ruleset_assignment earlier
    WHERE earlier.region_id = assignment.region_id
      AND earlier.valid_from < assignment.valid_from
  );
