-- People have no pictures (spec 04 says why): the links that older records, snapshots and plan history still
-- hold are removed for good. The service has stopped reading them, so nothing a reader sees changes here; what changes is
-- that no stored document names these images any more, so the media library can delete the files.

UPDATE tournament.player
   SET content = content - 'photoUrl'
 WHERE coalesce(content ->> 'photoUrl', '') <> '';

UPDATE community.page
   SET content = content - 'avatarUrl' - 'coverUrl',
       published_content = published_content - 'avatarUrl' - 'coverUrl'
 WHERE kind IN ('PLAYER', 'PERSON')
   AND coalesce(content ->> 'avatarUrl', content ->> 'coverUrl', published_content ->> 'avatarUrl',
                published_content ->> 'coverUrl') IS NOT NULL;

-- A map of records, such as the players of a snapshot, with one key taken out of each record.
CREATE FUNCTION pg_temp.without_key(records jsonb, dropped text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_object_agg(entry.key, entry.value - dropped), '{}'::jsonb) FROM jsonb_each(records) entry
$$;

-- A snapshot of a competition, published or kept in the history of its plan, without the pictures of its people.
CREATE FUNCTION pg_temp.without_pictures(snapshot jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT snapshot
      || CASE WHEN jsonb_typeof(snapshot -> 'players') = 'object'
              THEN jsonb_build_object('players', pg_temp.without_key(snapshot -> 'players', 'photoUrl'))
              ELSE '{}'::jsonb END
      || CASE WHEN jsonb_typeof(snapshot -> 'people') = 'object'
              THEN jsonb_build_object('people', pg_temp.without_key(snapshot -> 'people', 'avatarUrl'))
              ELSE '{}'::jsonb END
$$;

UPDATE tournament.competition_plan
   SET published_snapshot = pg_temp.without_pictures(published_snapshot)
 WHERE jsonb_path_exists(published_snapshot, '$.players.*.photoUrl ? (@ != null)')
    OR jsonb_path_exists(published_snapshot, '$.people.*.avatarUrl ? (@ != null)');

UPDATE tournament.plan_revision
   SET content = pg_temp.without_pictures(content)
 WHERE jsonb_path_exists(content, '$.players.*.photoUrl ? (@ != null)')
    OR jsonb_path_exists(content, '$.people.*.avatarUrl ? (@ != null)');

UPDATE tournament.game
   SET published_snapshot = pg_temp.without_pictures(published_snapshot)
 WHERE jsonb_path_exists(published_snapshot, '$.players.*.photoUrl ? (@ != null)');

UPDATE tournament.game_publication
   SET snapshot = pg_temp.without_pictures(snapshot)
 WHERE jsonb_path_exists(snapshot, '$.players.*.photoUrl ? (@ != null)');
