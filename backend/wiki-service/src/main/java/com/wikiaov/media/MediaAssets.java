package com.wikiaov.media;

import java.util.Optional;
import java.util.UUID;

/** Read contract for other modules, e.g. hero checks an asset before binding it as a portrait. */
public interface MediaAssets {

    /** Returns the asset, or empty if it does not exist. */
    Optional<MediaAssetReference> find(UUID assetId);
}
