package com.wikiaov.media.internal.persistence.entity;

import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import java.util.UUID;
import org.springframework.data.domain.Persistable;

/**
 * Base for entities whose UUID is assigned by the application.
 *
 * <p>Without it, Spring Data would treat every entity with a non-null id as existing and run a SELECT plus
 * merge instead of a plain INSERT.
 */
@MappedSuperclass
abstract class AssignedIdEntity implements Persistable<UUID> {

    @Transient
    private boolean persisted;

    @Override
    public boolean isNew() {
        return !persisted;
    }

    @PostPersist
    @PostLoad
    void markPersisted() {
        persisted = true;
    }
}
