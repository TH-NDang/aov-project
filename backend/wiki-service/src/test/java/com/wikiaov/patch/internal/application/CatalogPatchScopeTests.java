package com.wikiaov.patch.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.wikiaov.patch.CatalogPatchScope;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogPatchScopeTests {
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final UUID ruleset = UUID.randomUUID();
    private final UUID season = UUID.randomUUID();

    @Test
    void selectsOnlyTheRequestedRulesetAndPatchWithoutLoadingUnchangedHistory() {
        var selected = variant(ruleset, season, 2, false);
        var other = variant(UUID.randomUUID(), season, 3, true);
        when(contexts.catalogVariants(season)).thenReturn(List.of(selected, other));
        when(contexts.variant(selected.id())).thenReturn(selected);

        var scope = CatalogPatchScope.resolve(contexts, ruleset, season, selected.id(), false);

        assertThat(scope.selectedPatchIds()).containsExactly(selected.id());
        assertThat(scope.applicablePatchIds()).isEmpty();
        verify(contexts, never()).catalogVariants(null);
    }

    @Test
    void rejectsPatchFromAnotherRulesetWithoutChangingTheApiError() {
        var selected = variant(UUID.randomUUID(), season, 2, true);
        when(contexts.catalogVariants(season)).thenReturn(List.of());
        when(contexts.variant(selected.id())).thenReturn(selected);

        assertThatThrownBy(() -> CatalogPatchScope.resolve(contexts, ruleset, season, selected.id(), false))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER))
                .hasMessage("The patch must belong to the selected season and ruleset.");
    }

    @Test
    void rejectsPatchFromAnotherSeasonEvenWithoutARulesetFilter() {
        var selected = variant(ruleset, UUID.randomUUID(), 2, true);
        when(contexts.catalogVariants(season)).thenReturn(List.of());
        when(contexts.variant(selected.id())).thenReturn(selected);

        assertThatThrownBy(() -> CatalogPatchScope.resolve(contexts, null, season, selected.id(), true))
                .isInstanceOf(ApiException.class)
                .hasMessage("The patch must belong to the selected season and ruleset.");
        verify(contexts, never()).catalogVariants(null);
    }

    @Test
    void carriesForwardPublishedHistoryUsingIndependentRulesetCutoffs() {
        var otherRuleset = UUID.randomUUID();
        var selected = variant(ruleset, season, 3, true);
        var otherSelected = variant(otherRuleset, season, 1, true);
        var older = variant(ruleset, UUID.randomUUID(), 1, true);
        var future = variant(ruleset, season, 4, true);
        var draft = variant(ruleset, season, 2, false);
        var otherFuture = variant(otherRuleset, season, 2, true);
        var unrelated = variant(UUID.randomUUID(), season, 1, true);
        when(contexts.catalogVariants(season)).thenReturn(List.of(selected, otherSelected));
        when(contexts.catalogVariants(null))
                .thenReturn(List.of(older, selected, future, draft, otherSelected, otherFuture, unrelated));

        var scope = CatalogPatchScope.resolve(contexts, null, season, null, true);

        assertThat(scope.selectedPatchIds()).containsExactlyInAnyOrder(selected.id(), otherSelected.id());
        assertThat(scope.applicablePatchIds())
                .containsExactlyInAnyOrder(older.id(), selected.id(), otherSelected.id());
    }

    @Test
    void usesTheMaximumSelectedOrdinalAndAllowsAnUnpublishedSelection() {
        var earlier = variant(ruleset, season, 1, true);
        var selected = variant(ruleset, season, 3, false);
        var published = variant(ruleset, UUID.randomUUID(), 2, true);
        when(contexts.catalogVariants(season)).thenReturn(List.of(selected, earlier));
        when(contexts.catalogVariants(null)).thenReturn(List.of(earlier, published, selected));

        var scope = CatalogPatchScope.resolve(contexts, ruleset, season, null, true);

        assertThat(scope.selectedPatchIds()).containsExactlyInAnyOrder(selected.id(), earlier.id());
        assertThat(scope.applicablePatchIds()).containsExactlyInAnyOrder(earlier.id(), published.id());
    }

    @Test
    void emptySelectionDoesNotLeakUnrelatedPublishedHistory() {
        when(contexts.catalogVariants(season)).thenReturn(List.of());
        when(contexts.catalogVariants(null)).thenReturn(List.of(variant(ruleset, season, 1, true)));

        var scope = CatalogPatchScope.resolve(contexts, ruleset, season, null, true);

        assertThat(scope.selectedPatchIds()).isEmpty();
        assertThat(scope.applicablePatchIds()).isEmpty();
    }

    private static PatchVariantReference variant(UUID ruleset, UUID season, long ordinal, boolean published) {
        return new PatchVariantReference(UUID.randomUUID(), UUID.randomUUID(), ruleset, season, ordinal, published);
    }
}
