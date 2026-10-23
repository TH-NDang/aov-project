package com.wikiaov.arcana.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.arcana.internal.application.ArcanaErrorCode;
import com.wikiaov.arcana.internal.domain.ArcanaContent;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Stat;
import com.wikiaov.platform.CatalogText.Translation;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ArcanaContentRulesTest {
    private final ArcanaContentRules rules = new ArcanaContentRules(mock(MediaAssets.class));

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
                        .isEqualTo(ArcanaErrorCode.ARCANA_INVALID_CONTENT))
                .hasMessage("Invalid or duplicate translation locale.");
    }

    private ArcanaContent localized(String locale) {
        var copies = List.of(new Translation(locale, "Name", null, null, null, null));
        return new ArcanaContent(null, null, null, List.of(), copies, null);
    }

    @Test
    void rejectsDuplicateTranslationsBeforeLookingUpTheIcon() {
        var media = mock(MediaAssets.class);
        var rules = new ArcanaContentRules(media);
        var copy = new Translation("vi-VN", "Name", null, null, null, null);
        var content = new ArcanaContent(UUID.randomUUID(), null, null, List.of(), List.of(copy, copy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Invalid or duplicate translation locale.");
        verifyNoInteractions(media);
    }

    @ParameterizedTest
    @ValueSource(strings = {"defense", "movement-speed", "hp5"})
    void acceptsNumericStatSlugs(String key) {
        assertThatCode(() -> rules.validate(
                new ArcanaContent(null, null, null, List.of(new Stat(key, BigDecimal.ONE, null)), List.of(), null)))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Defense", "move_speed", "-speed", "speed-", "speed--rate"})
    void rejectsMalformedNumericStatSlugs(String key) {
        assertThatThrownBy(() -> rules.validate(
                new ArcanaContent(null, null, null, List.of(new Stat(key, BigDecimal.ONE, null)), List.of(), null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid or duplicate numeric stat.");
    }

}
