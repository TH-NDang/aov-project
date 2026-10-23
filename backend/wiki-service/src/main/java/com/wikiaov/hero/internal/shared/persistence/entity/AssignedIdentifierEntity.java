package com.wikiaov.hero.internal.shared.persistence.entity;

import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

/** Keeps assigned identifiers insert-only until JPA has persisted or loaded the entity. */
@MappedSuperclass
public abstract class AssignedIdentifierEntity<ID> implements Persistable<ID> {
    @Transient
    private boolean newEntity = true;

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostLoad
    @PostPersist
    protected void markPersisted() {
        newEntity = false;
    }
}
