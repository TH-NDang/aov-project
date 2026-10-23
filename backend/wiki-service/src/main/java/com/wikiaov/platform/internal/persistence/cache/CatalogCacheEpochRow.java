package com.wikiaov.platform.internal.persistence.cache;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** The singleton database fence used in catalog cache keys. */
@Entity
@Table(schema = "platform", name = "catalog_cache_epoch")
class CatalogCacheEpochRow {
    @Id
    private Short id;

    @Column(nullable = false)
    private long epoch;

    protected CatalogCacheEpochRow() {
    }
}
