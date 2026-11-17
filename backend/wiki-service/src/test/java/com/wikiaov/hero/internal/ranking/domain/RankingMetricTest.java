package com.wikiaov.hero.internal.ranking.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class RankingMetricTest {

    @Test
    void aPercentageAboveOneHundredIsRefused() {
        assertThat(RankingMetric.WIN_RATE.problem(new BigDecimal("100.01"), null, false, false)).isPresent();
        assertThat(RankingMetric.WIN_RATE.problem(new BigDecimal("100"), null, false, false)).isEmpty();
    }

    @Test
    void aNumberKeepsAtMostTwoDecimals() {
        assertThat(RankingMetric.KILLS.problem(new BigDecimal("7.125"), null, false, false)).isPresent();
        assertThat(RankingMetric.KILLS.problem(new BigDecimal("7.10"), null, false, false)).isEmpty();
    }

    @Test
    void aTierIsT0ToT9() {
        assertThat(RankingMetric.TIER.problem(null, "T10", false, false)).isPresent();
        assertThat(RankingMetric.TIER.problem(null, "T1", false, false)).isEmpty();
    }

    @Test
    void aMetricTakesOnlyTheFieldOfItsKind() {
        assertThat(RankingMetric.TIER.problem(BigDecimal.ONE, null, false, false)).isPresent();
        assertThat(RankingMetric.COUNTER_1.problem(null, "T1", true, false)).isPresent();
    }

    @Test
    void aMetricWithoutAValueMustWaitForReview() {
        assertThat(RankingMetric.GOLD.problem(null, null, false, false)).isPresent();
        assertThat(RankingMetric.GOLD.problem(null, null, false, true)).isEmpty();
    }

    @Test
    void parsingKnowsOnlyTheExactNames() {
        assertThat(RankingMetric.parse("WIN_RATE")).contains(RankingMetric.WIN_RATE);
        assertThat(RankingMetric.parse("win_rate")).isEmpty();
    }
}
