package com.wikiaov.media.internal.application.response;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** An owner in the image owner catalog (ADR-017); {@code assetCount} counts assets with a source naming it. */
public record MediaOwnerView(
        UUID id,
        String name,
        @Nullable String contactUrl,
        long assetCount,
        long version
) {
}
