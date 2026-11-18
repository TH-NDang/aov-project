package com.wikiaov.community.tournament.internal.games.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.community.tournament.internal.games.persistence.GameRepository;
import com.wikiaov.community.tournament.internal.games.persistence.PublishedOverviewRepository;
import com.wikiaov.community.tournament.internal.games.persistence.PublishedOverviewRepository.SummaryRow;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

class PublicTournamentQueriesTest {
    /** The application mapper refuses unknown fields in requests. */
    private final JsonMapper strict = JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();
    private final PublishedOverviewRepository overview = mock(PublishedOverviewRepository.class);
    private final PublicTournamentQueries queries = new PublicTournamentQueries(mock(GameRepository.class), overview,
            strict);

    @Test
    void aPublishedTournamentWithAFieldDroppedSinceStaysReadable() {
        when(overview.tournaments(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(
                row("{\"code\":\"event\",\"name\":\"Event\",\"region\":\"VN\",\"retiredField\":true}"))));

        var page = queries.tournaments(PageRequest.of(0, 10));

        assertThat(page.items().getFirst().content().name()).isEqualTo("Event");
    }

    @Test
    void aPublishedSeriesWithAFieldDroppedSinceStaysReadable() {
        when(overview.series(any(), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(
                row("{\"code\":\"final\",\"name\":\"Final\",\"bestOf\":5,\"repeatPicksAllowed\":false,\"retiredField\":1}"))));

        var page = queries.series(null, PageRequest.of(0, 10));

        assertThat(page.items().getFirst().content().bestOf()).isEqualTo(5);
    }

    private static SummaryRow row(String json) {
        var id = UUID.randomUUID();
        return new SummaryRow() {
            @Override
            public UUID getId() {
                return id;
            }

            @Override
            public String getContentJson() {
                return json;
            }

            @Override
            public long getGameCount() {
                return 1;
            }
        };
    }
}
