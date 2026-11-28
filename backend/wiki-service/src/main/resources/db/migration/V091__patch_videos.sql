-- Videos about a whole patch (ADR-019, patch videos). A patch variant becomes a subject, its videos tell a preview
-- from an overview and a review, and the moment a video went up places it before or after the release.
ALTER TABLE video.subject_video
    DROP CONSTRAINT subject_video_subject_kind_check,
    DROP CONSTRAINT subject_video_purpose_check;

ALTER TABLE video.subject_video
    ADD CONSTRAINT subject_video_subject_kind_check
        CHECK (subject_kind IN ('HERO', 'SKIN', 'ITEM', 'ENCHANTMENT', 'ARCANA', 'SPELL', 'PATCH')),
    ADD CONSTRAINT subject_video_purpose_check
        CHECK (purpose IN ('INTRO', 'GUIDE_BASIC', 'GUIDE_ADVANCED', 'SKILL_DEMO', 'SKIN_SHOWCASE', 'SKIN_TRAILER',
                           'LORE', 'PATCH_CHANGE', 'PATCH_PREVIEW', 'PATCH_OVERVIEW', 'PATCH_REVIEW', 'OTHER')),
    -- A patch's own videos always name the patch they are about.
    ADD CONSTRAINT subject_video_patch_names_itself
        CHECK (subject_kind <> 'PATCH' OR patch_variant_id = subject_id),
    ADD COLUMN published_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN locale VARCHAR(35);

CREATE INDEX subject_video_patch_idx ON video.subject_video (patch_variant_id, status)
    WHERE patch_variant_id IS NOT NULL;
