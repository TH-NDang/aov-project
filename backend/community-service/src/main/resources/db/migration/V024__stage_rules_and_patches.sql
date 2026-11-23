-- Stages lose the free-text patchNote; draft rules and patch lines replace it (spec 04, 23/11/2026).
-- No stored stage had a patchNote when this ran, so removing the key loses nothing.
CREATE FUNCTION pg_temp.without_patch_note(plan jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN jsonb_typeof(plan -> 'stages') = 'array' THEN jsonb_set(plan, '{stages}',
            (SELECT coalesce(jsonb_agg(stage - 'patchNote' ORDER BY position), '[]'::jsonb)
             FROM jsonb_array_elements(plan -> 'stages') WITH ORDINALITY AS item(stage, position)))
        ELSE plan
    END
$$;

UPDATE tournament.competition_plan
SET content = pg_temp.without_patch_note(content)
WHERE content -> 'stages' @? '$[*] ? (exists(@.patchNote))';

UPDATE tournament.competition_plan
SET published_snapshot = jsonb_set(published_snapshot, '{plan}', pg_temp.without_patch_note(published_snapshot -> 'plan'))
WHERE published_snapshot -> 'plan' -> 'stages' @? '$[*] ? (exists(@.patchNote))';
