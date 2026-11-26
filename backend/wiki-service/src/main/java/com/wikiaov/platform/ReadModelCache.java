package com.wikiaov.platform;

import java.util.function.Supplier;

/** Optional shared cache for bounded catalog read models, never for credentials or media bytes. */
public interface ReadModelCache {
    enum Area {
        PUBLIC_REFERENCES,
        PUBLIC_TERMS,
        /** Public catalog lists and the patch marks built from them; the same TTL and epoch as references. */
        PUBLIC_CATALOGS,
        ADMIN_REFERENCES
    }

    <T> T read(Area area, String context, Class<T> type, Supplier<T> loader);
}
