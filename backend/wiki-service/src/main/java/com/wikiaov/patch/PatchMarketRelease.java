package com.wikiaov.patch;

import java.time.Instant;
import java.time.LocalDate;
import org.jspecify.annotations.Nullable;

/**
 * When one market gets a patch, as the Wiki shows it beside the other markets (03, Patch APIs).
 *
 * @param region the market code
 * @param timeZone the market's IANA time zone, used to show the moment in its local time
 * @param effectiveAt the exact moment the patch reaches the market, or {@code null} when only the day is known
 * @param effectiveOn the day the market announced, in its own calendar, when the hour is not known
 */
public record PatchMarketRelease(
        String region,
        String timeZone,
        @Nullable Instant effectiveAt,
        @Nullable LocalDate effectiveOn
) {
}
