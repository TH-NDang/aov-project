package com.wikiaov.community.tournament.internal.games.application;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.PublishedGame;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.games.persistence.GameRecord;
import com.wikiaov.community.tournament.internal.games.persistence.GameRepository;
import com.wikiaov.community.tournament.internal.games.persistence.PublishedOverviewRepository;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@Service
public class PublicTournamentQueries {
    private final GameRepository games;
    private final PublishedOverviewRepository overview;
    /**
     * Published snapshots keep the fields they were written with. Requests refuse unknown fields; stored history
     * must stay readable after a field is dropped from the record.
     */
    private final ObjectReader tournaments;
    private final ObjectReader series;

    public PublicTournamentQueries(GameRepository games, PublishedOverviewRepository overview, JsonMapper json) {
        this.games = games;
        this.overview = overview;
        this.tournaments = json.readerFor(Tournament.class).without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        this.series = json.readerFor(Series.class).without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }

    /** The published games, narrowed to a tournament, a series and a hero a participant picked; null leaves one out. */
    @Transactional(readOnly = true)
    public PageSlice<PublishedGame> games(@Nullable UUID tournamentId, @Nullable UUID seriesId, @Nullable UUID heroId,
            Pageable page) {
        return PageSlice.from(games.findPublic(text(tournamentId), text(seriesId), text(heroId), page)
                .map(GameRecord::getPublishedSnapshot));
    }

    @Transactional(readOnly = true)
    public PublishedGame game(UUID id) {
        return games.findById(id).map(GameRecord::getPublishedSnapshot).filter(Objects::nonNull)
                .orElseThrow(TournamentErrors::missing);
    }

    public record Summary<T>(
            UUID id,
            T content,
            long gameCount
    ) {
    }

    @Transactional(readOnly = true)
    public PageSlice<Summary<Tournament>> tournaments(Pageable page) {
        var rows = overview.tournaments(PageRequest.of(page.getPageNumber(), page.getPageSize()));
        return PageSlice.from(rows.map(row -> new Summary<>(row.getId(),
                tournaments.<Tournament>readValue(row.getContentJson()), row.getGameCount())));
    }

    @Transactional(readOnly = true)
    public PageSlice<Summary<Series>> series(UUID tournamentId, Pageable page) {
        var rows = overview.series(tournamentId == null ? null : tournamentId.toString(),
                PageRequest.of(page.getPageNumber(), page.getPageSize()));
        return PageSlice.from(rows.map(row -> new Summary<>(row.getId(),
                series.<Series>readValue(row.getContentJson()), row.getGameCount())));
    }

    /** Ids stand as text in the snapshots. */
    private static @Nullable String text(@Nullable UUID id) {
        return id == null ? null : id.toString();
    }
}
