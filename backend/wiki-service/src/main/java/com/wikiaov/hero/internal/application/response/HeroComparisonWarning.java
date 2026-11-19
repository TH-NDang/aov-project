package com.wikiaov.hero.internal.application.response;

/**
 * Something an editor should keep in mind while reading a snapshot comparison (03, hero snapshot comparison). Admin
 * words it from {@code code}; the server sends no sentence. Neither code needs a parameter yet; one that does adds a
 * field beside {@code code}, as {@link HeroImportWarning} does.
 */
public record HeroComparisonWarning(
        Code code
) {

    public enum Code {
        /** There is no earlier snapshot to compare with: the content is an observed baseline, not a game change. */
        NO_EARLIER_SNAPSHOT,
        /** Differences between two snapshots do not say which patch caused them; sources decide the changelog. */
        SNAPSHOT_DIFFERENCE_UNPROVEN
    }
}
