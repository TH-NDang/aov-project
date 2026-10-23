package com.wikiaov.patch.internal.authoring.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.application.PatchCommands.Patch;
import com.wikiaov.patch.internal.application.PatchCommands.SeasonPatch;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.SeasonVariant;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.GameplayRuleset;
import com.wikiaov.patch.internal.season.application.RankedSeasons;
import com.wikiaov.patch.internal.season.persistence.entity.RankedSeason;
import com.wikiaov.platform.ApiException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SeasonPatchPlacementTests {
    private final GameplayRulesetRepository rulesets = mock(GameplayRulesetRepository.class);
    private final PatchVariantRepository variants = mock(PatchVariantRepository.class);
    private final RankedSeasons seasons = mock(RankedSeasons.class);
    private final SeasonPatchPlacement placement = new SeasonPatchPlacement(rulesets, variants, seasons);
    private final UUID rulesetId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();

    @BeforeEach
    void prepareSeason() {
        when(rulesets.lockById(rulesetId)).thenReturn(Optional.of(new GameplayRuleset()));
        var season = new RankedSeason();
        season.setOrdinal(2);
        when(seasons.require(seasonId)).thenReturn(season);
    }

    @Test
    void startsAtOneWhenThereAreNoVariantsAndLocksBeforeReadingTheOrder() {
        when(variants.orderedSeasonVariants(rulesetId)).thenReturn(List.of());

        var position = placement.choosePlacement(input(null));

        assertThat(position.appendOrdinal()).isEqualTo(1);
        assertThat(position.beforeVariantId()).isNull();
        var order = inOrder(rulesets, variants, seasons);
        order.verify(rulesets).lockById(rulesetId);
        order.verify(seasons).require(seasonId);
        order.verify(variants).orderedSeasonVariants(rulesetId);
    }

    @Test
    void insertsBeforeTheFirstLaterSeasonIgnoringUnseasonedVariants() {
        var later = new SeasonVariant(UUID.randomUUID(), 4, 3L);
        var last = new SeasonVariant(UUID.randomUUID(), 6, 4L);
        when(variants.orderedSeasonVariants(rulesetId)).thenReturn(List.of(
                new SeasonVariant(UUID.randomUUID(), 1, 1L),
                new SeasonVariant(UUID.randomUUID(), 2, null),
                new SeasonVariant(UUID.randomUUID(), 3, 2L), later, last));

        var position = placement.choosePlacement(input(null));

        assertThat(position.beforeVariantId()).isEqualTo(later.id());
        assertThat(position.appendOrdinal()).isEqualTo(7);
        verify(variants, never()).lockById(any());
    }

    @Test
    void appendsWhenNoLaterSeasonExists() {
        when(variants.orderedSeasonVariants(rulesetId)).thenReturn(List.of(
                new SeasonVariant(UUID.randomUUID(), 8, 2L),
                new SeasonVariant(UUID.randomUUID(), 9, null)));

        var position = placement.choosePlacement(input(null));

        assertThat(position.beforeVariantId()).isNull();
        assertThat(position.appendOrdinal()).isEqualTo(10);
    }

    @Test
    void explicitAnchorInTheSameSeasonTakesPrecedenceOverAutomaticPlacement() {
        UUID explicitAnchor = UUID.randomUUID();
        var later = new SeasonVariant(UUID.randomUUID(), 9, 3L);
        when(variants.orderedSeasonVariants(rulesetId)).thenReturn(List.of(later));
        when(variants.lockById(explicitAnchor)).thenReturn(Optional.of(anchor(rulesetId, seasonId)));

        var position = placement.choosePlacement(input(explicitAnchor));

        assertThat(position.beforeVariantId()).isEqualTo(explicitAnchor);
        assertThat(position.appendOrdinal()).isEqualTo(10);
        verify(variants).lockById(explicitAnchor);
    }

    @Test
    void rejectsAnAnchorInAnotherRulesetBeforeComputingTheAppendOrdinal() {
        UUID explicitAnchor = UUID.randomUUID();
        when(variants.orderedSeasonVariants(rulesetId))
                .thenReturn(List.of(new SeasonVariant(explicitAnchor, Long.MAX_VALUE, 2L)));
        when(variants.lockById(explicitAnchor)).thenReturn(Optional.of(anchor(UUID.randomUUID(), seasonId)));

        assertInvalidAnchor(explicitAnchor);
    }

    @Test
    void rejectsAnAnchorInAnotherSeason() {
        UUID explicitAnchor = UUID.randomUUID();
        when(variants.orderedSeasonVariants(rulesetId)).thenReturn(List.of());
        when(variants.lockById(explicitAnchor)).thenReturn(Optional.of(anchor(rulesetId, UUID.randomUUID())));

        assertInvalidAnchor(explicitAnchor);
    }

    @Test
    void rejectsAnUnseasonedAnchor() {
        UUID explicitAnchor = UUID.randomUUID();
        when(variants.orderedSeasonVariants(rulesetId)).thenReturn(List.of());
        when(variants.lockById(explicitAnchor)).thenReturn(Optional.of(anchor(rulesetId, null)));

        assertInvalidAnchor(explicitAnchor);
    }

    @Test
    void preservesOverflowChecksEvenWhenAnInsertionAnchorWasProvided() {
        UUID explicitAnchor = UUID.randomUUID();
        when(variants.orderedSeasonVariants(rulesetId))
                .thenReturn(List.of(new SeasonVariant(explicitAnchor, Long.MAX_VALUE, 2L)));
        when(variants.lockById(explicitAnchor)).thenReturn(Optional.of(anchor(rulesetId, seasonId)));

        assertThatThrownBy(() -> placement.choosePlacement(input(explicitAnchor)))
                .isInstanceOf(ArithmeticException.class);
    }

    private SeasonPatch input(UUID beforeVariantId) {
        return new SeasonPatch(seasonId, rulesetId, beforeVariantId, new Patch("new-patch", List.of()));
    }

    private PatchVariant anchor(UUID ruleset, UUID season) {
        var variant = new PatchVariant();
        variant.setRulesetId(ruleset);
        variant.setSeasonId(season);
        return variant;
    }

    private void assertInvalidAnchor(UUID anchorId) {
        assertThatThrownBy(() -> placement.choosePlacement(input(anchorId))).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_INVALID))
                .hasMessage("Choose an insertion anchor in the same season and ruleset.");
    }
}
