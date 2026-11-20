package com.wikiaov.enchantment.internal.catalog.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchRepository;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import java.math.BigDecimal;
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
        return new EnchantmentContent(null, null, null, null, null, null, null, null, null, null, copies, null);
    }

    @Test
    void rejectsDuplicateTranslationsBeforeLookingUpTheIcon() {
        var media = mock(MediaAssets.class);
        var rules = new EnchantmentContentRules(media, mock(EnchantmentBranchRepository.class));
        var copy = new Translation("vi-VN", "Name", null, null, null, null);
        var content = new EnchantmentContent(UUID.randomUUID(), null, null, null, null, null, null, null, null,
                null, List.of(copy, copy), null);

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
        var content = new EnchantmentContent(UUID.randomUUID(), "missing", null, null, null, null, null, null, null,
                null, List.of(invalidCopy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Unknown enchantment branch.");
        verify(branches).existsById("missing");
        verifyNoInteractions(media);
    }

    @Test
    void acceptsAnActiveEnchantmentUsedOnceFromTheFourthMinute() {
        var content = used("ACTIVE", null, null, 1, 240, null);

        assertThatCode(() -> rules.validate(content)).doesNotThrowAnyException();
    }

    @Test
    void acceptsACooldownThatGrowsWithEachUse() {
        var content = used("ACTIVE", BigDecimal.valueOf(100), BigDecimal.valueOf(310), 2, null, 720);

        assertThatCode(() -> rules.validate(content)).doesNotThrowAnyException();
    }

    @Test
    void readsAMissingActivationAsUnknown() {
        assertThat(used(null, null, null, null, null, null).activation()).isEqualTo("UNKNOWN");
    }

    @Test
    void rejectsAnActivationOutsideTheKnownKinds() {
        assertInvalid(used("TOGGLE", null, null, null, null, null), "Unknown enchantment activation.");
    }

    @Test
    void rejectsACooldownOfZeroSeconds() {
        assertInvalid(used("PASSIVE", BigDecimal.ZERO, null, null, null, null),
                "A cooldown must be more than zero seconds.");
    }

    @Test
    void rejectsALongestCooldownWithoutAFirstOne() {
        assertInvalid(used("ACTIVE", null, BigDecimal.TEN, null, null, null),
                "The longest cooldown needs a first cooldown and cannot be shorter than it.");
    }

    @Test
    void rejectsALongestCooldownShorterThanTheFirst() {
        assertInvalid(used("ACTIVE", BigDecimal.TEN, BigDecimal.ONE, null, null, null),
                "The longest cooldown needs a first cooldown and cannot be shorter than it.");
    }

    @Test
    void rejectsZeroUsesPerMatch() {
        assertInvalid(used("ACTIVE", null, null, 0, null, null), "Uses per match must be at least one.");
    }

    @Test
    void rejectsANegativeMatchTime() {
        assertInvalid(used("ACTIVE", null, null, null, -1, null), "Match times cannot be negative.");
    }

    @Test
    void rejectsAWindowThatClosesBeforeItOpens() {
        assertInvalid(used("ACTIVE", null, null, null, 720, 240),
                "An enchantment must become available before it stops being available.");
    }

    @Test
    void comparesCooldownsWrittenWithAnotherScaleAsTheSameGameplay() {
        var stored = used("PASSIVE", new BigDecimal("10.0"), null, null, null, null);
        var sent = used("PASSIVE", BigDecimal.TEN, null, null, null, null);

        assertThat(stored.mechanics()).isEqualTo(sent.mechanics());
    }

    private void assertInvalid(EnchantmentContent content, String message) {
        assertThatThrownBy(() -> rules.validate(content))
                .isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.getErrorCode())
                        .isEqualTo(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT))
                .hasMessage(message);
    }

    private static EnchantmentContent used(String activation, BigDecimal cooldown, BigDecimal longest, Integer uses,
            Integer from, Integer until) {
        return new EnchantmentContent(null, null, null, null, activation, cooldown, longest, uses, from, until,
                List.of(), null);
    }
}
