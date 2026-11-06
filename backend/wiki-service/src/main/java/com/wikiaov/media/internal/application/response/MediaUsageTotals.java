package com.wikiaov.media.internal.application.response;

import java.util.Map;

/**
 * @param states             how many images are in each usage state
 * @param competitionChecked whether images used only by competition records were counted as used
 */
public record MediaUsageTotals(
        Map<MediaUsageState, Long> states,
        boolean competitionChecked
) {
}
