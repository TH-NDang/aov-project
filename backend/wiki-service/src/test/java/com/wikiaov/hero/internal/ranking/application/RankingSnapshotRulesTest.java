package com.wikiaov.hero.internal.ranking.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.hero.internal.application.HeroRankingCommands;
import java.util.List;
import org.junit.jupiter.api.Test;

class RankingSnapshotRulesTest {
    private static final String IMAGE = "a".repeat(64);

    @Test
    void imagesAreSizedByIdOnceEachPageIsListedOnce() {
        var sizes = RankingSnapshotRules.validateImages(List.of(image(IMAGE, "RATES", 1),
                image("b".repeat(64), "FIGURES", 1)));

        assertThat(sizes.get(IMAGE)).containsExactly(1080, 2400);
    }

    @Test
    void aPageOfOneBoardListedTwiceIsInvalid() {
        assertThatThrownBy(() -> RankingSnapshotRules.validateImages(List.of(image(IMAGE, "RATES", 1),
                image("b".repeat(64), "RATES", 1))))
                .hasMessage("Page 1 of RATES is listed twice.");
    }

    @Test
    void anImageOutsideTheTwoBoardsIsInvalid() {
        assertThatThrownBy(() -> RankingSnapshotRules.validateImages(List.of(image(IMAGE, "HEROES", 1))))
                .hasMessage("An image belongs to the RATES or FIGURES board.");
    }

    @Test
    void aMarketAndAModeAreUpperCaseCodes() {
        assertThat(RankingSnapshotRules.marketAndMode("VN", "RANKED_ELITE")).isTrue();
        assertThat(RankingSnapshotRules.marketAndMode("vn", "RANKED_ELITE")).isFalse();
        assertThat(RankingSnapshotRules.marketAndMode("VN", "ranked")).isFalse();
    }

    private static HeroRankingCommands.Image image(String id, String board, int page) {
        return new HeroRankingCommands.Image(id, board, page, "board.png", 1080, 2400);
    }
}
