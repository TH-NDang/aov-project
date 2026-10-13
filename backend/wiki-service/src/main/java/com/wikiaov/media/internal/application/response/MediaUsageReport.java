package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.MediaUsage;
import java.util.List;
import java.util.UUID;

/**
 * @param counts totals per scope, independent of the scope filter
 * @param items  usages matching the scope filter
 */
public record MediaUsageReport(
        UUID assetId,
        Counts counts,
        List<MediaUsage> items
) {

    public record Counts(
            long current,
            long draft,
            long historical
    ) {
    }
}
