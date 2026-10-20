package com.wikiaov.platform.internal.cache;

import static org.assertj.core.api.Assertions.*;

import jakarta.persistence.EntityManager;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class CatalogCacheEpochTest {
    private final List<String> calls = new ArrayList<>();
    private final EntityManager entities = (EntityManager) Proxy.newProxyInstance(EntityManager.class.getClassLoader(),
            new Class<?>[] {EntityManager.class}, (proxy, method, args) -> {
                if (method.getName().equals("flush")) {
                    calls.add("flush");
                    return null;
                }
                throw new UnsupportedOperationException(method.getName());
            });
    private final JdbcClient.StatementSpec statement = (JdbcClient.StatementSpec) Proxy.newProxyInstance(
            JdbcClient.StatementSpec.class.getClassLoader(), new Class<?>[] {JdbcClient.StatementSpec.class},
            (proxy, method, args) -> {
                if (method.getName().equals("update")) {
                    calls.add("epoch-update");
                    return 1;
                }
                throw new UnsupportedOperationException(method.getName());
            });
    private final JdbcClient jdbc = (JdbcClient) Proxy.newProxyInstance(JdbcClient.class.getClassLoader(),
            new Class<?>[] {JdbcClient.class}, (proxy, method, args) -> {
                if (method.getName().equals("sql"))
                    return statement;
                throw new UnsupportedOperationException(method.getName());
            });
    private final CatalogCacheEpoch epochs = new CatalogCacheEpoch(jdbc, entities);

    @AfterEach
    void cleanThreadResources() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            for (var synchronization : TransactionSynchronizationManager.getSynchronizations())
                synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        }
        TransactionSynchronizationManager.clear();
    }

    @Test
    void ignoresPrivateAggregatesAndRejectsCatalogChangesOutsideATransaction() {
        epochs.changed("USER_PROFILE");
        epochs.changed("AUTH_SESSION");
        assertThatThrownBy(() -> epochs.changed("HERO")).isInstanceOf(IllegalStateException.class);
        assertThat(calls).isEmpty();
    }

    @Test
    void coalescesMutationsAndFlushesOrmBeforeAcquiringTheEpochLock() {
        begin();
        epochs.changed("HERO");
        epochs.changed("ITEM");
        epochs.changed("REFERENCE_SETTINGS");
        assertThat(TransactionSynchronizationManager.getSynchronizations()).hasSize(1);
        assertThat(calls).isEmpty();

        var synchronization = TransactionSynchronizationManager.getSynchronizations().getFirst();
        synchronization.beforeCommit(false);
        assertThat(calls).containsExactly("flush", "epoch-update");
        synchronization.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);
        assertThat(TransactionSynchronizationManager.getResourceMap()).isEmpty();
    }

    @Test
    void rollbackClearsTheMarkerWithoutInvalidatingCommittedData() {
        begin();
        epochs.changed("HERO");
        TransactionSynchronizationManager.getSynchronizations().getFirst()
                .afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        assertThat(calls).isEmpty();
        assertThat(TransactionSynchronizationManager.getResourceMap()).isEmpty();
    }

    @Test
    void cannotCommitACatalogMutationFromAReadOnlyTransaction() {
        begin();
        epochs.changed("HERO");
        assertThatThrownBy(() -> TransactionSynchronizationManager.getSynchronizations().getFirst().beforeCommit(true))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("read-only");
        assertThat(calls).isEmpty();
    }

    @Test
    void suspendedOuterAndIndependentInnerTransactionsKeepSeparateMarkers() {
        begin();
        epochs.changed("HERO");
        var outer = TransactionSynchronizationManager.getSynchronizations().getFirst();
        outer.suspend();
        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.initSynchronization();
        epochs.changed("MEDIA_ASSET");
        var inner = TransactionSynchronizationManager.getSynchronizations().getFirst();
        inner.beforeCommit(false);
        inner.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);
        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.initSynchronization();
        outer.resume();
        TransactionSynchronizationManager.registerSynchronization(outer);
        epochs.changed("REFERENCE_SETTINGS");
        assertThat(TransactionSynchronizationManager.getSynchronizations()).hasSize(1);
        outer.beforeCommit(false);
        outer.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);

        assertThat(calls).containsExactly("flush", "epoch-update", "flush", "epoch-update");
        assertThat(TransactionSynchronizationManager.getResourceMap()).isEmpty();
    }

    private static void begin() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }
}
