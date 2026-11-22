package com.wikiaov.hero.internal.ranking.application;

import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.ranking.domain.RankingMetric;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotHeroRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotValueRepository;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotHeroRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Heroes as readers see them in the latest confirmed ranking snapshot of a market and mode (ADR-029): no unconfirmed
 * snapshot, no value waiting for review, no reading text or source area. One hero and the whole board are read from
 * the same snapshot and the same reviewed values, so they always agree.
 */
@Service
@Transactional(readOnly = true)
public class PublishedHeroRankings {
    /** The mode readers see when they name none: ranked games from Elite up. */
    public static final String DEFAULT_MODE = "RANKED_ELITE";

    /** The game's order of the rates board; a hero without a place there comes last. */
    private static final Comparator<RankingSnapshotHeroRow> BOARD_ORDER = Comparator
            .comparing(RankingSnapshotHeroRow::getRatesPosition, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(RankingSnapshotHeroRow::getHeroId);

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
        var found = latest(region, mode);
        if (found.isEmpty()) {
            return new HeroRankingViews.Published(null, null);
        }
        var latest = found.get();

        var own = latest.valuesOf(heroId);
        if (own.isEmpty()) {
            return new HeroRankingViews.Published(latest.view(), null);
        }

        return new HeroRankingViews.Published(latest.view(), entry(heroId, own, latest.values()));
    }

    /**
     * Every hero of the snapshot that the single-hero read gives an entry, in the order of the rates board, with the
     * same tier and rates. No snapshot and no rows when none is confirmed.
     */
    public HeroRankingViews.PublishedBoard board(String region, String mode) {
        var found = latest(region, mode);
        if (found.isEmpty()) {
            return new HeroRankingViews.PublishedBoard(null, List.of());
        }
        var latest = found.get();

        var listed = latest.heroes().stream().sorted(BOARD_ORDER).map(RankingSnapshotHeroRow::getHeroId)
                .filter(heroId -> !latest.valuesOf(heroId).isEmpty()).toList();
        var codes = codes(listed);

        var rows = listed.stream().map(heroId -> rates(heroId, codes.get(heroId), latest.valuesOf(heroId))).toList();
        return new HeroRankingViews.PublishedBoard(latest.view(), rows);
    }

    /** The latest confirmed snapshot of a market and mode, with its heroes and only its reviewed values. */
    private Optional<LatestSnapshot> latest(String region, String mode) {
        if (!RankingSnapshotRules.marketAndMode(region, mode)) {
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "Use an upper-case market and mode code.");
        }

        var found = snapshots.findFirstByRegionCodeAndModeCodeAndConfirmedAtIsNotNullOrderByCapturedAtDescIdAsc(region,
                mode);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        var snapshot = found.get();
        var rows = values.findBySnapshotId(snapshot.getId()).stream().filter(row -> !row.isNeedsReview()).toList();
        var listed = entries.findBySnapshotId(snapshot.getId());

        var view = new HeroRankingViews.PublishedSnapshot(snapshot.getCode(), snapshot.getRegionCode(),
                snapshot.getModeCode(), snapshot.getModeLabel(), snapshot.getPeriodLabel(), snapshot.getCapturedAt(),
                snapshot.getSourceTimeZone(), listed.size());
        return Optional.of(new LatestSnapshot(view, listed, rows));
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

        var rates = rates(heroId, codes.get(heroId), own);
        return new HeroRankingViews.PublishedEntry(heroId, rates.heroCode(), rates.tier(), rates.winRate(),
                rates.pickRate(), rates.banRate(), figures,
                counterIds.stream().map(id -> new HeroRankingViews.Counter(id, codes.get(id))).toList());
    }

    /** The tier and rates of one hero, shared by the single-hero read and the board. */
    private static HeroRankingViews.PublishedRates rates(UUID heroId, @Nullable String heroCode,
            Map<RankingMetric, RankingSnapshotValueRow> own) {
        return new HeroRankingViews.PublishedRates(heroId, heroCode, tier(own.get(RankingMetric.TIER)),
                number(own.get(RankingMetric.WIN_RATE)), number(own.get(RankingMetric.PICK_RATE)),
                number(own.get(RankingMetric.BAN_RATE)));
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

    private record LatestSnapshot(
            HeroRankingViews.PublishedSnapshot view,
            List<RankingSnapshotHeroRow> heroes,
            List<RankingSnapshotValueRow> values,
            Map<UUID, Map<RankingMetric, RankingSnapshotValueRow>> byHero
    ) {
        LatestSnapshot(HeroRankingViews.PublishedSnapshot view, List<RankingSnapshotHeroRow> heroes,
                List<RankingSnapshotValueRow> values) {
            this(view, heroes, values, values.stream().collect(Collectors.groupingBy(RankingSnapshotValueRow::getHeroId,
                    Collectors.toMap(row -> RankingMetric.valueOf(row.getMetric()), row -> row, (a, b) -> a))));
        }

        /** A hero's reviewed values by metric; empty when the hero has none. */
        Map<RankingMetric, RankingSnapshotValueRow> valuesOf(UUID heroId) {
            return byHero.getOrDefault(heroId, Map.of());
        }
    }
}
