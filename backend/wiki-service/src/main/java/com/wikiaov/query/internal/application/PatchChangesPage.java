package com.wikiaov.query.internal.application;

import com.wikiaov.patch.PublishedPatch;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** One page of the changes a patch made to one domain, with the patch it belongs to (03, Patch APIs). */
public record PatchChangesPage(
        PublishedPatch patch,
        UUID variantId,
        @Nullable Instant effectiveAt,
        List<?> items,
        int page,
        int size,
        long totalElements
) {
}
