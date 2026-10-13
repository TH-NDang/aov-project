package com.wikiaov.media.internal.web.request;

import com.wikiaov.media.MediaUsageScope;
import org.jspecify.annotations.Nullable;

/** {@code scope} query parameter of the usage lookup. */
public enum UsageScopeParameter {
    ANY,
    CURRENT,
    DRAFT,
    HISTORICAL;

    public @Nullable MediaUsageScope toScope() {
        return this == ANY ? null : MediaUsageScope.valueOf(name());
    }
}
