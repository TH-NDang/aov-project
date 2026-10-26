package com.wikiaov.patch.internal.context.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository.CatalogPatch;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.patch.internal.season.persistence.RankedSeasonRepository;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

class ResolveCatalogContextTest {
    private final GameplayContextRepository repository = mock(GameplayContextRepository.class);
    private final RegionRepository regions = mock(RegionRepository.class);
    private final PatchVariantRepository variants = mock(PatchVariantRepository.class);
    private final RankedSeasonRepository seasons = mock(RankedSeasonRepository.class);
    private final GameplayRulesetRepository rulesets = mock(GameplayRulesetRepository.class);
    private final ResolveGameplayContext resolver = new ResolveGameplayContext(repository, regions, variants, seasons,
            rulesets);
    private final Instant now = Instant.parse("2026-10-26T00:00:00Z");
    private final GameplayContext current = new GameplayContext(UUID.randomUUID(), "VN", UUID.randomUUID(),
            "aov-standard", UUID.randomUUID(), "2026-10-15", UUID.randomUUID(), 3, now.minusSeconds(60));

    @BeforeEach
    void verifiedMarket() {
        when(regions.findByCodeAndLifecycleState("VN", "ACTIVE")).thenReturn(Optional.of(mock(Region.class)));
        when(repository.effective("VN", now, PageRequest.of(0, 1))).thenReturn(List.of(current));
    }

    @Test
    void absentScopeKeepsTheExistingVerifiedContextWithoutReadingHistoricalChoices() {
        assertThat(resolver.resolveCatalog("VN", now, null, null)).isSameAs(current);

        verify(repository, never()).catalogPatches(any(), any(), anyLong(), any(), any(), any());
        verify(repository, never()).catalogDates(any(), any(), any());
    }

    @Test
    void selectsAnUndatedHistoricalPatchWithinTheCurrentRulesetWithoutInventingAnEffectiveTime() {
        UUID season = UUID.randomUUID();
        UUID variant = UUID.randomUUID();
        var selected = choice(variant, 1, "s3-observed");
        when(repository.catalogPatches(current.rulesetId(), now, 3, season, variant, PageRequest.of(0, 1)))
                .thenReturn(List.of(selected));

        var result = resolver.resolveCatalog("VN", now, season, variant);

        assertThat(result.rulesetId()).isEqualTo(current.rulesetId());
        assertThat(result.regionId()).isEqualTo(current.regionId());
        assertThat(result.patchVariantId()).isEqualTo(variant);
        assertThat(result.patchCode()).isEqualTo("s3-observed");
        assertThat(result.rulesetOrdinal()).isEqualTo(1);
        assertThat(result.effectiveAt()).isNull();
        verify(repository).catalogDates(current.regionId(), List.of(variant), now);
    }

    @Test
    void seasonSelectionUsesTheHighestEligibleProjectionAndKeepsCurrentReleasePrecision() {
        UUID season = UUID.randomUUID();
        var selected = choice(current.patchVariantId(), 3, current.patchCode());
        when(repository.catalogPatches(current.rulesetId(), now, 3, season, null, PageRequest.of(0, 1)))
                .thenReturn(List.of(selected));

        assertThat(resolver.resolveCatalog("VN", now, season, null)).isSameAs(current);
        verify(repository, never()).catalogDates(any(), any(), any());
    }

    @Test
    void anUnavailableOrMismatchedScopeFailsInsteadOfFallingBackToCurrentData() {
        UUID season = UUID.randomUUID();
        UUID variant = UUID.randomUUID();

        assertThatThrownBy(() -> resolver.resolveCatalog("VN", now, season, variant))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_NOT_FOUND));
        verify(repository).catalogPatches(current.rulesetId(), now, 3, season, variant, PageRequest.of(0, 1));
        verifyNoInteractions(variants, seasons, rulesets);
    }

    private CatalogPatch choice(UUID id, long ordinal, String code) {
        var row = mock(CatalogPatch.class);
        when(row.getId()).thenReturn(id);
        when(row.getPatchId()).thenReturn(UUID.randomUUID());
        when(row.getCode()).thenReturn(code);
        when(row.getOrdinal()).thenReturn(ordinal);
        return row;
    }
}
