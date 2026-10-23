package com.wikiaov.platform.internal.persistence.cache;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Reads the current fence without entity caching and advances it atomically in the caller's transaction. */
public interface CatalogCacheEpochRepository extends Repository<CatalogCacheEpochRow, Short> {
    @Query("select e.epoch from CatalogCacheEpochRow e where e.id = 1")
    long current();

    // Flushing domain changes first preserves the domain-lock -> fence-lock ordering.
    @Modifying(flushAutomatically = true)
    @Query("update CatalogCacheEpochRow e set e.epoch = e.epoch + 1 where e.id = 1")
    int advance();
}
