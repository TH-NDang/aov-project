-- The patch importer once appended a note about the patch to a hero's summary. The note is already recorded as a patch
-- change, so it is removed from the profile. Published content is locked by a trigger, lifted only for this correction.
ALTER TABLE hero.hero_profile_translation DISABLE TRIGGER trg_hero_profile_translation_immutable;

UPDATE hero.hero_profile_translation
SET summary = split_part(summary, E'\n\nGhi chú gameplay (Garena):', 1)
WHERE summary LIKE E'%\n\nGhi chú gameplay (Garena):%';

ALTER TABLE hero.hero_profile_translation ENABLE TRIGGER trg_hero_profile_translation_immutable;
