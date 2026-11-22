package com.wikiaov.hero.internal.ranking.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.internal.application.response.HeroRankingViews.Figure;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.ranking.domain.RankingMetric;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotHeroRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotValueRepository;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotHeroRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeroRankingsPublishedTest {
    private static final UUID AIRI = UUID.randomUUID();
    private static final UUID BUTTERFLY = UUID.randomUUID();
    private static final UUID ZATA = UUID.randomUUID();

    private final RankingSnapshotRepository snapshots = mock(RankingSnapshotRepository.class);
    private final RankingSnapshotValueRepository values = mock(RankingSnapshotValueRepository.class);
    private final RankingSnapshotHeroRepository entries = mock(RankingSnapshotHeroRepository.class);
    private final HeroIdentityRepository heroes = mock(HeroIdentityRepository.class);
    private final PublishedHeroRankings rankings = new PublishedHeroRankings(snapshots, entries, values, heroes);
    private final RankingSnapshotRow snapshot = new RankingSnapshotRow();

    HeroRankingsPublishedTest() {
        snapshot.setId(UUID.randomUUID());
        snapshot.setCode("vn-elite-2026-11-11");
        snapshot.setRegionCode("VN");
        snapshot.setModeCode("RANKED_ELITE");
        snapshot.setCapturedAt(Instant.parse("2026-11-11T03:00:00Z"));
        when(heroes.findAllById(anyCollection())).thenReturn(List.of(identity(AIRI, "airi")));
    }

    @Test
    void withoutAConfirmedSnapshotReadersSeeNothing() {
        when(snapshots.findFirstByRegionCodeAndModeCodeAndConfirmedAtIsNotNullOrderByCapturedAtDescIdAsc("VN",
                "RANKED_ELITE")).thenReturn(Optional.empty());

        var published = rankings.published(AIRI, "VN", "RANKED_ELITE");

        assertThat(published.snapshot()).isNull();
        assertThat(published.entry()).isNull();
    }

    @Test
    void aHerosRankCountsTheHeroesWithAHigherFigure() {
        confirmed(value(AIRI, RankingMetric.KILLS, "7.5", false), value(BUTTERFLY, RankingMetric.KILLS, "9", false),
                value(ZATA, RankingMetric.KILLS, "6", false));

        var entry = rankings.published(AIRI, "VN", "RANKED_ELITE").entry();

        assertThat(entry.figures()).filteredOn(figure -> figure.metric().equals("KILLS")).singleElement()
                .isEqualTo(new Figure("KILLS", new BigDecimal("7.5"), 2, 3));
    }

    @Test
    void aValueWaitingForReviewIsLeftOutOfTheReadersView() {
        confirmed(value(AIRI, RankingMetric.WIN_RATE, "51.2", true),
                value(AIRI, RankingMetric.PICK_RATE, "3.1", false));

        var entry = rankings.published(AIRI, "VN", "RANKED_ELITE").entry();

        assertThat(entry.winRate()).isNull();
        assertThat(entry.pickRate()).isEqualByComparingTo("3.1");
    }

    @Test
    void withoutAConfirmedSnapshotTheBoardIsEmpty() {
        when(snapshots.findFirstByRegionCodeAndModeCodeAndConfirmedAtIsNotNullOrderByCapturedAtDescIdAsc("VN",
                "RANKED_ELITE")).thenReturn(Optional.empty());

        var board = rankings.board("VN", "RANKED_ELITE");

        assertThat(board.snapshot()).isNull();
        assertThat(board.entries()).isEmpty();
    }

    @Test
    void theBoardListsTheHeroesWithAReviewedValueInTheOrderOfTheRatesBoard() {
        var airiTier = value(AIRI, RankingMetric.TIER, "0", false);
        airiTier.setNumberValue(null);
        airiTier.setTierValue("T1");
        confirmed(airiTier, value(AIRI, RankingMetric.WIN_RATE, "51.2", false),
                value(AIRI, RankingMetric.BAN_RATE, "8", true), value(BUTTERFLY, RankingMetric.PICK_RATE, "4.4", false),
                value(ZATA, RankingMetric.WIN_RATE, "49", true));
        listed(listedHero(AIRI, null), listedHero(ZATA, 1), listedHero(BUTTERFLY, 2));
        when(heroes.findAllById(anyCollection()))
                .thenReturn(List.of(identity(AIRI, "airi"), identity(BUTTERFLY, "butterfly")));

        var board = rankings.board("VN", "RANKED_ELITE");

        assertThat(board.snapshot().code()).isEqualTo("vn-elite-2026-11-11");
        assertThat(board.snapshot().heroes()).isEqualTo(3);
        assertThat(board.entries())
                .extracting(entry -> entry.heroCode(), entry -> entry.tier(), entry -> entry.winRate(),
                        entry -> entry.pickRate(), entry -> entry.banRate())
                .containsExactly(tuple("butterfly", null, null, new BigDecimal("4.4"), null),
                        tuple("airi", "T1", new BigDecimal("51.2"), null, null));
    }

    @Test
    void theBoardShowsAHeroAsTheSingleHeroReadDoes() {
        confirmed(value(AIRI, RankingMetric.WIN_RATE, "51.2", false),
                value(AIRI, RankingMetric.PICK_RATE, "3.1", false),
                value(AIRI, RankingMetric.BAN_RATE, "9.9", true));
        listed(listedHero(AIRI, 1));

        var single = rankings.published(AIRI, "VN", "RANKED_ELITE");
        var board = rankings.board("VN", "RANKED_ELITE");

        assertThat(board.snapshot()).isEqualTo(single.snapshot());
        assertThat(board.entries()).singleElement().satisfies(entry -> {
            assertThat(entry.heroId()).isEqualTo(single.entry().heroId());
            assertThat(entry.heroCode()).isEqualTo(single.entry().heroCode());
            assertThat(entry.tier()).isEqualTo(single.entry().tier());
            assertThat(entry.winRate()).isEqualTo(single.entry().winRate());
            assertThat(entry.pickRate()).isEqualTo(single.entry().pickRate());
            assertThat(entry.banRate()).isEqualTo(single.entry().banRate());
        });
    }

    private void listed(RankingSnapshotHeroRow... rows) {
        when(entries.findBySnapshotId(snapshot.getId())).thenReturn(List.of(rows));
    }

    private RankingSnapshotHeroRow listedHero(UUID heroId, Integer ratesPosition) {
        var row = new RankingSnapshotHeroRow();
        row.setSnapshotId(snapshot.getId());
        row.setHeroId(heroId);
        row.setRatesPosition(ratesPosition);
        return row;
    }

    private void confirmed(RankingSnapshotValueRow... rows) {
        when(snapshots.findFirstByRegionCodeAndModeCodeAndConfirmedAtIsNotNullOrderByCapturedAtDescIdAsc("VN",
                "RANKED_ELITE")).thenReturn(Optional.of(snapshot));
        when(values.findBySnapshotId(snapshot.getId())).thenReturn(List.of(rows));
        when(entries.findBySnapshotId(snapshot.getId())).thenReturn(List.of());
    }

    private RankingSnapshotValueRow value(UUID heroId, RankingMetric metric, String number, boolean needsReview) {
        var row = new RankingSnapshotValueRow();
        row.setSnapshotId(snapshot.getId());
        row.setHeroId(heroId);
        row.setMetric(metric.name());
        row.setNumberValue(new BigDecimal(number));
        row.setNeedsReview(needsReview);
        return row;
    }

    private static HeroIdentity identity(UUID id, String code) {
        var hero = new HeroIdentity();
        hero.setId(id);
        hero.setCode(code);
        return hero;
    }
}
