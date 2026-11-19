package com.wikiaov.hero.internal.ranking.application;

import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.ranking.domain.RankingMetric;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotHeroRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotValueRepository;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One hero as readers see it in the latest confirmed ranking snapshot of a market and mode (ADR-029): no unconfirmed
 * snapshot, no value waiting for review, no reading text or source area.
 */
@Service
@Transactional(readOnly = true)
public class PublishedHeroRankings {
    private final RankingSnapshotRepository snapshots;
    private final RankingSnapshotHeroRepository entries;
    private final RankingSnapshotValueRepository values;
    private final HeroIdentityRepository heroes;

    public PublishedHeroRankings(RankingSnapshotRepository snapshots, RankingSnapshotHeroRepository entries,
            RankingSnapshotValueRepository values, HeroIdentityRepository heroes) {
        this.snapshots = snapshots;
        this.entries = entries;
        this.values = values;
        this.heroes = heroes;
    }

    public HeroRankingViews.Published published(UUID heroId, String region, String mode) {
        if (!RankingSnapshotRules.marketAndMode(region, mode)) {
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "Use an upper-case market and mode code.");
        }

        var found = snapshots.findFirstByRegionCodeAndModeCodeAndConfirmedAtIsNotNullOrderByCapturedAtDescIdAsc(region,
                mode);
        if (found.isEmpty()) {
            return new HeroRankingViews.Published(null, null);
        }
        var snapshot = found.get();
        var rows = values.findBySnapshotId(snapshot.getId()).stream().filter(row -> !row.isNeedsReview()).toList();
        int heroCount = entries.findBySnapshotId(snapshot.getId()).size();
        var view = new HeroRankingViews.PublishedSnapshot(snapshot.getCode(), snapshot.getRegionCode(),
                snapshot.getModeCode(), snapshot.getModeLabel(), snapshot.getPeriodLabel(), snapshot.getCapturedAt(),
                snapshot.getSourceTimeZone(), heroCount);

        var own = rows.stream().filter(row -> row.getHeroId().equals(heroId))
                .collect(Collectors.toMap(row -> RankingMetric.valueOf(row.getMetric()), row -> row, (a, b) -> a));
        if (own.isEmpty()) {
            return new HeroRankingViews.Published(view, null);
        }

        return new HeroRankingViews.Published(view, entry(heroId, own, rows));
    }

    private HeroRankingViews.PublishedEntry entry(UUID heroId, Map<RankingMetric, RankingSnapshotValueRow> own,
            List<RankingSnapshotValueRow> all) {
        var figures = Arrays.stream(RankingMetric.values()).filter(metric -> metric.kind() == RankingMetric.Kind.AMOUNT)
                .map(metric -> figure(metric, own.get(metric), all)).toList();

        var counterIds = Stream.of(RankingMetric.COUNTER_1, RankingMetric.COUNTER_2, RankingMetric.COUNTER_3)
                .map(own::get).filter(Objects::nonNull)
                .map(RankingSnapshotValueRow::getHeroValue).filter(Objects::nonNull).toList();
        Set<UUID> ids = new HashSet<>(counterIds);
        ids.add(heroId);
        var codes = codes(ids);

        return new HeroRankingViews.PublishedEntry(heroId, codes.get(heroId), tier(own.get(RankingMetric.TIER)),
                number(own.get(RankingMetric.WIN_RATE)), number(own.get(RankingMetric.PICK_RATE)),
                number(own.get(RankingMetric.BAN_RATE)), figures,
                counterIds.stream().map(id -> new HeroRankingViews.Counter(id, codes.get(id))).toList());
    }

    /** A hero's amount with its place among every hero that has one; no place when the hero has none. */
    private static HeroRankingViews.Figure figure(RankingMetric metric, @Nullable RankingSnapshotValueRow mine,
            List<RankingSnapshotValueRow> all) {
        var others = all.stream()
                .filter(row -> row.getMetric().equals(metric.name()) && row.getNumberValue() != null)
                .map(RankingSnapshotValueRow::getNumberValue).toList();
        if (mine == null || mine.getNumberValue() == null) {
            return new HeroRankingViews.Figure(metric.name(), null, null, others.size());
        }

        int rank = 1 + (int) others.stream().filter(value -> value.compareTo(mine.getNumberValue()) > 0).count();
        return new HeroRankingViews.Figure(metric.name(), mine.getNumberValue(), rank, others.size());
    }

    private Map<UUID, String> codes(Collection<UUID> ids) {
        return heroes.findAllById(ids).stream()
                .collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode, (a, b) -> a));
    }

    private static @Nullable String tier(@Nullable RankingSnapshotValueRow row) {
        return row == null ? null : row.getTierValue();
    }

    private static @Nullable BigDecimal number(@Nullable RankingSnapshotValueRow row) {
        return row == null ? null : row.getNumberValue();
    }
}
