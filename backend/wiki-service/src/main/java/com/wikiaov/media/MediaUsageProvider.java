package com.wikiaov.media;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reverse usage contract (01 section 12.6), implemented by every module that references media assets.
 *
 * <p>The owner module stays the source of truth: media asks each provider instead of reading other modules'
 * tables. Implementations are Spring beans; media collects all of them.
 */
public interface MediaUsageProvider {

    /** Returns every reference to {@code assetId} held by this module; empty if there is none. */
    List<MediaUsage> findUsages(UUID assetId);

    /**
     * Returns every reference this module holds, by asset, so the asset list can say where each image is used without
     * asking once per image. Names may be left out here; every other field must match {@link #findUsages(UUID)}.
     */
    Map<UUID, List<MediaUsage>> findAllUsages();
}
