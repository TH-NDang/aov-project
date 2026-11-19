-- Read-only export for link_backfill.py (ADR-032). Run with psql -X -q -At so the output is the JSON document alone.
-- Series and games of trashed tournaments are left out; tournaments, teams and players keep their trash flag.
SELECT json_build_object(
    'exportedAt', now(),
    'tournaments', (
        SELECT coalesce(json_agg(json_build_object(
            'id', t.id,
            'deleted', t.deleted_at IS NOT NULL,
            'name', t.name,
            'sourceUrl', t.content->>'sourceUrl',
            'awards', coalesce(t.content->'awards', '[]'::jsonb),
            'placements', coalesce(t.content->'placements', '[]'::jsonb),
            'broadcast', coalesce(t.content->'broadcast', '[]'::jsonb),
            'staff', coalesce(t.content->'staff', '[]'::jsonb))), '[]')
          FROM tournament.tournament t),
    'teams', (
        SELECT coalesce(json_agg(json_build_object(
            'id', id,
            'deleted', deleted_at IS NOT NULL,
            'name', name,
            'shortName', content->>'shortName',
            'aliases', coalesce(content->'aliases', '[]'::jsonb))), '[]')
          FROM tournament.team),
    'players', (
        SELECT coalesce(json_agg(json_build_object(
            'id', id,
            'deleted', deleted_at IS NOT NULL,
            'nickname', name,
            'aliases', coalesce(content->'aliases', '[]'::jsonb))), '[]')
          FROM tournament.player),
    'rosters', (
        SELECT coalesce(json_agg(json_build_object(
            'tournamentId', tournament_id,
            'teamId', team_id,
            'playerId', player_id)), '[]')
          FROM tournament.roster_membership
         WHERE deleted_at IS NULL),
    'series', (
        SELECT coalesce(json_agg(json_build_object(
            'id', s.id,
            'tournamentId', s.tournament_id,
            'teamAId', s.content->>'teamAId',
            'teamBId', s.content->>'teamBId',
            'note', s.content->>'note',
            'mvpPlayerId', s.content->>'mvpPlayerId',
            'broadcast', coalesce(s.content->'broadcast', '[]'::jsonb))), '[]')
          FROM tournament.series s
          JOIN tournament.tournament t ON t.id = s.tournament_id
         WHERE s.deleted_at IS NULL AND t.deleted_at IS NULL),
    'games', (
        SELECT coalesce(json_agg(json_build_object(
            'id', g.id,
            'seriesId', g.series_id,
            'note', g.content->>'note',
            'mvpPlayerId', g.content->>'mvpPlayerId',
            'players', (
                SELECT coalesce(json_agg(participant->>'playerId')
                                FILTER (WHERE participant->>'playerId' IS NOT NULL), '[]')
                  FROM jsonb_array_elements(coalesce(g.content->'sides', '[]'::jsonb)) side,
                       jsonb_array_elements(coalesce(side->'participants', '[]'::jsonb)) participant))), '[]')
          FROM tournament.game g
         WHERE g.deleted_at IS NULL AND g.content->>'note' ~ 'MVP: '),
    'pages', (
        SELECT coalesce(json_agg(json_build_object(
            'id', id,
            'kind', kind,
            'entityId', entity_id,
            'name', content->>'name',
            'history', CASE WHEN kind IN ('PERSON', 'PLAYER') THEN coalesce(content->'history', '[]'::jsonb)
                            ELSE '[]'::jsonb END)), '[]')
          FROM community.page
         WHERE kind IN ('PERSON', 'PLAYER', 'TEAM'))
);
