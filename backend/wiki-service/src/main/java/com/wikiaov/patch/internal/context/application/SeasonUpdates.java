package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.response.SeasonUpdatesView;
import com.wikiaov.patch.internal.context.persistence.SeasonUpdatesRepository;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.time.Instant;
import java.util.IllformedLocaleException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SeasonUpdates {
    private final GameplayContexts contexts;
    private final SeasonUpdatesRepository repository;
    private final Clock clock;

    public SeasonUpdates(GameplayContexts contexts, SeasonUpdatesRepository repository, Clock clock) {
        this.contexts = contexts;
        this.repository = repository;
        this.clock = clock;
    }

    public SeasonUpdatesView read(String region, String locale, int limit) {
        validate(locale, limit);
        var now = clock.instant();
        var context = currentContext(region, now);
        if (context == null)
            return new SeasonUpdatesView(region, locale, now, null, null, List.of());

        var season = repository.currentSeason(context.regionId(), context.patchVariantId(), now, PageRequest.of(0, 1))
                .stream().findFirst().orElse(null);
        if (season == null)
            return new SeasonUpdatesView(region, locale, now, null, context.patchId(), List.of());

        var releases = repository.publishedReleases(context.regionId(), context.rulesetId(), season.getId(), now,
                PageRequest.of(0, limit));
        var texts = preferredTexts(releases, locale);
        var patches = releases.stream().map(release -> patch(release, texts.get(release.getId()), context.patchId()))
                .toList();
        var seasonView = new SeasonUpdatesView.Season(season.getId(), season.getCode(), season.getDisplayName());
        return new SeasonUpdatesView(region, locale, now, seasonView, context.patchId(), patches);
    }

    private GameplayContext currentContext(String region, Instant now) {
        try {
            return contexts.resolve(region, now);
        } catch (ApiException exception) {
            if (exception.getErrorCode() == PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE)
                return null;
            throw exception;
        }
    }

    private Map<UUID, SeasonUpdatesRepository.Text> preferredTexts(List<SeasonUpdatesRepository.Release> releases,
            String locale) {
        Map<UUID, SeasonUpdatesRepository.Text> result = new LinkedHashMap<>();
        if (!releases.isEmpty()) {
            var patchIds = releases.stream().map(SeasonUpdatesRepository.Release::getId).distinct().toList();
            for (var text : repository.preferredTexts(patchIds, locale))
                result.putIfAbsent(text.getPatchId(), text);
        }
        return result;
    }

    private static SeasonUpdatesView.Patch patch(SeasonUpdatesRepository.Release release,
            SeasonUpdatesRepository.Text text, UUID currentPatchId) {
        return new SeasonUpdatesView.Patch(release.getId(), release.getCode(), text == null ? null : text.getTitle(),
                text == null ? null : text.getSummary(), text == null ? null : text.getLocale(),
                release.getEffectiveOn() == null ? release.getEffectiveAt() : null, release.getEffectiveOn(),
                release.getSourceUrl(), release.getId().equals(currentPatchId));
    }

    private static void validate(String locale, int limit) {
        if (limit < 1 || limit > 10)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Limit must be between 1 and 10.");
        try {
            if (!new Locale.Builder().setLanguageTag(locale).build().toLanguageTag().equals(locale))
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException | IllformedLocaleException exception) {
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "Use a canonical BCP 47 locale.");
        }
    }
}
