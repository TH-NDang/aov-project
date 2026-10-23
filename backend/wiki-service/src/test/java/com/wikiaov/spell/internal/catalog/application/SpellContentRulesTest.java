package com.wikiaov.spell.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.media.MediaAssets;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import com.wikiaov.spell.internal.application.SpellErrorCode;
import com.wikiaov.spell.internal.domain.SpellContent;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SpellContentRulesTest {
    private final SpellContentRules rules = new SpellContentRules(mock(MediaAssets.class));

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
                        .isEqualTo(SpellErrorCode.SPELL_INVALID_CONTENT))
                .hasMessage("Invalid or duplicate translation locale.");
    }

    private SpellContent localized(String locale) {
        var copies = List.of(new Translation(locale, "Name", null, null, null, null));
        return new SpellContent(null, null, null, null, null, null, null, null, null, null, List.of(), null, copies,
                null);
    }

    @Test
    void rejectsDuplicateTranslationsBeforeLookingUpTheIcon() {
        var media = mock(MediaAssets.class);
        var rules = new SpellContentRules(media);
        var copy = new Translation("vi-VN", "Name", null, null, null, null);
        var content = new SpellContent(UUID.randomUUID(), null, null, null, null, null, null, null, null, null,
                List.of(), null, List.of(copy, copy), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("Invalid or duplicate translation locale.");
        verifyNoInteractions(media);
    }

    @Test
    void retainsStateIconPrecedenceOverMalformedStateTranslation() {
        var media = mock(MediaAssets.class);
        var rules = new SpellContentRules(media);
        var iconId = UUID.randomUUID();
        var invalidCopy = new Translation("INVALID", "", null, null, null, null);
        var state = new SpellContent.SpellState("empowered", iconId, List.of(invalidCopy));
        var content = new SpellContent(null, null, null, null, null, null, null, null, null, null,
                List.of(state), null, List.of(), null);

        assertThatThrownBy(() -> rules.validate(content)).isInstanceOf(ApiException.class)
                .hasMessage("The icon must be an active uploaded spell icon.");
        verify(media).find(iconId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"default", "empowered-state", "phase2"})
    void acceptsSpellStateSlugs(String key) {
        assertThatCode(() -> rules.validate(withState(key))).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Default", "state_key", "-state", "state-", "state--key"})
    void rejectsMalformedSpellStateSlugs(String key) {
        assertThatThrownBy(() -> rules.validate(withState(key))).isInstanceOf(ApiException.class)
                .hasMessage("Invalid spell state key.");
    }

    @org.junit.jupiter.api.Test
    void archivedLegacyBaselineDoesNotRequireObservationPatchButGamePatchDoes() {
        var revision = new com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision();
        revision.setCause("DATA_BASELINE");
        var removed = new SpellContent(null, BigDecimal.ONE, null, "ACCOUNT_CREATION", "REMOVED", true, 0,
                null, null, null, List.of(), List.of(), List.of(), null);
        assertThat(rules.archived(revision, removed)).isTrue();
        assertThat(rules.readiness(revision, removed)).doesNotContain("effectiveFromPatchVariantId");
        revision.setCause("GAME_PATCH");
        assertThat(rules.archived(revision, removed)).isFalse();
        assertThat(rules.readiness(revision, removed)).contains("effectiveFromPatchVariantId");
    }

    private SpellContent withState(String key) {
        return new SpellContent(null, null, null, null, null, null, null, null, null, key,
                List.of(new SpellContent.SpellState(key, null, List.of())), null, List.of(), null);
    }

}
