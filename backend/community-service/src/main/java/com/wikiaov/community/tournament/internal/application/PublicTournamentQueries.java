package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import com.wikiaov.community.tournament.internal.persistence.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@Transactional(readOnly = true)
public class PublicTournamentQueries {
    private final GameRepository games;
    private final PublishedOverviewRepository overview;
    private final JsonMapper json;

    public PublicTournamentQueries(GameRepository games, PublishedOverviewRepository overview, JsonMapper json) {
        this.games = games;
        this.overview = overview;
        this.json = json;
    }

    public PageSlice<PublishedGame> games(UUID tournamentId, UUID seriesId, Pageable page) {
        return PageSlice
                .from(games
                        .findPublic(tournamentId == null ? null : tournamentId.toString(),
                                seriesId == null ? null : seriesId.toString(), page)
                        .map(GameRecord::getPublishedSnapshot));
    }

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

    public PageSlice<Summary<Tournament>> tournaments(Pageable page) {
        var rows = overview.tournaments(PageRequest.of(page.getPageNumber(), page.getPageSize()));
        return PageSlice.from(rows.map(row -> new Summary<>(row.getId(),
                json.readValue(row.getContentJson(), Tournament.class), row.getGameCount())));
    }

    public PageSlice<Summary<Series>> series(UUID tournamentId, Pageable page) {
        var rows = overview.series(tournamentId == null ? null : tournamentId.toString(),
                PageRequest.of(page.getPageNumber(), page.getPageSize()));
        return PageSlice.from(rows.map(row -> new Summary<>(row.getId(),
                json.readValue(row.getContentJson(), Series.class), row.getGameCount())));
    }
}
