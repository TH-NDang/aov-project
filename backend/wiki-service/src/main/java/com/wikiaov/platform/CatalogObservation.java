package com.wikiaov.platform;

import java.util.UUID;

/** Distinguishes an unknown baseline observation from an explicitly dated gameplay change. */
public final class CatalogObservation {
    private CatalogObservation() {
    }

    public static boolean isUnscopedBaseline(String cause, UUID sourceRevisionId, UUID patchVariantId) {
        return patchVariantId == null && ("DATA_BASELINE".equals(cause)
                || sourceRevisionId != null
                        && ("CONTENT_CORRECTION".equals(cause) || "TRANSLATION_UPDATE".equals(cause)));
    }
}
