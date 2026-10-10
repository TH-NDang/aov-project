package com.wikiaov.access;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One administrative action to be recorded in the audit trail.
 *
 * @param actor          who performed the action
 * @param action         stable action name, e.g. {@code HERO_DRAFT_PUBLISHED}
 * @param aggregateType  type of the changed object, e.g. {@code HERO}
 * @param aggregateId    id of the changed object
 * @param revisionId     revision affected by the action, if any
 * @param beforeVersion  optimistic version before the change, if any
 * @param afterVersion   optimistic version after the change, if any
 * @param reason         free-text note supplied by the actor, if any
 * @param metadata       extra structured data; must not contain secrets or tokens
 */
public record AuditEntry(Actor actor, String action, String aggregateType, UUID aggregateId,
        @Nullable UUID revisionId, @Nullable Long beforeVersion, @Nullable Long afterVersion,
        @Nullable String reason, Map<String, Object> metadata) {

    public AuditEntry {
        Objects.requireNonNull(actor, "actor");
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(aggregateType, "aggregateType");
        Objects.requireNonNull(aggregateId, "aggregateId");
        metadata = Map.copyOf(metadata);
    }

    /** Shortcut for an entry without revision, versions, reason or metadata. */
    public static AuditEntry of(Actor actor, String action, String aggregateType, UUID aggregateId) {
        return new AuditEntry(actor, action, aggregateType, aggregateId, null, null, null, null, Map.of());
    }
}
