-- Names the schedule generators and Admin wrote become structured titles each reader words in its own language
-- (spec 04, match titles). Only a name that equals a generated pattern changes, in plan drafts and in series; plan
-- revisions and published snapshots stay as they were.
CREATE FUNCTION tournament.generated_match_title(name text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN name ~ '^Lượt [1-9][0-9]? · Vòng [1-9][0-9]?$' THEN jsonb_build_object('kind', 'ROUND_ROBIN',
            'leg', (regexp_match(name, '^Lượt ([0-9]+)'))[1]::int,
            'round', (regexp_match(name, '([0-9]+)$'))[1]::int)
        WHEN name ~ '^Bán kết nhánh thắng [1-9][0-9]?$' THEN jsonb_build_object('kind', 'UPPER_SEMIFINAL',
            'number', (regexp_match(name, '([0-9]+)$'))[1]::int)
        WHEN name ~ '^Vòng [1-9][0-9]? nhánh thua · [1-9][0-9]?$' THEN jsonb_build_object('kind', 'LOWER_ROUND',
            'round', (regexp_match(name, '^Vòng ([0-9]+)'))[1]::int,
            'number', (regexp_match(name, '([0-9]+)$'))[1]::int)
        WHEN name = 'Chung kết nhánh thắng' THEN jsonb_build_object('kind', 'UPPER_FINAL')
        WHEN name = 'Bán kết nhánh thua' THEN jsonb_build_object('kind', 'LOWER_SEMIFINAL')
        WHEN name = 'Chung kết nhánh thua' THEN jsonb_build_object('kind', 'LOWER_FINAL')
        WHEN name = 'Chung kết tổng' THEN jsonb_build_object('kind', 'GRAND_FINAL')
        WHEN name = 'Trận bổ sung' THEN jsonb_build_object('kind', 'EXTRA')
    END
$$;

-- An open slot Admin named after its side by default keeps no name.
CREATE FUNCTION tournament.unnamed_default_slot(slot jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN slot ->> 'type' = 'TBD' AND slot ->> 'label' IN ('Đội A', 'Đội B') THEN slot - 'label' ELSE slot END
$$;

CREATE FUNCTION tournament.titled_match(match jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
    SELECT (CASE
                WHEN jsonb_typeof(match -> 'title') IS DISTINCT FROM 'object'
                     AND tournament.generated_match_title(match ->> 'label') IS NOT NULL
                THEN (match - 'label')
                    || jsonb_build_object('title', tournament.generated_match_title(match ->> 'label'))
                ELSE match
            END)
        || CASE WHEN match -> 'a' IS NULL THEN '{}'::jsonb
                ELSE jsonb_build_object('a', tournament.unnamed_default_slot(match -> 'a')) END
        || CASE WHEN match -> 'b' IS NULL THEN '{}'::jsonb
                ELSE jsonb_build_object('b', tournament.unnamed_default_slot(match -> 'b')) END
$$;

UPDATE tournament.competition_plan
   SET content = jsonb_set(content, '{matches}', (
           SELECT jsonb_agg(tournament.titled_match(item.match) ORDER BY item.position)
             FROM jsonb_array_elements(content -> 'matches') WITH ORDINALITY AS item(match, position)))
 WHERE jsonb_typeof(content -> 'matches') = 'array'
   AND EXISTS (SELECT 1
                 FROM jsonb_array_elements(content -> 'matches') AS item(match)
                WHERE tournament.titled_match(item.match) <> item.match);

UPDATE tournament.series
   SET content = (content - 'name') || jsonb_build_object('title', tournament.generated_match_title(content ->> 'name')),
       name = NULL
 WHERE jsonb_typeof(content -> 'title') IS DISTINCT FROM 'object'
   AND tournament.generated_match_title(content ->> 'name') IS NOT NULL;

DROP FUNCTION tournament.titled_match(jsonb);
DROP FUNCTION tournament.unnamed_default_slot(jsonb);
DROP FUNCTION tournament.generated_match_title(text);
