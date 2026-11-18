package com.wikiaov.hero.internal.application.response;

import org.jspecify.annotations.Nullable;

/**
 * Something an editor should check before saving or publishing an imported row (03, hero import). Admin words it from
 * {@code code}; the server sends no sentence.
 *
 * @param skillKey the skill the warning is about, or {@code null} when it is about the whole row
 * @param locale   the skill translation the warning is about, or {@code null} when it is about every language
 */
public record HeroImportWarning(
        Code code,
        @Nullable String skillKey,
        @Nullable String locale
) {

    public enum Code {
        /** The hero has no role; publishing needs one. */
        MISSING_ROLES,
        /** A skill translation has no description; publishing needs one. */
        MISSING_SKILL_DESCRIPTION,
        /** A skill description changed and its old summary was kept; the summary needs a review. */
        STALE_SKILL_SUMMARY,
        /** The captured source of a skill still carries review flags; missing text must not be guessed. */
        SKILL_SOURCE_NEEDS_REVIEW,
        /** A correction found no snapshot at the chosen patch to correct. */
        NO_SNAPSHOT_TO_CORRECT,
        /** There is no snapshot before the chosen patch to compare with. */
        NO_EARLIER_SNAPSHOT,
        /** A baseline records what was known at the chosen patch, not a release or an update. */
        BASELINE_IS_KNOWN_STATE,
        /** Differences between snapshots do not prove the game changed at this patch. */
        SNAPSHOT_DIFFERENCE_UNPROVEN
    }

    public static HeroImportWarning of(Code code) {
        return new HeroImportWarning(code, null, null);
    }

    public static HeroImportWarning skill(Code code, String skillKey, @Nullable String locale) {
        return new HeroImportWarning(code, skillKey, locale);
    }
}
