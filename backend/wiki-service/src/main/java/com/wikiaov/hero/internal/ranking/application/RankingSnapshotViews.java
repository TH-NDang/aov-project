package com.wikiaov.hero.internal.ranking.application;

import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.hero.internal.application.response.HeroRankingViews.Detail;
import com.wikiaov.hero.internal.application.response.HeroRankingViews.Summary;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.ranking.domain.RankingMetric;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotHeroRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotImageRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotValueRepository;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotHeroRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/** What editors see of a ranking snapshot (ADR-025): its summary with counts, and its detail with every value. */
@Component
class RankingSnapshotViews {
    private final RankingSnapshotImageRepository images;
    private final RankingSnapshotHeroRepository entries;
    private final RankingSnapshotValueRepository values;
    private final HeroIdentityRepository heroes;

    RankingSnapshotViews(RankingSnapshotImageRepository images, RankingSnapshotHeroRepository entries,
            RankingSnapshotValueRepository values, HeroIdentityRepository heroes) {
        this.images = images;
        this.entries = entries;
        this.values = values;
        this.heroes = heroes;
    }

    Detail detail(RankingSnapshotRow snapshot) {
        var imageRows = images.findBySnapshotIdOrderByBoardDescPageNoAsc(snapshot.getId());
        var heroRows = entries.findBySnapshotId(snapshot.getId());
        var valueRows = values.findBySnapshotId(snapshot.getId());

        Set<UUID> ids = new HashSet<>();
        heroRows.forEach(row -> ids.add(row.getHeroId()));
        valueRows.stream().map(RankingSnapshotValueRow::getHeroValue).filter(Objects::nonNull).forEach(ids::add);
        var codes = codes(ids);
        Map<UUID, List<RankingSnapshotValueRow>> byHero = valueRows.stream()
                .collect(Collectors.groupingBy(RankingSnapshotValueRow::getHeroId));
        var heroViews = heroRows.stream()
                .sorted(Comparator.comparing(RankingSnapshotHeroRow::getRatesPosition,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(RankingSnapshotHeroRow::getFiguresPosition,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .map(row -> heroEntry(row, byHero.getOrDefault(row.getHeroId(), List.of()), codes))
                .toList();
        int open = (int) valueRows.stream().filter(RankingSnapshotValueRow::isNeedsReview).count();

        return new Detail(snapshot.getId(), snapshot.getCode(), snapshot.getRegionCode(), snapshot.getModeCode(),
                snapshot.getModeLabel(), snapshot.getPeriodLabel(), snapshot.getCapturedAt(),
                snapshot.getSourceTimeZone(), snapshot.getConfirmedAt(), heroRows.size(), valueRows.size(), open,
                snapshot.getVersion(), snapshot.getSourceRun(), snapshot.getSourceNote(), snapshot.getCreatedAt(),
                imageRows.stream().map(row -> new HeroRankingViews.Image(row.getImageId(), row.getBoard(),
                        row.getPageNo(), row.getFileName(), row.getWidth(), row.getHeight())).toList(),
                heroViews);
    }

    private static HeroRankingViews.HeroEntry heroEntry(RankingSnapshotHeroRow row,
            List<RankingSnapshotValueRow> heroValues, Map<UUID, String> codes) {
        return new HeroRankingViews.HeroEntry(row.getHeroId(), codes.get(row.getHeroId()), row.getNameOnScreen(),
                row.getRoleOnScreen(), row.getRatesPosition(), row.getFiguresPosition(),
                heroValues.stream().sorted(Comparator.comparing(value -> RankingMetric.valueOf(value.getMetric())))
                        .map(value -> value(value, codes)).toList());
    }

    Summary summary(RankingSnapshotRow snapshot) {
        return summary(snapshot, counts(List.of(snapshot.getId())).get(snapshot.getId()));
    }

    static Summary summary(RankingSnapshotRow row, int @Nullable [] count) {
        int[] safe = count == null ? new int[3] : count;
        return new Summary(row.getId(), row.getCode(), row.getRegionCode(), row.getModeCode(), row.getModeLabel(),
                row.getPeriodLabel(), row.getCapturedAt(), row.getSourceTimeZone(), row.getConfirmedAt(), safe[0],
                safe[1], safe[2], row.getVersion());
    }

    /** Heroes, values and values waiting for review, per snapshot. */
    Map<UUID, int[]> counts(Collection<UUID> snapshotIds) {
        Map<UUID, int[]> counts = new HashMap<>();
        if (snapshotIds.isEmpty()) {
            return counts;
        }

        entries.countBySnapshot(snapshotIds).forEach(row -> counts
                .computeIfAbsent(row.getSnapshotId(), id -> new int[3])[0] = (int) row.getTotal());
        values.countBySnapshot(snapshotIds).forEach(row -> {
            var count = counts.computeIfAbsent(row.getSnapshotId(), id -> new int[3]);
            count[1] = (int) row.getTotal();
            count[2] = (int) row.getNeedsReview();
        });
        return counts;
    }

    Map<UUID, String> codes(Collection<UUID> ids) {
        return ids.isEmpty()
                ? Map.of()
                : heroes.findAllById(ids).stream()
                        .collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode, (a, b) -> a));
    }

    static HeroRankingViews.Value value(RankingSnapshotValueRow row, Map<UUID, String> codes) {
        var source = row.getImageId() == null
                ? null
                : new HeroRankingViews.Source(row.getImageId(), row.getBoxX(), row.getBoxY(), row.getBoxWidth(),
                        row.getBoxHeight());
        return new HeroRankingViews.Value(row.getMetric(), row.getNumberValue(), row.getTierValue(),
                row.getHeroValue(), row.getHeroValue() == null ? null : codes.get(row.getHeroValue()),
                row.getReadText(), row.isNeedsReview(), row.getNote(), source, row.getReviewedAt(), row.getVersion());
    }
}
