package com.wikiaov.media.internal.application.response;

import java.util.List;

/**
 * Several assets read together.
 *
 * @param items the requested assets that exist, in the requested order and without repeats
 */
public record MediaAssetBatch(
        List<MediaAssetDetails> items
) {
}
