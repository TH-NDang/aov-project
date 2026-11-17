package com.wikiaov.hero.internal.reference.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.internal.reference.persistence.HeroReferenceRepository;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.terminology.AdminReferenceProvider.Row;
import com.wikiaov.terminology.PublicReferenceProvider.Scope;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeroPublicReferencesTest {
    @Test
    void usesPublishedProjectionAndBatchesHeadMetadataWithActualTranslationLocale() {
        var query = mock(HeroReferenceRepository.class);
        var contexts = mock(GameplayContexts.class);
        var media = mock(MediaAssets.class);
        UUID id = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        UUID rulesetId = UUID.randomUUID();
        UUID patchId = UUID.randomUUID();
        var at = Instant.parse("2026-10-20T00:00:00Z");
        var context = new GameplayContext(UUID.randomUUID(), "VN", rulesetId, "standard", UUID.randomUUID(), "test",
                patchId, 1, at);
        var head = new MediaAssetReference(assetId, MediaSemanticType.HERO_HEAD, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/png", 128, 128, "/head.png"));
        when(contexts.resolve("VN", at)).thenReturn(context);
        when(contexts.rulesetVariants(rulesetId))
                .thenReturn(List.of(new PatchVariantReference(patchId, context.patchId(),
                        rulesetId, null, 1, true)));
        when(query.published(context, Map.of(patchId, 1L), at, true)).thenReturn(List.of(
                new Row(id, UUID.randomUUID(), assetId, "vi-VN", "Airi", "Summary")));
        when(media.findAll(Set.of(assetId))).thenReturn(Map.of(assetId, head));
        var provider = new HeroPublicReferences(query, contexts, media, Clock.fixed(at, ZoneOffset.UTC));
        var rows = provider.references("VN", "en-US");
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().id()).isEqualTo(id);
        assertThat(rows.getFirst().icon()).isEqualTo("/head.png");
        assertThat(rows.getFirst().locale()).isEqualTo("vi-VN");
        verify(media).findAll(Set.of(assetId));
        verify(media, never()).find(any());
        clearInvocations(contexts);
        assertThat(provider.references(new Scope(context, Map.of(patchId, 1L), at), "en-US")).isEqualTo(rows);
        verifyNoInteractions(contexts);
    }
}
