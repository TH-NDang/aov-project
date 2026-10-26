package com.wikiaov.enchantment.internal.catalog.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EnchantmentPublicMediaTest {
    private final MediaAssets media = mock(MediaAssets.class);
    private final EnchantmentPublicMedia hydration = new EnchantmentPublicMedia(media, new EnchantmentContentRules(
            media, mock(com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchRepository.class)));

    @Test
    void batchesReturnedRowAssetsAndExcludesUnusableOrUnrelatedMetadata() {
        var firstId = UUID.randomUUID();
        var blockedId = UUID.randomUUID();
        var pendingId = UUID.randomUUID();
        var unrelatedId = UUID.randomUUID();
        var ready = asset(firstId);
        when(media.findAll(Set.of(firstId, blockedId, pendingId))).thenReturn(Map.of(firstId, ready,
                blockedId,
                new MediaAssetReference(blockedId, MediaSemanticType.ENCHANTMENT_ICON, MediaAssetState.BLOCKED,
                        ready.currentVersion()),
                pendingId,
                new MediaAssetReference(pendingId, MediaSemanticType.ENCHANTMENT_ICON, MediaAssetState.ACTIVE, null),
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

    private EnchantmentView view(UUID icon) {
        return new EnchantmentView(UUID.randomUUID(), "sample", null,
                new EnchantmentContent(icon, "vuc-hon-mang", 2, 0, List.of(), null), List.of());
    }

    private MediaAssetReference asset(UUID id) {
        return new MediaAssetReference(id, MediaSemanticType.ENCHANTMENT_ICON, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp", 128, 128,
                        "https://img.athahub.com/assets/" + id + ".webp"));
    }
}
