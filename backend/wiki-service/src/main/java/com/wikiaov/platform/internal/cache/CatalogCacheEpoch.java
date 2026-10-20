package com.wikiaov.platform.internal.cache;

import com.wikiaov.platform.CatalogCacheChanges;
import jakarta.persistence.EntityManager;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** A database fence remains authoritative even while Redis is unavailable. */
@Component
class CatalogCacheEpoch implements CatalogCacheChanges {
    private static final Object RESOURCE = new Object();
    private static final Set<String> TYPES = Set.of("HERO", "ITEM", "ARCANA", "SPELL", "ENCHANTMENT",
            "PATCH", "REGION", "RANKED_SEASON", "REFERENCE_SETTINGS", "MEDIA_ASSET", "MEDIA_ASSET_VERSION",
            "SKIN_BADGE", "SKIN_BADGE_GROUP", "ITEM_CATEGORY", "ENCHANTMENT_BRANCH", "ITEM_METADATA",
            "ENCHANTMENT_METADATA");
    private final JdbcClient jdbc;
    private final EntityManager entities;

    CatalogCacheEpoch(JdbcClient jdbc, EntityManager entities) {
        this.jdbc = jdbc;
        this.entities = entities;
    }

    long current() {
        return jdbc.sql("SELECT epoch FROM platform.catalog_cache_epoch WHERE id=1").query(Long.class).single();
    }

    @Override
    public void changed(String aggregateType) {
        if (!TYPES.contains(aggregateType))
            return;
        if (!TransactionSynchronizationManager.isSynchronizationActive()
                || !TransactionSynchronizationManager.isActualTransactionActive())
            throw new IllegalStateException("Catalog changes require an active transaction.");
        if (TransactionSynchronizationManager.hasResource(RESOURCE))
            return;
        Object marker = new Object();
        TransactionSynchronizationManager.bindResource(RESOURCE, marker);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void suspend() {
                TransactionSynchronizationManager.unbindResource(RESOURCE);
            }
            @Override
            public void resume() {
                TransactionSynchronizationManager.bindResource(RESOURCE, marker);
            }
            @Override
            public void beforeCommit(boolean readOnly) {
                if (readOnly)
                    throw new IllegalStateException("Catalog changes cannot commit in a read-only transaction.");
                entities.flush();
                jdbc.sql("UPDATE platform.catalog_cache_epoch SET epoch=epoch+1 WHERE id=1").update();
            }
            @Override
            public void afterCompletion(int status) {
                if (TransactionSynchronizationManager.getResource(RESOURCE) == marker)
                    TransactionSynchronizationManager.unbindResource(RESOURCE);
            }
        });
    }
}
