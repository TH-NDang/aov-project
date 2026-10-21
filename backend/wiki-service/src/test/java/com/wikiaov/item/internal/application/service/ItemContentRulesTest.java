package com.wikiaov.item.internal.application.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.persistence.*;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Stat;
import com.wikiaov.platform.CatalogText.Translation;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ItemContentRulesTest {
    private final ItemContentRules rules = new ItemContentRules(mock(ItemIdentityRepository.class),
            mock(MediaAssets.class), mock(ItemCategoryRepository.class));

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

    private ItemContent localized(String locale) {
        var copies = List.of(new Translation(locale, "Name", null, null, null, null));
        return new ItemContent(null, null, null, null, null, null, null, List.of(), copies, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"defense", "movement-speed", "hp5"})
    void acceptsNumericStatSlugs(String key) {
        assertThatCode(() -> rules.validate(new ItemContent(null, null, null, null, null, null, null,
                List.of(new Stat(key, BigDecimal.ONE, null)), List.of(), null))).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Defense", "move_speed", "-speed", "speed-", "speed--rate"})
    void rejectsMalformedNumericStatSlugs(String key) {
        assertThatThrownBy(() -> rules.validate(new ItemContent(null, null, null, null, null, null, null,
                List.of(new Stat(key, BigDecimal.ONE, null)), List.of(), null))).isInstanceOf(ApiException.class)
                .hasMessage("Invalid or duplicate numeric stat.");
    }

}
