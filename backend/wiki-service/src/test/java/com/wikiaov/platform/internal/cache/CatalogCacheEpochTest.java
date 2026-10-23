package com.wikiaov.platform.internal.cache;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.platform.internal.persistence.cache.CatalogCacheEpochRepository;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class CatalogCacheEpochTest {
    private final List<String> calls = new ArrayList<>();
    private final CatalogCacheEpochRepository repository = (CatalogCacheEpochRepository) Proxy.newProxyInstance(
            CatalogCacheEpochRepository.class.getClassLoader(), new Class<?>[] {CatalogCacheEpochRepository.class},
            (proxy, method, args) -> {
                if (method.getName().equals("advance")) {
                    calls.add("epoch-update");
                    return 1;
                }
                throw new UnsupportedOperationException(method.getName());
            });
    private final CatalogCacheEpoch epochs = new CatalogCacheEpoch(repository);

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
    void coalescesMutationsIntoOneDatabaseAdvanceAtCommit() {
        begin();
        epochs.changed("HERO");
        epochs.changed("ITEM");
        epochs.changed("REFERENCE_SETTINGS");
        assertThat(TransactionSynchronizationManager.getSynchronizations()).hasSize(1);
        assertThat(calls).isEmpty();

        var synchronization = TransactionSynchronizationManager.getSynchronizations().getFirst();
        synchronization.beforeCommit(false);
        assertThat(calls).containsExactly("epoch-update");
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

        assertThat(calls).containsExactly("epoch-update", "epoch-update");
        assertThat(TransactionSynchronizationManager.getResourceMap()).isEmpty();
    }

    private static void begin() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }
}
