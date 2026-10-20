package com.wikiaov.platform;

/** Records an audited catalog change inside its owning transaction. */
public interface CatalogCacheChanges {
    void changed(String aggregateType);
}
