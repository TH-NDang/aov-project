CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE FUNCTION tournament.normalize_reference_search(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $function$
    SELECT btrim(regexp_replace(
        lower(translate(regexp_replace(normalize(value, NFD), U&'[\0300-\036f]', '', 'g'), 'đĐ', 'dD')),
        '[[:space:]]+', ' ', 'g'
    ));
$function$;

CREATE FUNCTION tournament.reference_alias_text(value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT coalesce(string_agg(alias, ' '), '')
      FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(value)='array' THEN value ELSE '[]'::jsonb END
      ) AS entry(alias);
$function$;

ALTER TABLE tournament.team ADD COLUMN reference_search text GENERATED ALWAYS AS (
    tournament.normalize_reference_search(
        coalesce(name, '') || ' ' || code || ' ' || coalesce(content->>'shortName', '') || ' '
        || tournament.reference_alias_text(content->'aliases')
    )
) STORED;

ALTER TABLE tournament.player ADD COLUMN reference_search text GENERATED ALWAYS AS (
    tournament.normalize_reference_search(coalesce(name, '') || ' ' || code)
) STORED;

CREATE INDEX team_reference_search_idx ON tournament.team USING gin (reference_search public.gin_trgm_ops);
CREATE INDEX player_reference_search_idx ON tournament.player USING gin (reference_search public.gin_trgm_ops);
