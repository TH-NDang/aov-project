ALTER TABLE item.item_revision DROP CONSTRAINT item_revision_check;

ALTER TABLE item.item_revision ADD CONSTRAINT item_publication_context CHECK (
    state <> 'PUBLISHED' OR (
        published_at IS NOT NULL AND publication_sequence IS NOT NULL AND (
            effective_from_patch_variant_id IS NOT NULL OR cause = 'DATA_BASELINE' OR (
                cause IN ('CONTENT_CORRECTION', 'TRANSLATION_UPDATE') AND source_revision_id IS NOT NULL
            )
        )
    )
);

ALTER TABLE spell.spell_revision DROP CONSTRAINT spell_publication_context;

ALTER TABLE spell.spell_revision ADD CONSTRAINT spell_publication_context CHECK (
    state <> 'PUBLISHED' OR (
        published_at IS NOT NULL AND publication_sequence IS NOT NULL AND (
            effective_from_patch_variant_id IS NOT NULL OR cause = 'DATA_BASELINE' OR (
                cause IN ('CONTENT_CORRECTION', 'TRANSLATION_UPDATE') AND source_revision_id IS NOT NULL
            ) OR (
                cause <> 'GAME_PATCH' AND gameplay->>'legacy' = 'true'
                AND gameplay->>'availability' = 'REMOVED'
            ) IS TRUE
        )
    )
);
