package com.wikiaov.patch;
import java.util.UUID;
/** Reopens editorial review when a module records new published gameplay data. */
public interface PatchDataReviews {
    void markDirty(UUID patchVariantId);
}
