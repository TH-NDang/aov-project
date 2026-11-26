package com.wikiaov.community.tournament.internal.statistics.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

class CompetitionStatisticsTest {
    private static final UUID CUP = UUID.randomUUID();
    private static final int WAITING = 8;

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
    void requestsThatWaitedDuringAReadingShareTheOneThatBeganAfterThem() throws Exception {
        // Games are published all the time: every look at the publications finds another one.
        var publications = new AtomicInteger();
        when(games.publications()).thenAnswer(call -> "publication " + publications.incrementAndGet());
        var reading = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var readings = new AtomicInteger();
        when(games.of(CUP)).thenAnswer(call -> {
            if (readings.incrementAndGet() == 1) {
                reading.countDown();
                release.await();
            }
            return List.of(game());
        });

        try (var requests = Executors.newFixedThreadPool(WAITING + 1)) {
            try {
                var first = requests.submit(() -> statistics.of(CUP));
                assertThat(reading.await(10, TimeUnit.SECONDS)).isTrue();
                var waiting = IntStream.range(0, WAITING)
                        .mapToObj(number -> requests.submit(() -> statistics.of(CUP))).toList();
                // Every waiting request has looked at the publications once; the other two are those of the reading.
                await().until(() -> publications.get() == WAITING + 2);
                release.countDown();

                assertThat(first.get().statistics().games()).isEqualTo(1);
                for (var request : waiting) {
                    assertThat(request.get().statistics().games()).isEqualTo(1);
                }
            } finally {
                // Closing the pool waits for the first reading, also when an expectation above did not hold.
                release.countDown();
            }
        }

        assertThat(readings).hasValue(2);
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
        return new PublishedLineup(id, publishedAt, UUID.randomUUID(), 1, null, null, null, List.of(), List.of(), null,
                null);
    }
}
