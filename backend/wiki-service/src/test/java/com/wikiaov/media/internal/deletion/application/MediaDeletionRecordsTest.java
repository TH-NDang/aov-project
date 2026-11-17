package com.wikiaov.media.internal.deletion.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.access.AuditLog;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.asset.application.MediaAssetAccess;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.deletion.persistence.MediaDeletionRepository;
import com.wikiaov.media.internal.query.application.FindMediaUsages;
import com.wikiaov.media.internal.query.application.MediaUrls;
import com.wikiaov.media.internal.upload.persistence.MediaUploadSessionRepository;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaDeletionRecordsTest {
    private final MediaDeletionRepository deletions = mock(MediaDeletionRepository.class);
    private final MediaDeletionRecords records = new MediaDeletionRecords(deletions, mock(MediaAssetAccess.class),
            mock(MediaAssetVersionRepository.class), mock(MediaUploadSessionRepository.class),
            mock(FindMediaUsages.class), mock(MediaUrls.class), mock(AuditLog.class), Clock.systemUTC());

    @Test
    void aStepOfADeletionThatWasNeverRequestedIsNotFound() {
        UUID assetId = UUID.randomUUID();
        when(deletions.lock(assetId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> records.failed(assetId, "STORAGE_UNAVAILABLE"))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getErrorCode())
                        .isEqualTo(MediaErrorCode.MEDIA_DELETION_NOT_FOUND));
    }
}
