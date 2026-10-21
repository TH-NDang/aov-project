package com.wikiaov.enchantment.internal.application.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.enchantment.internal.persistence.*;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import java.util.List;
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
        assertThatThrownBy(() -> rules.validate(localized(locale))).isInstanceOf(ApiException.class)
                .hasMessage("Invalid or duplicate translation locale.");
    }

    private EnchantmentContent localized(String locale) {
        var copies = List.of(new Translation(locale, "Name", null, null, null, null));
        return new EnchantmentContent(null, null, null, null, copies, null);
    }

}
