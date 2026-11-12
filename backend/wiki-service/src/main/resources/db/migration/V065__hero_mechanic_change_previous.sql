-- What a reworked mechanic did before the patch, written by an editor from a cited source (ADR-016, 2026-11-12).
-- The recorded mechanic change stays as it was; this table only adds to it.
CREATE TABLE hero.hero_mechanic_change_previous (
    mechanic_change_id UUID PRIMARY KEY REFERENCES hero.hero_mechanic_change (id),
    description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 4000),
    source_url TEXT NOT NULL CHECK (source_url ~* '^https?://'),
    created_at TIMESTAMPTZ NOT NULL,
    created_by_issuer TEXT NOT NULL,
    created_by_subject TEXT NOT NULL
);

CREATE TRIGGER trg_hero_mechanic_change_previous_append_only
    BEFORE UPDATE OR DELETE ON hero.hero_mechanic_change_previous
    FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
