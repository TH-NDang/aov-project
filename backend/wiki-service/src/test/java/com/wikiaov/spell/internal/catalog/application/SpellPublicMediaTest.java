package com.wikiaov.spell.internal.catalog.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.domain.SpellContent;
import com.wikiaov.spell.internal.domain.SpellContent.ReferenceImage;
import com.wikiaov.spell.internal.domain.SpellContent.SpellState;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SpellPublicMediaTest {
    private final MediaAssets media = mock(MediaAssets.class);
    private final SpellPublicMedia hydration = new SpellPublicMedia(media, new SpellContentRules(media));

    @Test
    void batchesMainStateAndReferenceImagesWithoutExposingUnusableAssets() {
        var icon = UUID.randomUUID();
        var transformed = UUID.randomUUID();
        var reference = UUID.randomUUID();
        var blocked = UUID.randomUUID();
        var missing = UUID.randomUUID();
        var content = new SpellContent(icon, BigDecimal.valueOf(30), 1, "LEVEL", "AVAILABLE", false, 0,
                null, null, "normal", List.of(new SpellState("normal", icon, List.of()),
                        new SpellState("transformed", transformed, List.of()),
                        new SpellState("missing", missing, List.of())),
                List.of(new ReferenceImage(reference, null), new ReferenceImage(blocked, null)), List.of(), null);
        var view = new SpellView(UUID.randomUUID(), "spell", null, content, List.of());
        var ids = Set.of(icon, transformed, reference, blocked, missing);
        when(media.findAll(ids)).thenReturn(Map.of(icon, asset(icon), transformed, asset(transformed),
                reference, asset(reference), blocked, new MediaAssetReference(blocked, MediaSemanticType.SPELL_ICON,
                        MediaAssetState.BLOCKED, asset(blocked).currentVersion())));

        var result = hydration.hydrate(view);

        assertThat(result.content()).isSameAs(content);
        assertThat(result.media()).containsOnlyKeys(icon, transformed, reference);
        verify(media).findAll(ids);
        verifyNoMoreInteractions(media);
    }

    private MediaAssetReference asset(UUID id) {
        return new MediaAssetReference(id, MediaSemanticType.SPELL_ICON, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp", 128, 128,
                        "https://img.athahub.com/assets/" + id + ".webp"));
    }
}
