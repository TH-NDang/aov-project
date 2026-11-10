-- ADR-024: Flowborn becomes one catalog hero, "flowborn", holding the existing heroes flowborn-ad (marksman, default)
-- and flowborn-mid (mage) as its forms. The forms keep their identities, revisions, drafts, change sets and images.
-- The new hero receives a published baseline in every ruleset where flowborn-ad is published, so the Wiki never loses
-- Flowborn: the shared name, the title and lore of flowborn-ad's current revision, and its current HEAD, PORTRAIT and
-- SPLASH images. It holds no roles, positions, ratings, stats, skills or skins of its own.
-- A database without flowborn-ad, or one that already has a hero coded flowborn, is left unchanged.
DO $$
DECLARE
    parent_id CONSTANT UUID := '1bca4c6c-88a3-476c-a3aa-4bb206837745';
    actor_issuer CONSTANT TEXT := 'urn:wikiaov:migration';
    actor_subject CONSTANT TEXT := 'V061__flowborn_forms';
    ad_id UUID;
    mid_id UUID;
    ruleset RECORD;
    latest RECORD;
    revision_id UUID;
    profile_id UUID;
    ratings_id UUID;
    stats_id UUID;
    skills_id UUID;
    skins_id UUID;
    media_id UUID;
BEGIN
    SELECT id INTO ad_id FROM hero.hero WHERE code = 'flowborn-ad';
    SELECT id INTO mid_id FROM hero.hero WHERE code = 'flowborn-mid';
    IF ad_id IS NULL OR EXISTS (SELECT 1 FROM hero.hero WHERE code = 'flowborn') THEN
        RETURN;
    END IF;

    INSERT INTO hero.hero (id, code, created_at, created_by_issuer, created_by_subject)
    VALUES (parent_id, 'flowborn', now(), actor_issuer, actor_subject);

    FOR ruleset IN
        SELECT DISTINCT ON (r.ruleset_id) r.ruleset_id, r.effective_from_patch_variant_id AS effective_id
        FROM hero.hero_revision r
        JOIN patch.patch_variant v ON v.id = r.effective_from_patch_variant_id
        WHERE r.hero_id = ad_id AND r.state = 'PUBLISHED'
        ORDER BY r.ruleset_id, v.ruleset_ordinal, r.publication_sequence
    LOOP
        SELECT r.profile_revision_id, r.media_binding_revision_id INTO latest
        FROM hero.hero_revision r
        LEFT JOIN patch.patch_variant v ON v.id = r.effective_from_patch_variant_id
        WHERE r.hero_id = ad_id AND r.ruleset_id = ruleset.ruleset_id AND r.state = 'PUBLISHED'
        ORDER BY coalesce(v.ruleset_ordinal, 0) DESC, r.publication_sequence DESC
        LIMIT 1;

        revision_id := gen_random_uuid();
        profile_id := gen_random_uuid();
        ratings_id := gen_random_uuid();
        stats_id := gen_random_uuid();
        skills_id := gen_random_uuid();
        skins_id := gen_random_uuid();
        media_id := gen_random_uuid();

        -- Sections start as drafts so their content can be written, then become published together.
        INSERT INTO hero.hero_profile_revision (id, hero_id, state, created_at, created_by_issuer, created_by_subject)
        VALUES (profile_id, parent_id, 'DRAFT', now(), actor_issuer, actor_subject);
        INSERT INTO hero.hero_overview_rating_revision (id, hero_id, state, created_at, created_by_issuer,
            created_by_subject)
        VALUES (ratings_id, parent_id, 'DRAFT', now(), actor_issuer, actor_subject);
        INSERT INTO hero.hero_combat_stats_revision (id, hero_id, state, created_at, created_by_issuer,
            created_by_subject)
        VALUES (stats_id, parent_id, 'DRAFT', now(), actor_issuer, actor_subject);
        INSERT INTO hero.hero_skill_set_revision (id, hero_id, state, created_at, created_by_issuer, created_by_subject)
        VALUES (skills_id, parent_id, 'DRAFT', now(), actor_issuer, actor_subject);
        INSERT INTO hero.hero_skin_set_revision (id, hero_id, state, created_at, created_by_issuer, created_by_subject)
        VALUES (skins_id, parent_id, 'DRAFT', now(), actor_issuer, actor_subject);
        INSERT INTO hero.hero_media_binding_revision (id, hero_id, state, created_at, created_by_issuer,
            created_by_subject)
        VALUES (media_id, parent_id, 'DRAFT', now(), actor_issuer, actor_subject);

        INSERT INTO hero.hero_profile_translation (profile_revision_id, locale, name, title, summary, lore)
        SELECT profile_id, t.locale, 'Flowborn', t.title, NULL, t.lore
        FROM hero.hero_profile_translation t
        WHERE t.profile_revision_id = latest.profile_revision_id;
        IF NOT FOUND THEN
            INSERT INTO hero.hero_profile_translation (profile_revision_id, locale, name, title, summary, lore)
            VALUES (profile_id, 'vi-VN', 'Flowborn', 'Hậu duệ Khởi Nguyên', NULL, NULL);
        END IF;

        INSERT INTO hero.hero_media_binding (media_binding_revision_id, media_role, asset_id)
        SELECT media_id, b.media_role, b.asset_id
        FROM hero.hero_media_binding b
        WHERE b.media_binding_revision_id = latest.media_binding_revision_id;

        UPDATE hero.hero_profile_revision SET state = 'PUBLISHED' WHERE id = profile_id;
        UPDATE hero.hero_overview_rating_revision SET state = 'PUBLISHED' WHERE id = ratings_id;
        UPDATE hero.hero_combat_stats_revision SET state = 'PUBLISHED' WHERE id = stats_id;
        UPDATE hero.hero_skill_set_revision SET state = 'PUBLISHED' WHERE id = skills_id;
        UPDATE hero.hero_skin_set_revision SET state = 'PUBLISHED' WHERE id = skins_id;
        UPDATE hero.hero_media_binding_revision SET state = 'PUBLISHED' WHERE id = media_id;

        INSERT INTO hero.hero_revision (id, hero_id, ruleset_id, revision_no, state, version, publication_sequence,
            published_at, cause, source_revision_id, effective_from_patch_variant_id, profile_revision_id,
            overview_rating_revision_id, combat_stats_revision_id, skills_revision_id, skins_revision_id,
            media_binding_revision_id, created_at, updated_at, created_by_issuer, created_by_subject,
            updated_by_issuer, updated_by_subject)
        VALUES (revision_id, parent_id, ruleset.ruleset_id, 1, 'PUBLISHED', 1, 1, now(), 'DATA_BASELINE', NULL,
            ruleset.effective_id, profile_id, ratings_id, stats_id, skills_id, skins_id, media_id, now(), now(),
            actor_issuer, actor_subject, actor_issuer, actor_subject);
    END LOOP;

    INSERT INTO hero.hero_form (hero_id, parent_hero_id, form_key, display_order, created_at, created_by_issuer,
        created_by_subject)
    VALUES (ad_id, parent_id, 'ad', 1, now(), actor_issuer, actor_subject);
    IF mid_id IS NOT NULL THEN
        INSERT INTO hero.hero_form (hero_id, parent_hero_id, form_key, display_order, created_at, created_by_issuer,
            created_by_subject)
        VALUES (mid_id, parent_id, 'mid', 2, now(), actor_issuer, actor_subject);
    END IF;

    -- Source pages of each form: Garena's hero academy and Liquipedia (Honor of Kings) keep one page per form.
    INSERT INTO hero.hero_external_identity (hero_id, provider, namespace, external_value)
    VALUES (ad_id, 'garena-vn', 'hoc-vien-tuong-skin', 'flowborn'),
        (ad_id, 'liquipedia', 'honorofkings', 'Flowborn/Marksman')
    ON CONFLICT DO NOTHING;
    IF mid_id IS NOT NULL THEN
        INSERT INTO hero.hero_external_identity (hero_id, provider, namespace, external_value)
        VALUES (mid_id, 'garena-vn', 'hoc-vien-tuong-skin', 'flowborn-2'),
            (mid_id, 'liquipedia', 'honorofkings', 'Flowborn/Mage')
        ON CONFLICT DO NOTHING;
    END IF;

    UPDATE platform.catalog_cache_epoch SET epoch = epoch + 1 WHERE id = 1;
END $$;
