package com.wikiaov.enchantment.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchRepository;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class EnchantmentContentRulesTest {
    private final EnchantmentContentRules rules = new EnchantmentContentRules(mock(MediaAssets.class),
            mock(EnchantmentBranchRepository.class));

    @ParameterizedTest
    @ValueSource(strings = {"en", "vi-VN", "de", "fr-FR", "eng"})
    void acceptsSupportedLocaleSyntax(String locale) {
        assertThatCode(() -> rules.validate(localized(locale))).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"EN", "en-us", "e", "english", "en_US", "en-123"})
    void rejectsMalformedLocaleSyntax(String locale) {
        assertThatThrownBy(() -> rules.validate(localized(locale)))
                .isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.getErrorCode())
                        .isEqualTo(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT))
                .hasMessage("Invalid or duplicate translation locale.");
    }

    private EnchantmentContent localized(String locale) {
        var copies = List.of(new Translation(locale, "Name", null, null, null, null));
        return new EnchantmentContent(null, null, null, null, copies, null);
    }

    @Test
    void rejectsDuplicateTranslationsBeforeLookingUpTheIcon() {
        var media = mock(MediaAssets.class);
        var rules = new EnchantmentContentRules(media, mock(EnchantmentBranchRepository.class));
        var copy = new Translation("vi-VN", "Name", null, null, null, null);
        var content = new EnchantmentContent(UUID.randomUUID(), null, null, null, List.of(copy, copy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Invalid or duplicate translation locale.");
        verifyNoInteractions(media);
    }

    @Test
    void retainsUnknownBranchPrecedenceOverMalformedTranslation() {
        var media = mock(MediaAssets.class);
        var branches = mock(EnchantmentBranchRepository.class);
        var rules = new EnchantmentContentRules(media, branches);
        var invalidCopy = new Translation("INVALID", "", null, null, null, null);
        var content = new EnchantmentContent(UUID.randomUUID(), "missing", null, null, List.of(invalidCopy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Unknown enchantment branch.");
        verify(branches).existsById("missing");
        verifyNoInteractions(media);
    }

}
