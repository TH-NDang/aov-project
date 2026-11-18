-- Team roster members get their lane and standing as codes (spec 04, roster codes), read once from wording that says
-- so in the ways Admin read it, otherwise from the linked player and the team's latest tournament roster line. The
-- wording stays as it was. Draft and published content of every TEAM page are filled alike.
CREATE FUNCTION community.roster_primary(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT btrim(split_part(regexp_replace(tournament.normalize_reference_search(coalesce(value, '')),
        '\s*[·|]\s*', '·', 'g'), '·', 1))
$$;

CREATE FUNCTION community.roster_lane_from_role(role text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE community.roster_primary(role)
        WHEN 'duong ta than' THEN 'TOP' WHEN 'duong caesar' THEN 'TOP' WHEN 'ta than' THEN 'TOP'
        WHEN 'caesar' THEN 'TOP' WHEN 'top lane' THEN 'TOP' WHEN 'top' THEN 'TOP' WHEN 'slayer' THEN 'TOP'
        WHEN 'di rung' THEN 'JUNGLE' WHEN 'rung' THEN 'JUNGLE' WHEN 'jungle' THEN 'JUNGLE'
        WHEN 'jungler' THEN 'JUNGLE'
        WHEN 'duong giua' THEN 'MID' WHEN 'giua' THEN 'MID' WHEN 'mid' THEN 'MID' WHEN 'middle' THEN 'MID'
        WHEN 'mid lane' THEN 'MID'
        WHEN 'duong rong' THEN 'DRAGON' WHEN 'rong' THEN 'DRAGON' WHEN 'dragon' THEN 'DRAGON'
        WHEN 'bottom lane' THEN 'DRAGON' WHEN 'adc' THEN 'DRAGON'
        WHEN 'tro thu' THEN 'SUPPORT' WHEN 'ho tro' THEN 'SUPPORT' WHEN 'support' THEN 'SUPPORT'
        WHEN 'roamer' THEN 'SUPPORT' WHEN 'roam' THEN 'SUPPORT'
    END
$$;

CREATE FUNCTION community.roster_staff_role(role text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT community.roster_primary(role) ~ '^(chuyen vien )?phan tich doi tuyen$|^(team )?analyst$'
        OR community.roster_primary(role) ~ '^(huan luyen vien|hlv|coach|head coach|assistant coach)(\s|$)'
$$;

-- The standing a status names in its first words, in the order Admin read them: gone, staff, bench, lineup.
CREATE FUNCTION community.roster_standing_from_text(role text, status text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN tournament.normalize_reference_search(coalesce(status, ''))
             ~ '^(da roi doi|da roi|cuu thanh vien|inactive|former)(\s|·|$)' THEN 'LEFT'
        WHEN community.roster_staff_role(role)
             OR tournament.normalize_reference_search(coalesce(status, '')) ~ '^ban huan luyen(\s|·|$)' THEN 'STAFF'
        WHEN tournament.normalize_reference_search(coalesce(status, '')) ~ '^(du bi|substitute|sub)(\s|·|$)'
             THEN 'SUBSTITUTE'
        WHEN tournament.normalize_reference_search(coalesce(status, ''))
             ~ '^(doi hinh chinh|chinh thuc|active|starter)(\s|·|$)' THEN 'ACTIVE'
    END
$$;

-- One roster member of a team page with its codes filled where the wording or the linked player says them.
CREATE FUNCTION community.coded_roster_member(member jsonb, team_entity uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
    WITH person AS (
        SELECT p.entity_id
          FROM community.page p
         WHERE p.kind = 'PLAYER' AND p.id::text = member ->> 'pageId'
    ),
    text_codes AS (
        SELECT community.roster_standing_from_text(member ->> 'role', member ->> 'status') AS standing,
               community.roster_lane_from_role(member ->> 'role') AS lane
    ),
    codes AS (
        SELECT coalesce(t.standing, CASE
                   WHEN btrim(coalesce(member ->> 'status', '')) = '' THEN (
                       SELECT CASE a.status WHEN 'ACTIVE' THEN 'ACTIVE' WHEN 'SUBSTITUTE' THEN 'SUBSTITUTE'
                                            WHEN 'INACTIVE' THEN 'LEFT' END
                         FROM tournament.player_tournament_activity a, person
                        WHERE a.player_id = person.entity_id AND a.team_id = team_entity
                        ORDER BY a.active_on DESC NULLS LAST, a.tournament_id
                        LIMIT 1)
               END) AS standing,
               coalesce(t.lane, CASE
                   WHEN NOT community.roster_staff_role(member ->> 'role') THEN (
                       SELECT pl.content ->> 'lane'
                         FROM tournament.player pl, person
                        WHERE pl.id = person.entity_id
                          AND pl.content ->> 'lane' IN ('TOP', 'JUNGLE', 'MID', 'DRAGON', 'SUPPORT'))
               END) AS lane
          FROM text_codes t
    )
    SELECT member
        || CASE WHEN coalesce(jsonb_typeof(member -> 'standing'), 'null') = 'null' AND codes.standing IS NOT NULL
                THEN jsonb_build_object('standing', codes.standing) ELSE '{}'::jsonb END
        || CASE WHEN coalesce(jsonb_typeof(member -> 'lane'), 'null') = 'null' AND codes.lane IS NOT NULL
                     AND coalesce(member ->> 'standing', codes.standing, '') <> 'STAFF'
                THEN jsonb_build_object('lane', codes.lane) ELSE '{}'::jsonb END
      FROM codes
$$;

CREATE FUNCTION community.coded_roster(content jsonb, team_entity uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT CASE WHEN jsonb_typeof(content -> 'roster') = 'array' AND jsonb_array_length(content -> 'roster') > 0
        THEN jsonb_set(content, '{roster}', (
            SELECT jsonb_agg(community.coded_roster_member(item.member, team_entity) ORDER BY item.position)
              FROM jsonb_array_elements(content -> 'roster') WITH ORDINALITY AS item(member, position)))
        ELSE content
    END
$$;

UPDATE community.page
   SET content = community.coded_roster(content, entity_id),
       published_content = CASE WHEN published_content IS NULL THEN NULL
                                ELSE community.coded_roster(published_content, entity_id) END
 WHERE kind = 'TEAM';

DROP FUNCTION community.coded_roster(jsonb, uuid);
DROP FUNCTION community.coded_roster_member(jsonb, uuid);
DROP FUNCTION community.roster_standing_from_text(text, text);
DROP FUNCTION community.roster_staff_role(text);
DROP FUNCTION community.roster_lane_from_role(text);
DROP FUNCTION community.roster_primary(text);
