package com.wikiaov.patch.internal.context.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.RegionErrorCode;
import com.wikiaov.patch.internal.context.persistence.SeasonUpdatesRepository;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

class SeasonUpdatesTest {
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final SeasonUpdatesRepository repository = mock(SeasonUpdatesRepository.class);
    private final Instant now = Instant.parse("2026-10-24T09:00:00Z");
    private final SeasonUpdates service = new SeasonUpdates(contexts, repository, Clock.fixed(now, ZoneOffset.UTC));
    private final UUID regionId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final UUID variantId = UUID.randomUUID();
    private final UUID patchId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();

    @Test
    void keepsTheVerifiedMarketScopeAndTranslationPreferenceWithoutInventingDatePrecision() {
        stubContext();
        var season = mock(SeasonUpdatesRepository.Season.class);
        when(season.getId()).thenReturn(seasonId);
        when(season.getCode()).thenReturn("s4-2026");
        when(season.getDisplayName()).thenReturn("S4 2026");
        when(repository.currentSeason(regionId, variantId, now, PageRequest.of(0, 1))).thenReturn(List.of(season));
        var release = mock(SeasonUpdatesRepository.Release.class);
        when(release.getId()).thenReturn(patchId);
        when(release.getCode()).thenReturn("2026-10-15");
        when(release.getEffectiveAt()).thenReturn(now.minusSeconds(60));
        when(release.getEffectiveOn()).thenReturn(LocalDate.of(2026, 10, 15));
        when(release.getSourceUrl()).thenReturn("https://example.org/patch");
        when(repository.publishedReleases(regionId, rulesetId, seasonId, now, PageRequest.of(0, 4)))
                .thenReturn(List.of(release));
        var preferred = text("en-US", "Mid-season update");
        var fallback = text("vi-VN", "Local fallback");
        when(repository.preferredTexts(List.of(patchId), "en-US"))
                .thenReturn(List.of(preferred, fallback));

        var result = service.read("VN", "en-US", 4);

        assertThat(result.asOf()).isEqualTo(now);
        assertThat(result.season().id()).isEqualTo(seasonId);
        assertThat(result.season().displayName()).isEqualTo("S4 2026");
        assertThat(result.currentPatchId()).isEqualTo(patchId);
        assertThat(result.patches()).singleElement().satisfies(patch -> {
            assertThat(patch.title()).isEqualTo("Mid-season update");
            assertThat(patch.actualLocale()).isEqualTo("en-US");
            assertThat(patch.effectiveAt()).isNull();
            assertThat(patch.effectiveOn()).isEqualTo(LocalDate.of(2026, 10, 15));
            assertThat(patch.sourceUrl()).isEqualTo("https://example.org/patch");
            assertThat(patch.isCurrent()).isTrue();
        });
        verify(repository).publishedReleases(regionId, rulesetId, seasonId, now, PageRequest.of(0, 4));
    }

    @Test
    void returnsAnHonestEmptySeasonForUnavailableContextOrMissingSeason() {
        when(contexts.resolve("VN", now)).thenThrow(new ApiException(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE,
                "No verified context."));

        var unavailable = service.read("VN", "vi-VN", 4);

        assertThat(unavailable.season()).isNull();
        assertThat(unavailable.currentPatchId()).isNull();
        assertThat(unavailable.patches()).isEmpty();
        verifyNoInteractions(repository);

        stubContext();
        when(repository.currentSeason(eq(regionId), eq(variantId), eq(now), any())).thenReturn(List.of());

        var unknownSeason = service.read("VN", "vi-VN", 4);

        assertThat(unknownSeason.season()).isNull();
        assertThat(unknownSeason.currentPatchId()).isEqualTo(patchId);
        assertThat(unknownSeason.patches()).isEmpty();
    }

    @Test
    void rejectsInvalidBoundsAndLocaleBeforeReadingAndPreservesUnavailableRegionErrors() {
        for (int limit : new int[] {0, 11}) {
            assertThatThrownBy(() -> service.read("VN", "vi-VN", limit)).isInstanceOfSatisfying(ApiException.class,
                    error -> assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER));
        }
        assertThatThrownBy(() -> service.read("VN", "vi_vn", 4)).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_INVALID));
        verifyNoInteractions(contexts, repository);

        when(contexts.resolve(anyString(), any())).thenThrow(
                new ApiException(RegionErrorCode.UNSUPPORTED_REGION, "The requested region is unavailable."));

        assertThatThrownBy(() -> service.read("UNKNOWN", "vi-VN", 4)).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(RegionErrorCode.UNSUPPORTED_REGION));
    }

    private void stubContext() {
        doReturn(new GameplayContext(regionId, "VN", rulesetId, "aov-standard", patchId, "2026-10-15", variantId,
                2, now.minusSeconds(60))).when(contexts).resolve("VN", now);
    }

    private SeasonUpdatesRepository.Text text(String locale, String title) {
        var text = mock(SeasonUpdatesRepository.Text.class);
        when(text.getPatchId()).thenReturn(patchId);
        when(text.getLocale()).thenReturn(locale);
        when(text.getTitle()).thenReturn(title);
        return text;
    }
}
