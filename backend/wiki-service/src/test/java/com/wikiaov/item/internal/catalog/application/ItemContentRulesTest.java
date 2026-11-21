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
import com.wikiaov.item.internal.domain.ItemContent.Activation;
import com.wikiaov.item.internal.domain.ItemContent.Effect;
import com.wikiaov.item.internal.domain.ItemContent.Grant;
import com.wikiaov.item.internal.domain.ItemContent.Growth;
import com.wikiaov.item.internal.domain.ItemContent.Scaling;
import com.wikiaov.item.internal.domain.ItemContent.ScalingSource;
import com.wikiaov.item.internal.domain.ItemContent.Target;
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
        return new ItemContent(null, null, null, null, null, null, null, List.of(), List.of(), copies, null);
    }

    @Test
    void rejectsDuplicateTranslationsBeforeLookingUpTheIcon() {
        var media = mock(MediaAssets.class);
        var rules = new ItemContentRules(mock(ItemIdentityRepository.class), media, mock(ItemCategoryRepository.class));
        var copy = new Translation("vi-VN", "Name", null, null, null, null);
        var content = new ItemContent(UUID.randomUUID(), null, null, null, null, null, null, List.of(), List.of(),
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
        var content = new ItemContent(UUID.randomUUID(), null, null, "missing", null, null, null, List.of(), List.of(),
                List.of(invalidCopy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Unknown item category.");
        verify(categories).existsById("missing");
        verifyNoInteractions(media);
    }

    @ParameterizedTest
    @ValueSource(strings = {"magic-attack", "movement-speed", "health-regen-per-five-seconds"})
    void acceptsSharedStatCodes(String key) {
        assertThatCode(() -> rules.validate(withStats(new Stat(key, BigDecimal.ONE, null))))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"defense", "physicalAttack", "Movement-speed", "hp5"})
    void rejectsStatCodesOutsideTheSharedSet(String key) {
        assertThatThrownBy(() -> rules.validate(withStats(new Stat(key, BigDecimal.ONE, null))))
                .isInstanceOf(ApiException.class).hasMessage("Invalid or duplicate numeric stat.");
    }

    @ParameterizedTest
    @ValueSource(strings = {"PERCENT", "POINT", "pct"})
    void rejectsStatUnitsOtherThanPercent(String unit) {
        assertThatThrownBy(() -> rules.validate(withStats(new Stat("attack-speed", BigDecimal.TEN, unit))))
                .isInstanceOf(ApiException.class).hasMessage("Invalid or duplicate numeric stat.");
    }

    @Test
    void acceptsAPierceThatGrowsByLevelFollowsBonusHealthAndHasACap() {
        var pierce = new Grant("magic-penetration", BigDecimal.valueOf(32), BigDecimal.valueOf(60), null, Growth.LEVEL,
                List.of(new Scaling(ScalingSource.BONUS_HEALTH, BigDecimal.valueOf(3), "%")), BigDecimal.valueOf(150),
                null, null);

        assertThatCode(() -> rules.validate(withEffects(passive("pha-phep", null, pierce))))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsAGrantGivenOnlyByAScaling() {
        var armor = new Grant("armor", null, null, null, null,
                List.of(new Scaling(ScalingSource.MAGIC_ATTACK, BigDecimal.valueOf(50), "%")), BigDecimal.valueOf(230),
                null, Target.SELF);

        assertThatCode(() -> rules.validate(withEffects(passive("giap-bang", null, armor))))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsAGrantWithNeitherAnAmountNorAScaling() {
        var empty = new Grant("armor", null, null, null, null, List.of(), null, null, null);

        assertThatThrownBy(() -> rules.validate(withEffects(passive("giap-bang", null, empty))))
                .isInstanceOf(ApiException.class).hasMessage("Invalid stat grant amount.");
    }

    @Test
    void rejectsARangeThatShrinks() {
        var range = new Grant("armor", BigDecimal.valueOf(60), BigDecimal.valueOf(32), null, Growth.LEVEL, List.of(),
                null, null, null);

        assertThatThrownBy(() -> rules.validate(withEffects(passive("nguyen-luc", null, range))))
                .isInstanceOf(ApiException.class).hasMessage("Invalid stat grant amount.");
    }

    @Test
    void rejectsAStackingGrantOnAnEffectWithoutStacks() {
        var perStack = new Grant("attack-speed", new BigDecimal("0.8"), null, "%", Growth.STACK, List.of(), null, null,
                null);

        assertThatThrownBy(() -> rules.validate(withEffects(passive("lung-diet", null, perStack))))
                .isInstanceOf(ApiException.class).hasMessage("Invalid stat grant growth.");
        assertThatCode(() -> rules.validate(withEffects(passive("lung-diet", 25, perStack))))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsAGrantOfAnUnknownStat() {
        var unknown = new Grant("defense", BigDecimal.ONE, null, null, null, List.of(), null, null, null);

        assertThatThrownBy(() -> rules.validate(withEffects(passive("noi-luc", null, unknown))))
                .isInstanceOf(ApiException.class).hasMessage("Invalid stat grant.");
    }

    @Test
    void rejectsTwoEffectsWithTheSameKey() {
        assertThatThrownBy(() -> rules.validate(withEffects(passive("cuong-bao", null), passive("cuong-bao", null))))
                .isInstanceOf(ApiException.class).hasMessage("Invalid or duplicate effect key.");
    }

    @Test
    void rejectsACooldownOfZero() {
        var active = new Effect("hap-huyet", Activation.ACTIVE, true, BigDecimal.ZERO, null, List.of());

        assertThatThrownBy(() -> rules.validate(withEffects(active))).isInstanceOf(ApiException.class)
                .hasMessage("Invalid effect cooldown or stacks.");
    }

    @Test
    void readsAnEffectWithoutActivationOrTargetAsAPassiveForTheHolder() {
        var effect = new Effect("cuong-bao", null, true, null, null,
                List.of(new Grant("movement-speed", BigDecimal.TEN, null, "%", null, null, null, null, null)));

        assertThat(effect.activation()).isEqualTo(Activation.PASSIVE);
        assertThat(effect.grants().getFirst().target()).isEqualTo(Target.SELF);
        assertThat(effect.grants().getFirst().scalings()).isEmpty();
    }

    @Test
    void countsAChangedGrantAsAGameplayChangeButNotATrailingZero() {
        var before = withEffects(passive("cuong-bao", null,
                new Grant("movement-speed", new BigDecimal("10.0"), null, "%", null, null, null, null, null)));
        var same = withEffects(passive("cuong-bao", null,
                new Grant("movement-speed", BigDecimal.TEN, null, "%", null, null, null, null, null)));
        var changed = withEffects(passive("cuong-bao", null,
                new Grant("movement-speed", BigDecimal.valueOf(12), null, "%", null, null, null, null, null)));

        assertThat(before.mechanics()).isEqualTo(same.mechanics());
        assertThat(before.mechanics()).isNotEqualTo(changed.mechanics());
    }

    private static ItemContent withStats(Stat... stats) {
        return new ItemContent(null, null, null, null, null, null, null, List.of(stats), List.of(), List.of(), null);
    }

    private static ItemContent withEffects(Effect... effects) {
        return new ItemContent(null, null, null, null, null, null, null, List.of(), List.of(effects), List.of(), null);
    }

    private static Effect passive(String key, Integer maxStacks, Grant... grants) {
        return new Effect(key, Activation.PASSIVE, true, null, maxStacks, List.of(grants));
    }
}
