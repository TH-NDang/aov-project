package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.internal.application.response.CatalogContextView;
import com.wikiaov.patch.internal.application.response.CatalogContextView.*;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository.CatalogDate;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository.CatalogPatch;
import com.wikiaov.patch.internal.context.persistence.SeasonUpdatesRepository;
import com.wikiaov.patch.internal.ruleset.application.Regions;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CatalogContexts {
    private final GameplayContexts contexts;
    private final GameplayContextRepository repository;
    private final SeasonUpdatesRepository translations;
    private final Regions regions;
    private final Clock clock;

    public CatalogContexts(GameplayContexts contexts, GameplayContextRepository repository,
            SeasonUpdatesRepository translations, Regions regions, Clock clock) {
        this.contexts = contexts;
        this.repository = repository;
        this.translations = translations;
        this.regions = regions;
        this.clock = clock;
    }

    public CatalogContextView read(String region, String locale) {
        if (!Set.of("vi-VN", "en-US").contains(locale))
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "Choose a supported catalog locale: vi-VN or en-US.");

        var now = clock.instant();
        var context = contexts.resolve(region, now);
        var patches = repository.catalogPatches(context.rulesetId(), now, context.rulesetOrdinal(), null, null,
                Pageable.unpaged());
        var currentSeason = patches.stream().filter(patch -> patch.getId().equals(context.patchVariantId()))
                .map(CatalogPatch::getSeasonId).filter(Objects::nonNull).findFirst().orElse(null);
        var markets = regions.list();
        var zone = markets.stream().filter(market -> market.code().equals(region)).findFirst()
                .map(market -> ZoneId.of(market.timeZone())).orElse(ZoneId.of("UTC"));
        Map<UUID, LocalDate> dates = new LinkedHashMap<>();
        Map<UUID, String> titles = new LinkedHashMap<>();
        if (!patches.isEmpty()) {
            var ids = patches.stream().map(CatalogPatch::getId).toList();
            for (var date : repository.catalogDates(context.regionId(), ids, now))
                dates.putIfAbsent(date.getPatchVariantId(), regionalDate(date, zone));
            var patchIds = patches.stream().map(CatalogPatch::getPatchId).distinct().toList();
            for (var text : translations.preferredTexts(patchIds, locale))
                titles.putIfAbsent(text.getPatchId(), text.getTitle());
        }

        var bySeason = patches.stream().filter(patch -> patch.getSeasonId() != null)
                .collect(Collectors.groupingBy(CatalogPatch::getSeasonId));
        var seasons = bySeason.values().stream().map(values -> season(values, currentSeason, dates, titles))
                .sorted(Comparator.comparingLong(Season::ordinal).reversed().thenComparing(Season::code)).toList();
        return new CatalogContextView(markets, languages(locale), seasons,
                new Current(context.rulesetId(), currentSeason, context.patchVariantId()));
    }

    private static Season season(List<CatalogPatch> values, UUID currentSeason, Map<UUID, LocalDate> dates,
            Map<UUID, String> titles) {
        var first = values.getFirst();
        var patches = values.stream().sorted(Comparator.comparingLong(CatalogPatch::getOrdinal).reversed())
                .map(value -> new Patch(value.getId(), value.getCode(),
                        titles.getOrDefault(value.getPatchId(), value.getCode()), value.getRulesetId(),
                        value.getOrdinal(),
                        true, dates.get(value.getId()), !dates.containsKey(value.getId())))
                .toList();
        return new Season(first.getSeasonId(), first.getSeasonCode(), first.getSeasonName(), first.getSeasonOrdinal(),
                first.getSeasonId().equals(currentSeason), patches);
    }

    private static LocalDate regionalDate(CatalogDate date, ZoneId zone) {
        return date.getEffectiveOn() == null
                ? date.getEffectiveAt().atZone(zone).toLocalDate()
                : date.getEffectiveOn();
    }

    private static List<Language> languages(String locale) {
        boolean vietnamese = locale.equals("vi-VN");
        return List.of(new Language("vi-VN", vietnamese ? "Tiếng Việt" : "Vietnamese", "Tiếng Việt"),
                new Language("en-US", vietnamese ? "Tiếng Anh" : "English", "English"));
    }
}
