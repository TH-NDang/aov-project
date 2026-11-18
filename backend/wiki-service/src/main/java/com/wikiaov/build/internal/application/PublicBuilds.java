package com.wikiaov.build.internal.application;

import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.internal.application.response.BuildViews;
import com.wikiaov.build.internal.persistence.BuildRepository;
import com.wikiaov.build.internal.persistence.CaptureHeroRepository;
import com.wikiaov.build.internal.persistence.CaptureRepository;
import com.wikiaov.build.internal.persistence.entity.BuildRow;
import com.wikiaov.build.internal.persistence.entity.CaptureHeroRow;
import com.wikiaov.build.internal.persistence.entity.CaptureRow;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds shown on a hero page of the public Wiki: for each game tab, the newest confirmed capture of the market that
 * lists the hero. Builds with equal content are merged.
 */
@Service
public class PublicBuilds {
    private static final List<String> SOURCE_ORDER = List.of("PRO", "HOT", "SYSTEM");
    private static final Pattern REGION = Pattern.compile("[A-Z]{2,16}");

    private final CaptureRepository captures;
    private final CaptureHeroRepository heroes;
    private final BuildRepository builds;
    private final BuildReadModel readModel;
    private final BuildReferences references;
    private final GameplayContexts contexts;

    public PublicBuilds(CaptureRepository captures, CaptureHeroRepository heroes, BuildRepository builds,
            BuildReadModel readModel, BuildReferences references, GameplayContexts contexts) {
        this.captures = captures;
        this.heroes = heroes;
        this.builds = builds;
        this.readModel = readModel;
        this.references = references;
        this.contexts = contexts;
    }

    @Transactional(readOnly = true)
    public BuildViews.HeroBuilds heroBuilds(String heroCode, String region) {
        if (heroCode == null || heroCode.isBlank()) {
            throw new ApiException(BuildErrorCode.BUILD_INVALID, "A hero code is required.");
        }
        if (region == null || !REGION.matcher(region).matches()) {
            throw new ApiException(BuildErrorCode.BUILD_INVALID, "Unknown market.");
        }
        var hero = references.byCodes(BuildReferenceKind.HERO, List.of(heroCode)).get(heroCode);
        if (hero == null) {
            throw new ApiException(BuildErrorCode.BUILD_HERO_NOT_FOUND, "Hero " + heroCode + " was not found.");
        }

        Map<String, CaptureRow> newest = new HashMap<>();
        for (var capture : captures.confirmedWithHero(region, hero.id())) {
            newest.putIfAbsent(capture.getSourceKind(), capture);
        }
        var chosen = newest.values().stream()
                .sorted(Comparator.comparingInt(capture -> SOURCE_ORDER.indexOf(capture.getSourceKind()))).toList();
        Map<UUID, List<BuildRow>> rows = new HashMap<>();
        for (var capture : chosen) {
            rows.put(capture.getId(), builds
                    .findByCaptureIdAndHeroIdAndNeedsReviewFalseOrderByListPositionAsc(capture.getId(), hero.id()));
        }

        var loaded = readModel.load(rows.values().stream().flatMap(List::stream).toList());
        var pageUse = usage(rows.values().stream().flatMap(List::stream).map(BuildRow::getArcanaPageId)
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        var sources = chosen.stream().map(capture -> {
            var heroRow = heroes.findById(new CaptureHeroRow.Key(capture.getId(), hero.id()))
                    .orElseThrow(() -> new IllegalStateException("A chosen capture has no row for its hero."));
            return new BuildViews.Source(capture.getId(), capture.getSourceKind(), capture.getSourceLabel(),
                    capture.getCapturedAt(), capture.getSourceTimeZone(),
                    capture.getPatchVariantId() == null ? null : contexts.patchCode(capture.getPatchVariantId()),
                    heroRow.getResult(), merge(rows.get(capture.getId()), loaded, pageUse));
        }).toList();
        return new BuildViews.HeroBuilds(hero.id(), hero.code(), region, sources);
    }

    private Map<UUID, BuildViews.Usage> usage(Set<UUID> pageIds) {
        return pageIds.isEmpty()
                ? Map.of()
                : builds.arcanaPageUse(pageIds).stream().collect(Collectors.toMap(BuildRepository.ValueUse::getValueId,
                        use -> new BuildViews.Usage((int) use.getBuilds(), (int) use.getHeroes())));
    }

    /** One entry per distinct content, in the order the game lists them, with every place it holds. */
    private static List<BuildViews.PublicBuild> merge(List<BuildRow> rows, BuildReadModel.Loaded loaded,
            Map<UUID, BuildViews.Usage> pageUse) {
        Map<String, List<BuildRow>> groups = new LinkedHashMap<>();
        for (var row : rows) {
            groups.computeIfAbsent(row.getContentKey(), key -> new ArrayList<>()).add(row);
        }
        return groups.values().stream().map(group -> {
            var first = group.getFirst();
            return new BuildViews.PublicBuild(first.getContentKey(),
                    group.stream().map(BuildRow::getListPosition).toList(),
                    loaded.items(first).stream()
                            .map(item -> new BuildViews.PublicItem(item.slot(), item.itemId(), item.code())).toList(),
                    loaded.enchantments(first), first.getArcanaPageId(), loaded.arcana(first),
                    first.getArcanaPageId() == null ? null : pageUse.get(first.getArcanaPageId()), first.getSpellId(),
                    loaded.spellCode(first));
        }).toList();
    }
}
