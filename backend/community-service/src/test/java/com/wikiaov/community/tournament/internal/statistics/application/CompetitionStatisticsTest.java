package com.wikiaov.community.tournament.internal.statistics.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.persistence.PublishedLineups;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

class CompetitionStatisticsTest {
    private static final UUID CUP = UUID.randomUUID();

    private final CompetitionPlanRepository plans = mock(CompetitionPlanRepository.class);
    private final PublishedLineups games = mock(PublishedLineups.class);
    private final CompetitionStatistics statistics = new CompetitionStatistics(plans, games,
            mock(PlatformTransactionManager.class));

    @BeforeEach
    void published() {
        when(plans.existsByIdAndPublishedAtIsNotNull(any())).thenReturn(true);
        when(games.publications()).thenReturn("first");
        when(games.of(any())).thenReturn(List.of(game()));
    }

    @Test
    void theGamesAreReadOnceWhileNothingIsPublishedOrWithdrawn() {
        statistics.of(CUP);
        statistics.of(CUP);

        verify(games, times(1)).of(CUP);
    }

    @Test
    void aPublicationHasTheGamesReadAgain() {
        statistics.of(CUP);
        when(games.publications()).thenReturn("second");
        when(games.of(CUP)).thenReturn(List.of(game(), game()));

        assertThat(statistics.of(CUP).statistics().games()).isEqualTo(2);
    }

    @Test
    void theRevisionStaysWhenTheSameGamesAreReadAgain() {
        var before = statistics.of(CUP).revision();
        when(games.publications()).thenReturn("second");

        assertThat(statistics.of(CUP).revision()).isEqualTo(before);
    }

    @Test
    void aGamePublishedAgainChangesTheRevision() {
        var game = game();
        when(games.of(CUP)).thenReturn(List.of(game));
        var before = statistics.of(CUP).revision();
        when(games.publications()).thenReturn("second");
        when(games.of(CUP)).thenReturn(List.of(publishedAt(game.id(), Instant.EPOCH.plusSeconds(1))));

        assertThat(statistics.of(CUP).revision()).isNotEqualTo(before);
    }

    @Test
    void theCompetitionAskedForLongestAgoMakesRoomForANewOne() {
        statistics.of(CUP);
        var second = UUID.randomUUID();
        statistics.of(second);
        for (int number = 2; number < CompetitionStatistics.MAX_READINGS; number++) {
            statistics.of(UUID.randomUUID());
        }
        statistics.of(CUP);

        statistics.of(UUID.randomUUID());
        statistics.of(CUP);
        statistics.of(second);

        verify(games, times(1)).of(CUP);
        verify(games, times(2)).of(second);
    }

    private static PublishedLineup game() {
        return publishedAt(UUID.randomUUID(), Instant.EPOCH);
    }

    private static PublishedLineup publishedAt(UUID id, Instant publishedAt) {
        return new PublishedLineup(id, publishedAt, null, null, null, List.of(), List.of());
    }
}
