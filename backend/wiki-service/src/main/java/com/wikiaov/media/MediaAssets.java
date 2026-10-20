package com.wikiaov.media;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Read contract for other modules, e.g. hero checks an asset before binding it as a portrait. */
public interface MediaAssets {

    /** Returns the asset, or empty if it does not exist. */
    Optional<MediaAssetReference> find(UUID assetId);

    /**
     * Returns all existing assets by ID in a bounded number of queries. Missing IDs are omitted; lifecycle
     * and current-version semantics match {@link #find(UUID)}. Callers must still check usability.
     */
    Map<UUID, MediaAssetReference> findAll(Collection<UUID> assetIds);
}
