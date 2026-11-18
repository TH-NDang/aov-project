package com.wikiaov.platform;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Distinguishes an unknown baseline observation from an explicitly dated gameplay change. */
public final class CatalogObservation {
    private CatalogObservation() {
    }

    public static boolean isUnscopedBaseline(@Nullable CatalogCause cause, @Nullable UUID sourceRevisionId,
            @Nullable UUID patchVariantId) {
        return patchVariantId == null && (cause == CatalogCause.DATA_BASELINE
                || sourceRevisionId != null && cause != null && cause.revisesSource());
    }
}
