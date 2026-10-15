CREATE TABLE hero.hero (
 id UUID PRIMARY KEY, code VARCHAR(64) NOT NULL UNIQUE CHECK(code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 created_at TIMESTAMPTZ NOT NULL, created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL
);
CREATE TABLE hero.hero_external_identity (
 hero_id UUID NOT NULL REFERENCES hero.hero, provider VARCHAR(64) NOT NULL,
 namespace VARCHAR(64) NOT NULL, external_value VARCHAR(255) NOT NULL,
 UNIQUE(provider,namespace,external_value), PRIMARY KEY(hero_id,provider,namespace)
);
CREATE TABLE hero.hero_revision (
 id UUID PRIMARY KEY,hero_id UUID NOT NULL REFERENCES hero.hero,ruleset_id UUID NOT NULL,
 revision_no BIGINT NOT NULL CHECK(revision_no>0), state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL CHECK(version>0), publication_sequence BIGINT, published_at TIMESTAMPTZ,
 cause VARCHAR(32) NOT NULL CHECK(cause IN ('GAME_PATCH','CONTENT_CORRECTION','TRANSLATION','IMPORT_CORRECTION','VISUAL_UPDATE','OTHER')),
 source_revision_id UUID, effective_from_patch_variant_id UUID,
 profile_revision_id UUID,overview_rating_revision_id UUID,combat_stats_revision_id UUID,
 skills_revision_id UUID,skins_revision_id UUID,media_binding_revision_id UUID,
 created_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL,
 updated_by_issuer TEXT NOT NULL,updated_by_subject TEXT NOT NULL,
 UNIQUE(hero_id,ruleset_id,revision_no), UNIQUE(hero_id,ruleset_id,publication_sequence), UNIQUE(id,hero_id),
 FOREIGN KEY(source_revision_id,hero_id) REFERENCES hero.hero_revision(id,hero_id),
 CHECK ((state='PUBLISHED')=(publication_sequence IS NOT NULL AND published_at IS NOT NULL)),
 CHECK(state<>'PUBLISHED' OR (profile_revision_id IS NOT NULL AND overview_rating_revision_id IS NOT NULL
 AND combat_stats_revision_id IS NOT NULL AND skills_revision_id IS NOT NULL AND skins_revision_id IS NOT NULL AND media_binding_revision_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_hero_one_draft_per_ruleset ON hero.hero_revision(hero_id,ruleset_id) WHERE state='DRAFT';
CREATE INDEX ix_hero_revision_public ON hero.hero_revision(hero_id,ruleset_id,publication_sequence DESC) WHERE state='PUBLISHED';
CREATE FUNCTION hero.guard_published_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state='PUBLISHED' THEN RAISE EXCEPTION 'Published hero data is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_hero_revision_immutable BEFORE UPDATE OR DELETE ON hero.hero_revision FOR EACH ROW EXECUTE FUNCTION hero.guard_published_revision();
