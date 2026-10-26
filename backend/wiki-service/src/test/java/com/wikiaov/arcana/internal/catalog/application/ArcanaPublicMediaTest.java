package com.wikiaov.arcana.internal.catalog.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.wikiaov.arcana.internal.application.response.ArcanaView;
import com.wikiaov.arcana.internal.domain.ArcanaContent;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ArcanaPublicMediaTest {
    private final MediaAssets media = mock(MediaAssets.class);
    private final ArcanaPublicMedia hydration = new ArcanaPublicMedia(media, new ArcanaContentRules(media));

    @Test
    void batchesReturnedRowAssetsAndExcludesUnusableOrUnrelatedMetadata() {
        var firstId = UUID.randomUUID();
        var blockedId = UUID.randomUUID();
        var pendingId = UUID.randomUUID();
        var unrelatedId = UUID.randomUUID();
        var ready = asset(firstId);
        when(media.findAll(Set.of(firstId, blockedId, pendingId))).thenReturn(Map.of(firstId, ready,
                blockedId, new MediaAssetReference(blockedId, MediaSemanticType.ARCANA_ICON, MediaAssetState.BLOCKED,
                        ready.currentVersion()),
                pendingId,
                new MediaAssetReference(pendingId, MediaSemanticType.ARCANA_ICON, MediaAssetState.ACTIVE, null),
                unrelatedId, asset(unrelatedId)));

        var rows = hydration.hydrate(List.of(view(firstId), view(blockedId), view(pendingId)));

        assertThat(rows.getFirst().media()).containsOnlyKeys(firstId).containsEntry(firstId, ready);
        assertThat(rows.get(1).media()).isEmpty();
        assertThat(rows.get(2).media()).isEmpty();
        verify(media).findAll(Set.of(firstId, blockedId, pendingId));
        verifyNoMoreInteractions(media);
    }

    @Test
    void skipsMediaReadsForEmptyRowsAndMissingIcons() {
        assertThat(hydration.hydrate(List.of())).isEmpty();
        assertThat(hydration.hydrate(view(null)).media()).isEmpty();

        verifyNoInteractions(media);
    }

    private ArcanaView view(UUID icon) {
        return new ArcanaView(UUID.randomUUID(), "sample", null,
                new ArcanaContent(icon, "RED", 3, List.of(), List.of(), null), List.of());
    }

    private MediaAssetReference asset(UUID id) {
        return new MediaAssetReference(id, MediaSemanticType.ARCANA_ICON, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp", 128, 128,
                        "https://img.athahub.com/assets/" + id + ".webp"));
    }
}
