package com.wikiaov.community.tournament.internal.archive.persistence;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

/**
 * Serializes short editorial mutations so JSON references and recoverable deletion share one database fence. A
 * PostgreSQL advisory lock rather than a row lock, because the fence must hold before the rows it protects exist; it
 * is released with the transaction.
 */
@Repository
public class RegistryWriteGuard {
    private final EntityManager entities;

    public RegistryWriteGuard(EntityManager entities) {
        this.entities = entities;
    }

    public void acquire() {
        entities.createNativeQuery("SELECT 1 FROM pg_advisory_xact_lock(173535037,1)").getSingleResult();
    }
}
