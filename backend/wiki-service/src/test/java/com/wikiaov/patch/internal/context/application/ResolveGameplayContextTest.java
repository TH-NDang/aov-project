package com.wikiaov.patch.internal.context.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.RegionErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.domain.PatchLifecycleState;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.patch.internal.season.persistence.RankedSeasonRepository;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

class ResolveGameplayContextTest {
    private final GameplayContextRepository repository = mock(GameplayContextRepository.class);
    private final RegionRepository regions = mock(RegionRepository.class);
    private final ResolveGameplayContext resolver = new ResolveGameplayContext(repository, regions,
            mock(PatchVariantRepository.class), mock(RankedSeasonRepository.class),
            mock(GameplayRulesetRepository.class));
    private final Instant now = Instant.parse("2026-11-18T00:00:00Z");

    @Test
    void findsNothingForAnOpenRegionWithoutAVerifiedContextWhileResolveRejectsIt() {
        openRegions("VN");

        assertThat(resolver.find("VN", now)).isEmpty();
        assertThatThrownBy(() -> resolver.resolve("VN", now)).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE));
    }

    @Test
    void findStillRejectsARegionThatIsNotOpen() {
        when(regions.findByCodeAndLifecycleState("TH", PatchLifecycleState.ACTIVE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolver.find("TH", now)).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(RegionErrorCode.UNSUPPORTED_REGION));
    }

    @Test
    void activeListsOnlyTheOpenRegionsThatHaveAVerifiedContext() {
        var regionsByCode = openRegions("VN", "TW");
        when(regions.findByLifecycleState(PatchLifecycleState.ACTIVE)).thenReturn(regionsByCode);
        var verified = new GameplayContext(UUID.randomUUID(), "TW", UUID.randomUUID(), "aov-standard",
                UUID.randomUUID(), "2026-11-01", UUID.randomUUID(), 1, now.minusSeconds(60));
        when(repository.effective("TW", now, PageRequest.of(0, 1))).thenReturn(List.of(verified));

        assertThat(resolver.active(now)).containsExactly(verified);
    }

    private List<Region> openRegions(String... codes) {
        return List.of(codes).stream().map(code -> {
            var region = mock(Region.class);
            when(region.getCode()).thenReturn(code);
            when(regions.findByCodeAndLifecycleState(code, PatchLifecycleState.ACTIVE)).thenReturn(Optional.of(region));
            return region;
        }).toList();
    }
}
