package com.wikiaov.media.internal.capacity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.EstimateFile;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.Target;
import com.wikiaov.media.internal.capacity.application.port.R2Analytics;
import com.wikiaov.media.internal.source.application.SourceOrphans;
import com.wikiaov.media.internal.source.persistence.SourceObjectRepository;
import com.wikiaov.media.internal.source.persistence.SourceUploadSessionRepository;
import com.wikiaov.media.internal.storage.application.port.StorageLayout;
import com.wikiaov.media.internal.upload.persistence.MediaUploadSessionRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

class StorageCapacityTest {
    private final MediaAssetVersionRepository mediaVersions = mock(MediaAssetVersionRepository.class);
    private final MediaUploadSessionRepository mediaUploads = mock(MediaUploadSessionRepository.class);
    private final SourceObjectRepository sourceObjects = mock(SourceObjectRepository.class);
    private final SourceUploadSessionRepository sourceUploads = mock(SourceUploadSessionRepository.class);
    private final SourceOrphans orphans = mock(SourceOrphans.class);
    private final StorageLayout layout = mock(StorageLayout.class);
    private final R2Analytics analytics = mock(R2Analytics.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final StorageCapacity capacity = new StorageCapacity(mediaVersions, mediaUploads, sourceObjects,
            sourceUploads, orphans, layout, analytics,
            new CapacityProperties(10_000_000_000L, 1_000_000, 10_000_000, new BigDecimal("0.015"),
                    new BigDecimal("4.50"), new BigDecimal("0.36"), 0.8, 0.95),
            Clock.fixed(Instant.parse("2026-11-17T08:00:00Z"), ZoneOffset.UTC), transactions);

    @BeforeEach
    void emptyCatalogs() {
        when(layout.assetsBucket()).thenReturn("aov-assets");
        when(layout.sourcesBucket()).thenReturn("aov-source-private");
        when(layout.stagingBucket()).thenReturn("aov-staging");
        when(mediaUploads.pending(any())).thenReturn(mock(MediaUploadSessionRepository.Pending.class));
        when(sourceUploads.pending(any())).thenReturn(mock(SourceObjectRepository.Total.class));
        when(sourceObjects.total()).thenReturn(mock(SourceObjectRepository.Total.class));
        when(orphans.totals()).thenReturn(new SourceOrphans.Totals(0, 0));
        when(analytics.read(any())).thenReturn(R2Analytics.Usage.notConfigured());
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
    }

    @Test
    void theSummaryAsksCloudflareBeforeItOpensAReadOnlyTransaction() {
        capacity.summary();

        assertCloudflareWasReadOutsideTheTransaction();
    }

    @Test
    void anEstimateAsksCloudflareBeforeItOpensAReadOnlyTransaction() {
        capacity.estimate(Target.SOURCES, List.of(new EstimateFile("a".repeat(64), 1_024)));

        assertCloudflareWasReadOutsideTheTransaction();
    }

    private void assertCloudflareWasReadOutsideTheTransaction() {
        var definition = ArgumentCaptor.forClass(TransactionDefinition.class);
        InOrder order = inOrder(analytics, transactions);
        order.verify(analytics).read(any());
        order.verify(transactions).getTransaction(definition.capture());
        order.verify(transactions).commit(any());
        order.verifyNoMoreInteractions();
        assertThat(definition.getValue().isReadOnly()).isTrue();
    }
}
