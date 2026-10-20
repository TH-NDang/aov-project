package com.wikiaov.platform;

import java.util.function.Supplier;

/** Optional shared cache for bounded catalog read models, never for credentials or media bytes. */
public interface ReadModelCache {
    enum Area {
        PUBLIC_REFERENCES,
        PUBLIC_TERMS,
        ADMIN_REFERENCES
    }
    <T> T read(Area area, String context, Class<T> type, Supplier<T> loader);
}
