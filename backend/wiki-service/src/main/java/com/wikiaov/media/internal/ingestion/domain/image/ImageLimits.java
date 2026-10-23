package com.wikiaov.media.internal.ingestion.domain.image;

/**
 * Size policy for accepted images.
 *
 * @param maxBytes     largest accepted file
 * @param maxPixels    largest accepted width x height
 * @param maxDimension largest accepted width or height
 */
public record ImageLimits(
        long maxBytes,
        long maxPixels,
        int maxDimension
) {
}
