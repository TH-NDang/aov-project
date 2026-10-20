package com.wikiaov.platform.internal.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.persistence.EntityManager;
import java.lang.reflect.Proxy;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Exercises the committed database fence without requiring Redis or the application server. */
@EnabledIf("databaseAvailable")
class CatalogCacheEpochIntegrationTest {
    private static PostgreSQLContainer database;
    private static CatalogCacheEpoch epochs;
    private static DataSourceTransactionManager transactions;

    static boolean databaseAvailable() {
        return System.getenv("WIKI_TEST_DB_URL") != null || DockerClientFactory.instance().isDockerAvailable();
    }

    @BeforeAll
    static void connect() {
        var source = new DriverManagerDataSource();
        String external = System.getenv("WIKI_TEST_DB_URL");
        if (external == null) {
            database = new PostgreSQLContainer("postgres:17.6");
            database.start();
            source.setUrl(database.getJdbcUrl());
            source.setUsername(database.getUsername());
            source.setPassword(database.getPassword());
        } else {
            source.setUrl(external);
            source.setUsername("wiki_test");
            source.setPassword("");
        }
        Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
        transactions = new DataSourceTransactionManager(source);
        var entities = (EntityManager) Proxy.newProxyInstance(EntityManager.class.getClassLoader(),
                new Class<?>[] {EntityManager.class}, (proxy, method, args) -> {
                    if (method.getName().equals("flush"))
                        return null;
                    throw new UnsupportedOperationException(method.getName());
                });
        epochs = new CatalogCacheEpoch(JdbcClient.create(source), entities);
    }

    @AfterAll
    static void stop() {
        if (database != null)
            database.stop();
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
