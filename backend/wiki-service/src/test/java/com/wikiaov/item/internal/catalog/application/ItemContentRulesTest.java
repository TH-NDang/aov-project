package com.wikiaov.item.internal.catalog.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.wikiaov.item.internal.application.ItemErrorCode;
import com.wikiaov.item.internal.catalog.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.metadata.persistence.ItemCategoryRepository;
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

class ItemContentRulesTest {
    private final ItemContentRules rules = new ItemContentRules(mock(ItemIdentityRepository.class),
            mock(MediaAssets.class), mock(ItemCategoryRepository.class));

    @Test
    void unwrapsImportedDescriptionsAndPreservesInternalQuotesAndNewlines() {
        String gameplay = "+20 Attack\nTriggers \"Frost\" for 3 seconds.";
        assertThat(ItemContent.unwrapDescription("\"" + gameplay + "\"")).isEqualTo(gameplay);
        assertThat(ItemContent.unwrapDescription(gameplay)).isEqualTo(gameplay);
        assertThat(ItemContent.unwrapDescription(null)).isNull();
    }

    @Test
    void dropsImportQuotesThatPairWithNothing() {
        assertThat(ItemContent.unwrapDescription("\"+30% Attack speed\n\nWhirlwind: extra damage"))
                .isEqualTo("+30% Attack speed\n\nWhirlwind: extra damage");
        assertThat(ItemContent.unwrapDescription(
                "\"+150 Magic\n\nElement: 2 seconds cooldown.\"\n\nHunt: bonus damage\n\nHumble: fewer coins\""))
                .isEqualTo("+150 Magic\n\nElement: 2 seconds cooldown.\n\nHunt: bonus damage\n\nHumble: fewer coins");
        assertThat(ItemContent.unwrapDescription("\"+1200 HP\n\nUnlocks \"Resonance\", an active ability\""))
                .isEqualTo("+1200 HP\n\nUnlocks \"Resonance\", an active ability");
        assertThat(ItemContent.unwrapDescription("\"+150 Armor\n\n(Engraved \"Leave the fight, heal fast.)\""))
                .isEqualTo("+150 Armor\n\n(Engraved \"Leave the fight, heal fast.)\"");
        assertThat(ItemContent.unwrapDescription("Shows \"one\" and \"two\"")).isEqualTo("Shows \"one\" and \"two\"");
    }

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
                        .isEqualTo(ItemErrorCode.ITEM_INVALID_CONTENT))
                .hasMessage("Invalid or duplicate translation locale.");
    }

    private ItemContent localized(String locale) {
        var copies = List.of(new Translation(locale, "Name", null, null, null, null));
        return new ItemContent(null, null, null, null, null, null, null, List.of(), copies, null);
    }

    @Test
    void rejectsDuplicateTranslationsBeforeLookingUpTheIcon() {
        var media = mock(MediaAssets.class);
        var rules = new ItemContentRules(mock(ItemIdentityRepository.class), media, mock(ItemCategoryRepository.class));
        var copy = new Translation("vi-VN", "Name", null, null, null, null);
        var content = new ItemContent(UUID.randomUUID(), null, null, null, null, null, null, List.of(),
                List.of(copy, copy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Invalid or duplicate translation locale.");
        verifyNoInteractions(media);
    }

    @Test
    void retainsUnknownCategoryPrecedenceOverMalformedTranslation() {
        var media = mock(MediaAssets.class);
        var categories = mock(ItemCategoryRepository.class);
        var rules = new ItemContentRules(mock(ItemIdentityRepository.class), media, categories);
        var invalidCopy = new Translation("INVALID", "", null, null, null, null);
        var content = new ItemContent(UUID.randomUUID(), null, null, "missing", null, null, null, List.of(),
                List.of(invalidCopy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Unknown item category.");
        verify(categories).existsById("missing");
        verifyNoInteractions(media);
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
