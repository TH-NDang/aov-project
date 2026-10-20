package com.wikiaov.access.internal.persistence;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.platform.CatalogCacheChanges;
import com.wikiaov.platform.RequestIds;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** Writes audit entries to {@code access.audit_event}. The table is append-only (enforced by a trigger). */
@Repository
class JdbcAuditLog implements AuditLog {

    private static final String INSERT = """
            INSERT INTO access.audit_event (
                id, actor_issuer, actor_subject, actor_type, action, aggregate_type, aggregate_id,
                revision_id, before_version, after_version, reason, request_id, occurred_at, metadata)
            VALUES (
                :id, :actorIssuer, :actorSubject, :actorType, :action, :aggregateType, :aggregateId,
                :revisionId, :beforeVersion, :afterVersion, :reason, :requestId, :occurredAt,
                CAST(:metadata AS jsonb))
            """;

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final Clock clock;
    private final CatalogCacheChanges cacheChanges;

    JdbcAuditLog(JdbcClient jdbc, JsonMapper json, Clock clock, CatalogCacheChanges cacheChanges) {
        this.jdbc = jdbc;
        this.json = json;
        this.clock = clock;
        this.cacheChanges = cacheChanges;
    }

    /** Requires an existing transaction so the audit record commits together with the audited change. */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuditEntry entry) {
        jdbc.sql(INSERT)
                .param("id", UUID.randomUUID())
                .param("actorIssuer", entry.actor().issuer())
                .param("actorSubject", entry.actor().subject())
                .param("actorType", entry.actor().type().name())
                .param("action", entry.action())
                .param("aggregateType", entry.aggregateType())
                .param("aggregateId", entry.aggregateId())
                .param("revisionId", entry.revisionId())
                .param("beforeVersion", entry.beforeVersion())
                .param("afterVersion", entry.afterVersion())
                .param("reason", entry.reason())
                .param("requestId", RequestIds.current().orElse(null))
                .param("occurredAt", Timestamp.from(clock.instant()))
                .param("metadata", entry.metadata().isEmpty() ? null : json.writeValueAsString(entry.metadata()))
                .update();
        cacheChanges.changed(entry.aggregateType());
    }
}
