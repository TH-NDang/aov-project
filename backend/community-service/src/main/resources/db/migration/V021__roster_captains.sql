-- A team roster member whose role marks a captain as a word of its own, in Vietnamese or English, gets the captain
-- flag (spec 04, captain); readers stop searching the role text. The role wording stays.
CREATE FUNCTION community.captain_role(role text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT tournament.normalize_reference_search(coalesce(role, '')) ~ '(^|[[:space:]·|])(doi truong|captain)($|[[:space:]·|])'
$$;

CREATE FUNCTION community.captained_roster(content jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN jsonb_typeof(content -> 'roster') = 'array' AND jsonb_array_length(content -> 'roster') > 0
        THEN jsonb_set(content, '{roster}', (
            SELECT jsonb_agg(CASE WHEN community.captain_role(item.member ->> 'role')
                                  THEN item.member || '{"captain": true}'::jsonb ELSE item.member END
                             ORDER BY item.position)
              FROM jsonb_array_elements(content -> 'roster') WITH ORDINALITY AS item(member, position)))
        ELSE content
    END
$$;

UPDATE community.page
   SET content = community.captained_roster(content),
       published_content = CASE WHEN published_content IS NULL THEN NULL
                                ELSE community.captained_roster(published_content) END
 WHERE kind = 'TEAM';

DROP FUNCTION community.captained_roster(jsonb);
DROP FUNCTION community.captain_role(text);
