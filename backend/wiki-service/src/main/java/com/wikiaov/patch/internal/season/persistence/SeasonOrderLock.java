package com.wikiaov.patch.internal.season.persistence;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

/** Serializes insertion even when the shared season order is still empty. */
@Repository
public class SeasonOrderLock {
    private final EntityManager entities;

    public SeasonOrderLock(EntityManager entities) {
        this.entities = entities;
    }

    public void acquire() {
        entities.createNativeQuery("LOCK TABLE patch.ranked_season IN EXCLUSIVE MODE").executeUpdate();
    }
}
