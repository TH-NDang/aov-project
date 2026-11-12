-- Games imported on 2026-11-06 carry locale "vi". The wiki catalog only answers "vi-VN" and "en-US", so those games
-- could not load hero pictures and could not be published. GameRules now refuses any other locale; this brings the
-- rows saved before that rule under it. Only the locale tag changes: versions, timestamps and editors stay as they
-- were, because nothing a reader or an editor entered is different.

CREATE FUNCTION pg_temp.supported_locale(document jsonb, path text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $function$
    SELECT CASE WHEN document #>> path = 'vi' THEN jsonb_set(document, path, '"vi-VN"') ELSE document END;
$function$;

-- A published snapshot repeats the locale in the frozen game, in the context it was resolved in and in the catalog
-- copied with it.
CREATE FUNCTION pg_temp.supported_snapshot_locale(snapshot jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $function$
    SELECT pg_temp.supported_locale(
               pg_temp.supported_locale(
                   pg_temp.supported_locale(snapshot, '{content,locale}'),
                   '{resolvedContext,locale}'),
               '{catalog,resolvedContext,locale}');
$function$;

UPDATE tournament.game
   SET content = pg_temp.supported_locale(content, '{locale}')
 WHERE content ->> 'locale' = 'vi';

UPDATE tournament.game
   SET published_snapshot = pg_temp.supported_snapshot_locale(published_snapshot)
 WHERE published_snapshot IS NOT NULL
   AND published_snapshot IS DISTINCT FROM pg_temp.supported_snapshot_locale(published_snapshot);

UPDATE tournament.game_publication
   SET snapshot = pg_temp.supported_snapshot_locale(snapshot)
 WHERE snapshot IS DISTINCT FROM pg_temp.supported_snapshot_locale(snapshot);
