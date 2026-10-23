package com.wikiaov.patch;

import com.wikiaov.platform.PageSlice;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PatchCatalog {
    Map<String, Object> published(UUID patchId, String region, String locale);

    PageSlice<Map<String, Object>> list(String region, String locale, int page, int size);

    List<PatchReleaseReference> releases(String region);
}
