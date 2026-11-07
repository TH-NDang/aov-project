-- The player directory offers a search by real name, and editors look people up that way, so the real name joins the
-- text both searches read. Generated columns cannot be altered, only replaced.
DROP INDEX tournament.player_reference_search_idx;

ALTER TABLE tournament.player
    DROP COLUMN reference_search,
    DROP COLUMN search_names;

ALTER TABLE tournament.player
    ADD COLUMN reference_search text GENERATED ALWAYS AS (
        tournament.normalize_reference_search(
            coalesce(name, '') || ' ' || code || ' ' || coalesce(content ->> 'fullName', '') || ' '
                || tournament.reference_alias_text(content -> 'aliases')
        )
    ) STORED,
    ADD COLUMN search_names text GENERATED ALWAYS AS (
        tournament.search_names(
            ARRAY[name, code, content ->> 'fullName'] || tournament.alias_array(content -> 'aliases')
        )
    ) STORED;

CREATE INDEX player_reference_search_idx ON tournament.player USING gin (reference_search public.gin_trgm_ops);
