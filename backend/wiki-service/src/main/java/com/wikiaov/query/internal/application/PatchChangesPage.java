package com.wikiaov.query.internal.application;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** One page of the changes a patch made to one domain, with the patch it belongs to (03, Patch APIs). */
public record PatchChangesPage(
        Map<String, Object> patch,
        UUID variantId,
        @Nullable Object effectiveAt,
        List<Map<String, Object>> items,
        int page,
        int size,
        long totalElements
) {
}
