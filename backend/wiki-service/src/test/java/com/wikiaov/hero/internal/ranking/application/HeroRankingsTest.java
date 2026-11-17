package com.wikiaov.hero.internal.ranking.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotHeroRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotImageRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotValueRepository;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class HeroRankingsTest {
    private final RankingSnapshotRepository snapshots = mock(RankingSnapshotRepository.class);
    private final RankingSnapshotValueRepository values = mock(RankingSnapshotValueRepository.class);
    private final HeroRankings rankings = new HeroRankings(snapshots, mock(RankingSnapshotImageRepository.class),
            mock(RankingSnapshotHeroRepository.class), values, mock(HeroIdentityRepository.class),
            mock(CurrentActor.class), mock(AuditLog.class), Clock.systemUTC());

    @ParameterizedTest
    @CsvSource({"vn, RANKED_ELITE", "VN, ranked-elite"})
    void aMarketOrModeOutsideItsPatternIsABadQueryParameter(String region, String mode) {
        assertThatThrownBy(() -> rankings.published(UUID.randomUUID(), region, mode))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER));
        verifyNoInteractions(snapshots, values);
    }
}
