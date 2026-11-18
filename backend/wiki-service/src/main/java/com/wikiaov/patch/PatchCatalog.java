package com.wikiaov.patch;

import com.wikiaov.platform.PageSlice;
import java.util.List;
import java.util.UUID;

public interface PatchCatalog {
    PublishedPatch published(UUID patchId, String region, String locale);

    PublishedPatch publishedVariant(UUID patchId, UUID variantId, String region, String locale);

    PageSlice<PublishedPatch> list(String region, String locale, int page, int size);

    List<PatchReleaseReference> releases(String region);
}
