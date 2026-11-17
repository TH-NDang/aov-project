package com.wikiaov.community.tournament.internal.directory.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryRepository;
import com.wikiaov.community.tournament.internal.persistence.PlayerRepository;
import com.wikiaov.community.tournament.internal.persistence.TeamRepository;
import com.wikiaov.community.tournament.internal.persistence.TournamentRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class CompetitionDirectoryTest {
    private final DirectoryRepository directory = mock(DirectoryRepository.class);
    private final CompetitionDirectory directories = new CompetitionDirectory(directory, mock(TeamRepository.class),
            mock(PlayerRepository.class), mock(TournamentRepository.class));

    @Test
    void aListOfMainEventsAsksTheDatabaseForMainEventsOnly() {
        when(directory.rankedTournaments(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), eq(true), anyString(), anyString(), any(Pageable.class))).thenReturn(Page.empty());

        directories.rankedTournaments("", "", "", "", "", null, "RECENT", TournamentLevel.MAIN, null, null,
                PageRequest.of(0, 10));

        verify(directory).rankedTournaments(anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString(), eq(true), anyString(), anyString(), any(Pageable.class));
    }

    @Test
    void theFacetsOfEveryTournamentCountTheParts() {
        when(directory.tournamentFacets(false)).thenReturn(List.of());

        directories.tournamentFacets(TournamentLevel.ALL);

        verify(directory).tournamentFacets(false);
    }

    @Test
    void anUnsupportedOrderIsAnInvalidQueryParameter() {
        var error = catchThrowableOfType(ApiException.class, () -> directories.rankedTournaments("", "", "", "", "",
                null, "LOUDEST", TournamentLevel.ALL, null, null, PageRequest.of(0, 10)));

        assertThat(error.code()).isEqualTo("INVALID_QUERY_PARAMETER");
    }
}
