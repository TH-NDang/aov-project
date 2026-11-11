-- The overall assessment of the change set that introduced a hero may read RELEASE (ADR-016, 2026-11-11 addendum).
-- Change lines keep their own kinds; only the overall assessment gains this one.
ALTER TABLE hero.hero_patch_assessment
    DROP CONSTRAINT hero_patch_assessment_kind_check;

ALTER TABLE hero.hero_patch_assessment
    ADD CONSTRAINT hero_patch_assessment_kind_check
        CHECK (kind IN ('BUFF', 'NERF', 'ADJUSTMENT', 'REWORK', 'FIX', 'RELEASE', 'OTHER'));
