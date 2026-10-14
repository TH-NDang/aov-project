package com.wikiaov.patch.internal.application.response;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record RegionView(
        UUID id,
        String code,
        String displayName,
        String productName,
        String defaultLocale,
        String timeZone,
        boolean available,
        @Nullable String unavailableReason
) {
}
