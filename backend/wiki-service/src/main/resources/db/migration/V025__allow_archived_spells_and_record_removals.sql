DO $fn$
DECLARE constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name FROM pg_constraint
    WHERE conrelid = 'spell.spell_revision'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%effective_from_patch_variant_id%';
    EXECUTE format('ALTER TABLE spell.spell_revision DROP CONSTRAINT %I', constraint_name);
END $fn$;

ALTER TABLE spell.spell_revision ADD CONSTRAINT spell_publication_context CHECK (
    state <> 'PUBLISHED' OR (
        published_at IS NOT NULL AND publication_sequence IS NOT NULL AND (
            effective_from_patch_variant_id IS NOT NULL OR (
                cause <> 'GAME_PATCH' AND gameplay->>'legacy' = 'true'
                AND gameplay->>'availability' = 'REMOVED'
            ) IS TRUE
        )
    )
);

CREATE TABLE spell.spell_removal (
    id UUID PRIMARY KEY,
    spell_id UUID NOT NULL REFERENCES spell.spell(id),
    ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id),
    revision_id UUID NOT NULL REFERENCES spell.spell_revision(id),
    patch_variant_id UUID NOT NULL REFERENCES patch.patch_variant(id),
    source_url VARCHAR(2048) NOT NULL,
    notes VARCHAR(4000),
    recorded_at TIMESTAMPTZ NOT NULL,
    recorded_by_issuer TEXT NOT NULL,
    recorded_by_subject TEXT NOT NULL,
    UNIQUE (spell_id, patch_variant_id)
);
CREATE INDEX spell_removal_patch ON spell.spell_removal(patch_variant_id);
