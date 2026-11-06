package com.wikiaov.media.internal.application.response;

import org.jspecify.annotations.Nullable;

/**
 * How many distinct places use an image. A place is one role of one owner, so the same skin art in five old revisions
 * counts once.
 *
 * @param state       the strongest kind of use
 * @param current     places drawing it for readers right now
 * @param draft       places drawing it only in unpublished drafts
 * @param historical  places drawing it only in older published revisions
 * @param stored      places keeping only its id
 * @param competition records of the community service naming it; {@code null} when that could not be checked
 */
public record MediaUsageSummary(
        MediaUsageState state,
        long current,
        long draft,
        long historical,
        long stored,
        @Nullable Long competition
) {
}
