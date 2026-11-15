package com.wikiaov.gamemode.internal.lineup.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.domain.AutoChessFixtures;
import java.util.List;
import org.junit.jupiter.api.Test;

class TraitActivationTest {
    private final AutoChessContent guide = AutoChessFixtures.guide();

    @Test
    void countsDistinctUnitsAndPicksTheHighestReachedTier() {
        var counts = TraitActivation.byTrait(TraitActivation.count(guide,
                List.of("violet", "violet", "florentino", "amily", "arduin"), List.of()));

        assertThat(counts.get("giai-dieu-hoc-duong").count()).isEqualTo(3);
        assertThat(counts.get("giai-dieu-hoc-duong").reachedTier()).isZero();
        assertThat(counts.get("dau-si").count()).isEqualTo(2);
        assertThat(counts.get("dau-si").reachedTier()).isZero();
        assertThat(counts.get("phao-thu").reachedTier()).isEqualTo(-1);
    }

    @Test
    void emblemsAddOneEachAndUnknownUnitsAreIgnored() {
        var counts = TraitActivation.byTrait(TraitActivation.count(guide, List.of("violet", "nobody"),
                List.of("phao-thu")));

        assertThat(counts.get("phao-thu").count()).isEqualTo(2);
        assertThat(counts.get("phao-thu").reachedTier()).isZero();
        assertThat(counts).doesNotContainKey("dau-si");
    }

    @Test
    void insightsWeightUnitsByLikesAndCountTopTiers() {
        var lineup = List.of(new LineupUnit("violet", true, null, null, List.of()),
                new LineupUnit("florentino", false, null, null, List.of()),
                new LineupUnit("amily", false, null, null, List.of()));
        var summary = LineupInsights.summarize(guide, List.of(new LineupInsights.Sample(lineup, List.of(), 4),
                new LineupInsights.Sample(List.of(new LineupUnit("arduin", false, null, null, List.of()),
                        new LineupUnit("florentino", true, null, null, List.of())), List.of(), 0)));

        assertThat(summary.lineupCount()).isEqualTo(2);
        assertThat(summary.units().getFirst().code()).isEqualTo("florentino");
        assertThat(summary.units().getFirst().weighted()).isEqualTo(6);
        assertThat(summary.units().getFirst().carryCount()).isEqualTo(1);
        assertThat(summary.traits()).extracting(LineupInsights.TraitUsage::code).contains("giai-dieu-hoc-duong",
                "dau-si");
        assertThat(summary.costs()).containsExactly(new LineupInsights.CostShare(1, 3),
                new LineupInsights.CostShare(2, 2));
    }
}
