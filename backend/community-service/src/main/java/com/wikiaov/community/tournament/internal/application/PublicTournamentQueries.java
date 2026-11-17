package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import com.wikiaov.community.tournament.internal.persistence.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@Service
@Transactional(readOnly = true)
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
                tournaments.<Tournament>readValue(row.getContentJson()), row.getGameCount())));
    }

    public PageSlice<Summary<Series>> series(UUID tournamentId, Pageable page) {
        var rows = overview.series(tournamentId == null ? null : tournamentId.toString(),
                PageRequest.of(page.getPageNumber(), page.getPageSize()));
        return PageSlice.from(rows.map(row -> new Summary<>(row.getId(),
                series.<Series>readValue(row.getContentJson()), row.getGameCount())));
    }
}
