package com.wikiaov.platform.internal.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Exercises the committed database fence with the real JPA transaction manager and PostgreSQL. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class CatalogCacheEpochIntegrationTest {
    @Autowired
    private CatalogCacheEpoch epochs;
    @Autowired
    private PlatformTransactionManager transactions;
    @Autowired
    private EntityManager entities;
    @Autowired
    private JdbcTemplate sql;

    @Test
    void flushesPendingDomainChangesBeforeTheFenceIsAdvanced() {
        var id = UUID.randomUUID();
        long before = epochs.current();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var hero = new HeroIdentity();
            hero.setId(id);
            hero.setCode("epoch-flush-" + id);
            hero.setCreatedAt(Instant.now());
            hero.setCreatedByIssuer("https://issuer.test");
            hero.setCreatedBySubject("editor");
            entities.persist(hero);
            epochs.changed("HERO");
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void beforeCommit(boolean readOnly) {
                    assertThat(sql.queryForObject("select count(*) from hero.hero where id=?", Long.class, id))
                            .isEqualTo(1);
                    assertThat(epochs.current()).isEqualTo(before + 1);
                }
            });
        });
    }

    @Test
    void committedMutationsAdvanceTheEpochOnlyOnce() {
        long before = epochs.current();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            epochs.changed("HERO");
            epochs.changed("ITEM");
            epochs.changed("REFERENCE_SETTINGS");
            assertThat(epochs.current()).isEqualTo(before);
        });
        assertThat(epochs.current()).isEqualTo(before + 1);
    }

    @Test
    void rollbackDoesNotAdvanceTheCommittedEpoch() {
        long before = epochs.current();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            epochs.changed("HERO");
            status.setRollbackOnly();
        });
        assertThat(epochs.current()).isEqualTo(before);
    }

    @Test
    void aLateCommitFailureRollsBackAnAlreadyExecutedEpochUpdate() {
        long before = epochs.current();
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
            epochs.changed("HERO");
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void beforeCommit(boolean readOnly) {
                    assertThat(epochs.current()).isEqualTo(before + 1);
                    throw new IllegalStateException("Late validation failed");
                }
            });
        })).isInstanceOf(IllegalStateException.class).hasMessage("Late validation failed");
        assertThat(epochs.current()).isEqualTo(before);
    }

    @Test
    void requiresNewCommitSurvivesOuterRollbackWithoutLeakingItsMarker() {
        long before = epochs.current();
        var inner = new TransactionTemplate(transactions);
        inner.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            epochs.changed("HERO");
            inner.executeWithoutResult(innerStatus -> epochs.changed("MEDIA_ASSET"));
            status.setRollbackOnly();
        });
        assertThat(epochs.current()).isEqualTo(before + 1);
        new TransactionTemplate(transactions).executeWithoutResult(status -> epochs.changed("HERO"));
        assertThat(epochs.current()).isEqualTo(before + 2);
    }
}
