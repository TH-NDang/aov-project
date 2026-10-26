package com.wikiaov.enchantment.internal.metadata.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchRepository;
import com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchTranslationRepository;
import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranch;
import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranchTranslation;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PublicEnchantmentBranchCatalogTest {
    private final EnchantmentBranchRepository records = mock(EnchantmentBranchRepository.class);
    private final EnchantmentBranchTranslationRepository translations = mock(
            EnchantmentBranchTranslationRepository.class);
    private final MediaAssets media = mock(MediaAssets.class);
    private final PublicEnchantmentBranchCatalog catalog = new PublicEnchantmentBranchCatalog(records, translations,
            media);

    @Test
    void readsTranslationsAndUsableImagesInBulkWithRequestedLocaleAndFallback() {
        var icon = UUID.randomUUID();
        var background = UUID.randomUUID();
        var row = new EnchantmentBranch();
        row.setCode("sample");
        row.setDisplayOrder(3);
        row.setColor("#ffcc00");
        row.setIconAssetId(icon);
        row.setBackgroundAssetId(background);
        when(records.findAllByOrderByDisplayOrderAscCodeAsc()).thenReturn(List.of(row));
        when(translations.findByOwnerCodeInOrderByLocale(List.of("sample")))
                .thenReturn(List.of(text("vi-VN", "Tên nhóm"), text("en-US", "Group")));
        var ready = new MediaAssetReference(icon, MediaSemanticType.ENCHANTMENT_ICON, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp", 64, 64,
                        "https://img.athahub.com/assets/ready.webp"));
        when(media.findAll(Set.of(icon, background))).thenReturn(Map.of(icon, ready,
                background, new MediaAssetReference(background, MediaSemanticType.OTHER, MediaAssetState.BLOCKED,
                        ready.currentVersion())));

        var english = catalog.read("en-US");
        var fallback = catalog.read("fr-FR");

        assertThat(english).singleElement().satisfies(view -> {
            assertThat(view.code()).isEqualTo("sample");
            assertThat(view.displayOrder()).isEqualTo(3);
            assertThat(view.icon()).isEqualTo(ready);
            assertThat(view.background()).isNull();
            assertThat(view.translations()).singleElement().satisfies(text -> {
                assertThat(text.locale()).isEqualTo("en-US");
                assertThat(text.name()).isEqualTo("Group");
            });
        });
        assertThat(fallback.getFirst().translations()).singleElement()
                .satisfies(text -> assertThat(text.locale()).isEqualTo("vi-VN"));
        verify(translations, times(2)).findByOwnerCodeInOrderByLocale(List.of("sample"));
        verify(media, times(2)).findAll(Set.of(icon, background));
        verifyNoMoreInteractions(translations, media);
    }

    @Test
    void validatesLocaleBeforeReadingMetadataAndSkipsMediaForEmptyCatalog() {
        assertThatThrownBy(() -> catalog.read("not a locale")).isInstanceOf(ApiException.class);
        verifyNoInteractions(records, translations, media);

        assertThat(catalog.read("vi-VN")).isEmpty();
        verifyNoInteractions(translations, media);
    }

    private EnchantmentBranchTranslation text(String locale, String name) {
        var text = new EnchantmentBranchTranslation();
        text.setOwnerCode("sample");
        text.setLocale(locale);
        text.setName(name);
        return text;
    }
}
