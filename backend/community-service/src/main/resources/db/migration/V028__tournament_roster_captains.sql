-- Captains of a team in a tournament (spec 04, section of 26/11/2026). A roster line gets `captain: true` when
-- Liquipedia names its player the team's captain on the tournament's page, or when the Liquipedia import left that mark
-- in the line's note as a sentence of its own (the Vietnamese word for captain and a full stop), which then leaves the
-- note. The lines change and so do the published snapshots that copy them; the plan history stays as it was recorded.

-- The page a Liquipedia address names, as its title reads: decoded, with spaces for underscores and without a query,
-- fragment or closing slash. Any other address, or one that does not decode, names no page.
CREATE FUNCTION pg_temp.liquipedia_page(url text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    path text := (regexp_match(url, '^https?://(?:www\.)?liquipedia\.net/(?:honorofkings|arenaofvalor)/([^?#]+)',
                               'i'))[1];
    bytes bytea := '';
    piece record;
BEGIN
    IF path IS NULL THEN
        RETURN NULL;
    END IF;

    FOR piece IN SELECT found.part[1] AS chunk
                   FROM regexp_matches(path, '%[0-9A-Fa-f]{2}|[^%]+|%', 'g') WITH ORDINALITY AS found(part, position)
                  ORDER BY found.position LOOP
        bytes := bytes || CASE WHEN piece.chunk ~ '^%[0-9A-Fa-f]{2}$' THEN decode(substr(piece.chunk, 2), 'hex')
                               ELSE convert_to(piece.chunk, 'UTF8') END;
    END LOOP;
    RETURN rtrim(replace(convert_from(bytes, 'UTF8'), '_', ' '), '/');
EXCEPTION WHEN character_not_in_repertoire THEN
    RETURN NULL;
END
$$;

-- A roster line, or its copy in a snapshot, as a captain's: the flag set, and the sentence that stood for it taken out
-- of the note, which is emptied when nothing else is left.
CREATE FUNCTION pg_temp.captained(line jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT line || jsonb_build_object('captain', true)
         || CASE WHEN line ->> 'note' ~ '(^|\s)Đội trưởng\.(\s|$)'
                 THEN jsonb_build_object('note', nullif(btrim(regexp_replace(line ->> 'note',
                                                                             '(^|\s)Đội trưởng\.(\s|$)', ' ')), ''))
                 ELSE '{}'::jsonb END
$$;

-- Every player marked "captain" in the participants of a Liquipedia tournament page that marks any, as the pages read
-- on 26/11/2026: the page, the team as the page writes it, the name shown and the player page it links when it differs.
CREATE TEMPORARY TABLE liquipedia_captain (page text NOT NULL, team text NOT NULL, player text NOT NULL, link text);

INSERT INTO liquipedia_captain (page, team, player, link) VALUES
    ('RoV Pro League/2026/Summer', 'FULL SENSE', 'Sharkz', NULL),
    ('RoV Pro League/2026/Summer', 'Bacon Time', 'Kimsensei', NULL),
    ('RoV Pro League/2026/Summer', 'Buriram United Esports', 'Ligky', NULL),
    ('RoV Pro League/2026/Summer', 'SOLYX', 'Deboom', NULL),
    ('RoV Pro League/2026/Summer', 'eArena', 'Pichu', NULL),
    ('RoV Pro League/2026/Summer', 'Tenacity', 'Difoxn', NULL),
    ('RoV Pro League/2026/Summer', 'Hydra Esports', 'April', NULL),
    ('RoV Pro League/2026/Summer', 'King of Gamers Club', 'Cinderella', NULL),
    ('RoV Pro League/2026/Summer', 'Godji Check', 'Beast', 'Beast_(Thai_Player)'),
    ('Arena of Valor Premier League/2026', 'Team Flash', 'Maris', NULL),
    ('Arena of Valor Premier League/2026', 'Saigon Phantom', 'Fish', 'Fish (Cá)'),
    ('Arena of Valor Premier League/2026', 'FPT Polytechnic', 'Oguu', NULL),
    ('Arena of Valor Premier League/2026', 'GAM Esports', 'Aliyah', NULL),
    ('Arena of Valor Premier League/2026', 'dcg', 'Xcen', NULL),
    ('Arena of Valor Premier League/2026', 'fw', 'YuXiang', NULL),
    ('Arena of Valor Premier League/2026', 'ANK Gaming', 'LiTing', NULL),
    ('Arena of Valor Premier League/2026', 'BanMei Gaming', 'Neil', NULL),
    ('Arena of Valor Premier League/2026', 'Buriram United Esports', 'Ligky', NULL),
    ('Arena of Valor Premier League/2026', 'FULL SENSE', 'Sharkz', NULL),
    ('Arena of Valor Premier League/2026', 'King of Gamers Club', 'Cinderella', NULL),
    ('Arena of Valor Premier League/2026', 'SOLYX', 'Acapae', NULL),
    ('Arena of Valor Premier League/2026', 'One Star Esports', 'BirdLB', NULL),
    ('Arena of Valor Premier League/2026', 'ONE Team', 'Tura', NULL),
    ('Arena of Valor Premier League/2026', 'Hong Kong Attitude', 'Fong', NULL),
    ('Arena of Valor Premier League/2026', 'Bacon Time', 'Kimsensei', NULL),
    ('Arena of Valor Premier League/2026/Queens Showdown', 'Saigon Phantom Ladies', 'Shizuka', NULL),
    ('Arena of Valor Premier League/2026/Queens Showdown', 'One Star Esports (Women Team)', 'Nat', NULL),
    ('Arena of Valor Premier League/2026/Queens Showdown', 'ANK Gaming (Women Team)', 'ZXuan', NULL),
    ('Arena of Valor Premier League/2026/Queens Showdown', 'Deep Cross Gaming (Women Team)', 'Beth', NULL),
    ('Arena of Valor Premier League/2026/Queens Showdown', 'eArena (Women Team)', 'WHATIF', 'GustaiA'),
    ('Arena of Valor Premier League/2026/Queens Showdown', 'TEAM MAZZ', 'S9', NULL),
    ('RoV Pro League/2027/Promotion', 'Godji Check', 'NTNz', NULL),
    ('RoV Pro League/2027/Promotion', 'Gangrocket', 'ShankDes', NULL),
    ('Arena of Glory/2026/Winter', 'Team Flash', 'Yutan', NULL),
    ('Arena of Glory/2026/Winter', 'Saigon Phantom', 'Fish', 'Fish (Cá)'),
    ('Arena of Glory/2026/Winter', 'One Star Esports', 'Zet', NULL),
    ('Arena of Glory/2026/Winter', 'Box Gaming', 'Ciara', NULL),
    ('Arena of Glory/2026/Winter', 'FPT Polytechnic', 'Vịt', NULL),
    ('Arena of Glory/2026/Winter', 'GAM Esports', 'Aliyah', NULL),
    ('Arena of Glory/2026/Winter', 'Team Secret', 'Boka', NULL),
    ('Arena of Glory/2026/Winter', 'Rex Regum Qeon VN', 'Triết', NULL),
    ('Arena of Glory/2026/Winter', 'BOOM Esports VN', 'Anne', NULL),
    ('RoV Pro League/2026/Winter', 'Buriram United Esports', 'Ligky', NULL),
    ('RoV Pro League/2026/Winter', 'FULL SENSE', 'Sharkz', NULL),
    ('RoV Pro League/2026/Winter', 'King of Gamers Club', 'Cinderella', NULL),
    ('RoV Pro League/2026/Winter', 'SOLYX', 'Myra', NULL),
    ('RoV Pro League/2026/Winter', 'Tenacity', 'Difoxn', NULL),
    ('RoV Pro League/2026/Winter', 'Bacon Time', 'Kimsensei', NULL),
    ('RoV Pro League/2026/Winter', 'eArena', 'NBank', NULL),
    ('RoV Pro League/2026/Winter', 'Hydra Esports', 'Acapae', NULL),
    ('RoV Pro League/2026/Winter', 'Godji Check', 'NTNz', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Đắk Lắk', 'Njunn', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Đà Nẵng', 'Binbe', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Cần Thơ', 'KhangDuong', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Hải Phòng', 'TĐ06', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Huế', 'Cheese', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Hồ Chí Minh City', 'Nhím', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Nghệ An', 'HaDes', 'HDes'),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Ho Chi Minh City University of Technology', 'Bảyyy', 'BayBaby'),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Văn Hiến University', 'GrayA', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'HCMUTE', '007', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'University of Transport Ho Chi Minh City', 'Lele', 'Lele (Vietnamese player)'),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Đà Nẵng University of Science and Technology', 'Qvinh', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'VNU-HCM University of Information Technology', 'Đạt Béo', NULL),
    ('Tứ Phương Đại Chiến/2026/Winter', 'HUTECH University', 'Momoo', 'Momo (Vietnamese player)'),
    ('Tứ Phương Đại Chiến/2026/Winter', 'Sài Gòn University', 'AnhHuy', NULL),
    ('Queens of Glory/2026/Winter', 'Saigon Phantom Ladies', 'Shizuka', NULL),
    ('Queens of Glory/2026/Winter', 'One Star Esports (Women Team)', 'BounBoun', NULL),
    ('Queens of Glory/2026/Winter', 'Boom Esports (Women Team)', 'Sunny', NULL),
    ('Queens of Glory/2026/Winter', 'Team Secret Dino', 'MaiLK', NULL),
    ('Queens of Glory/2026/Winter', 'GAM Esports (Women Team)', 'Cosy', NULL),
    ('Queens of Glory/2026/Winter', 'ALG Queen', 'Hon', 'Hon (Trần Thị Hoan)'),
    ('Queens of Glory/2026/Winter', 'Five Dragon Princesses', 'DunT', NULL),
    ('Queens of Glory/2026/Winter', 'WVHS', 'Fuji', NULL),
    ('Arena of Valor International Championship/2026', 'FPT Polytechnic', 'VIT', 'Vịt'),
    ('Arena of Valor International Championship/2026', 'BOOM Esports VN', 'Anne', NULL),
    ('Arena of Valor International Championship/2026', 'Saigon Phantom', 'Fish', 'Fish (Cá)'),
    ('Arena of Valor International Championship/2026', 'Box Gaming', 'Ciara', NULL),
    ('Arena of Valor International Championship/2026', 'Buriram United Esports', 'Ligky', NULL),
    ('Arena of Valor International Championship/2026', 'Full Sense', 'AshEarth', NULL),
    ('Arena of Valor International Championship/2026', 'EArena', 'NBank', NULL),
    ('Arena of Valor International Championship/2026', 'Tenacity', 'Difoxn', NULL),
    ('Arena of Valor International Championship/2026', 'BanMei Gaming', 'Yanyan', NULL),
    ('Arena of Valor International Championship/2026', 'ONE Team', 'Wuliu', NULL),
    ('Arena of Valor International Championship/2026', 'SOLYX', 'Pichu', NULL),
    ('Arena of Valor International Championship/2026', 'King of Gamers Club', 'Cinderella', NULL),
    ('Arena of Valor International Championship/2026/Wildcard', 'Team Flash', 'HuyHoàng', NULL),
    ('Arena of Valor International Championship/2026/Wildcard', 'Gam Esports', 'Aliyah', NULL),
    ('Arena of Valor International Championship/2026/Wildcard', 'King of Gamers Club', 'Cinderella', NULL),
    ('Arena of Valor International Championship/2026/Wildcard', 'SOLYX', 'Pichu', NULL),
    ('Arena of Valor International Championship/2026/Wildcard', 'BanMei Gaming', 'Yanyan', NULL),
    ('Arena of Valor International Championship/2026/Wildcard', 'ONE Team', 'Wuliu', NULL),
    ('Tứ Phương Đại Chiến/2026/Decade Reunion', 'Hồ Chí Minh city', 'Judas', NULL),
    ('Tứ Phương Đại Chiến/2026/Decade Reunion', 'Tây Ninh', 'ThànhBờm', NULL),
    ('Tứ Phương Đại Chiến/2026/Decade Reunion', 'Đà Nẵng', 'LaiPhạm', NULL),
    ('Tứ Phương Đại Chiến/2026/Decade Reunion', 'Đồng Nai', 'Thor', NULL),
    ('Tứ Phương Đại Chiến/2026/Decade Reunion', 'Phú Thọ', '1SHOT', NULL)
;

-- The names a player goes by, folded as the duplicate check folds them.
CREATE TEMPORARY TABLE player_name AS
SELECT DISTINCT player.id, tournament.name_key(name.value) AS name_key
  FROM tournament.player player
 CROSS JOIN LATERAL (SELECT player.name
                     UNION ALL SELECT player.code
                     UNION ALL SELECT player.content ->> 'nickname'
                     UNION ALL SELECT jsonb_array_elements_text(
                                          CASE WHEN jsonb_typeof(player.content -> 'aliases') = 'array'
                                               THEN player.content -> 'aliases' ELSE '[]'::jsonb END)) AS name(value)
 WHERE name.value IS NOT NULL;

CREATE TEMPORARY TABLE captain_line (id uuid PRIMARY KEY);

-- Each captain Liquipedia names, on the one line of the tournament's roster whose player goes by that name or by the
-- linked page. A name that no line or two lines of the tournament go by is left alone.
INSERT INTO captain_line (id)
SELECT (array_agg(DISTINCT line.id))[1]
  FROM liquipedia_captain captain
  JOIN tournament.tournament event ON pg_temp.liquipedia_page(event.content ->> 'sourceUrl') = captain.page
  JOIN tournament.roster_membership line ON line.tournament_id = event.id AND line.deleted_at IS NULL
 WHERE EXISTS (SELECT 1 FROM player_name name
                WHERE name.id = line.player_id
                  AND name.name_key IN (tournament.name_key(captain.player), tournament.name_key(captain.link)))
 GROUP BY captain.page, captain.player, event.id
HAVING count(DISTINCT line.id) = 1
    ON CONFLICT DO NOTHING;

INSERT INTO captain_line (id)
SELECT id FROM tournament.roster_membership WHERE content ->> 'note' ~ '(^|\s)Đội trưởng\.(\s|$)'
    ON CONFLICT DO NOTHING;

UPDATE tournament.roster_membership line
   SET content = pg_temp.captained(line.content),
       version = line.version + 1
  FROM captain_line captain
 WHERE line.id = captain.id AND pg_temp.captained(line.content) IS DISTINCT FROM line.content;

-- A published snapshot copies the lines of its roster; the copies of captains' lines change the same way.
CREATE TEMPORARY TABLE captain_copy AS
SELECT CAST(line.tournament_id AS text) AS tournament_key, CAST(line.team_id AS text) AS team_key,
       CAST(line.player_id AS text) AS player_key
  FROM tournament.roster_membership line
  JOIN captain_line captain ON captain.id = line.id;

UPDATE tournament.competition_plan plan
   SET published_snapshot = jsonb_set(plan.published_snapshot, '{rosters}', (
           SELECT jsonb_agg(CASE WHEN copy.tournament_key IS NULL THEN entry.line
                                 ELSE pg_temp.captained(entry.line) END ORDER BY entry.position)
             FROM jsonb_array_elements(plan.published_snapshot -> 'rosters') WITH ORDINALITY AS entry(line, position)
             LEFT JOIN captain_copy copy ON copy.tournament_key = entry.line ->> 'tournamentId'
                                        AND copy.team_key = entry.line ->> 'teamId'
                                        AND copy.player_key = entry.line ->> 'playerId'))
 WHERE jsonb_typeof(plan.published_snapshot -> 'rosters') = 'array'
   AND EXISTS (SELECT 1
                 FROM jsonb_array_elements(plan.published_snapshot -> 'rosters') entry(line)
                 JOIN captain_copy copy ON copy.tournament_key = entry.line ->> 'tournamentId'
                                       AND copy.team_key = entry.line ->> 'teamId'
                                       AND copy.player_key = entry.line ->> 'playerId'
                WHERE pg_temp.captained(entry.line) IS DISTINCT FROM entry.line);

DROP TABLE captain_copy, captain_line, player_name, liquipedia_captain;
DROP FUNCTION pg_temp.captained(jsonb), pg_temp.liquipedia_page(text);
