package com.wikiaov.access.internal.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Runs the real Flyway migrations against PostgreSQL. Requires Docker. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class JdbcAuditLogIntegrationTest {

    private static final Actor EDITOR = new Actor("http://localhost:8081/realms/wikiaov", "user-1",
            ActorType.HUMAN, "Editor", Set.of("hero:write"));

    @Autowired
    AuditLog auditLog;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    PlatformTransactionManager transactionManager;

    @Test
    void recordsEntryInsideTransaction() {
        UUID heroId = UUID.randomUUID();
        AuditEntry entry = new AuditEntry(EDITOR, "HERO_DRAFT_PUBLISHED", "HERO", heroId, UUID.randomUUID(),
                7L, 8L, "Publish verified patch data", Map.of("patch", "1.63"));

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> auditLog.record(entry));

        Map<String, Object> row = jdbc.sql("""
                        SELECT actor_subject, actor_type, action, after_version, metadata->>'patch' AS patch
                        FROM access.audit_event WHERE aggregate_id = :id
                        """)
                .param("id", heroId)
                .query()
                .singleRow();
        assertThat(row).containsEntry("actor_subject", "user-1")
                .containsEntry("actor_type", "HUMAN")
                .containsEntry("action", "HERO_DRAFT_PUBLISHED")
                .containsEntry("after_version", 8L)
                .containsEntry("patch", "1.63");
    }

    @Test
    void refusesToRecordOutsideTransaction() {
        assertThatThrownBy(() -> auditLog.record(AuditEntry.of(EDITOR, "TEST", "HERO", UUID.randomUUID())))
                .isInstanceOf(IllegalTransactionStateException.class);
    }

    @Test
    void auditRowsCannotBeChanged() {
        UUID heroId = UUID.randomUUID();
        new TransactionTemplate(transactionManager)
                .executeWithoutResult(status -> auditLog.record(AuditEntry.of(EDITOR, "TEST", "HERO", heroId)));

        assertThatThrownBy(() -> jdbc.sql("UPDATE access.audit_event SET action = 'X' WHERE aggregate_id = :id")
                .param("id", heroId).update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.sql("DELETE FROM access.audit_event WHERE aggregate_id = :id")
                .param("id", heroId).update())
                .isInstanceOf(DataAccessException.class);
    }
}
