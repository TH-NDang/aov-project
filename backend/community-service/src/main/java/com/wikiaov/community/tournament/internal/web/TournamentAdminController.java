package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.application.TournamentAdministration;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class TournamentAdminController implements TournamentAdminApi {
    private final TournamentAdministration administration;

    public TournamentAdminController(TournamentAdministration administration) {
        this.administration = administration;
    }

    @Override
    public Map<String, Object> me() {
        return administration.me();
    }

    @Override
    public Catalog catalog(String region, String locale, UUID seasonId, UUID patchVariantId, boolean includeUnscoped,
            HttpServletRequest request) {
        Parameters.only(request, "region", "locale", "seasonId", "patchVariantId", "includeUnscoped");
        return administration.catalog(region, locale, seasonId, patchVariantId, includeUnscoped);
    }

    @Override
    public PageSlice<View<Team>> teams(String q, RecordState state, int page, int size, HttpServletRequest request) {
        Parameters.only(request, "q", "state", "page", "size");
        Parameters.search(q);
        return administration.teams(q, state, Parameters.page(page, size, "updatedAt"));
    }

    @Override
    public View<Team> getTeam(UUID id) {
        return administration.getTeam(id);
    }

    @Override
    public View<Team> createTeam(Create<Team> request) {
        return administration.createTeam(request.content());
    }

    @Override
    public View<Team> updateTeam(UUID id, Update<Team> request) {
        return administration.updateTeam(id, request.version(), request.content());
    }

    @Override
    public PageSlice<View<Player>> players(String q, RecordState state, int page, int size,
            HttpServletRequest request) {
        Parameters.only(request, "q", "state", "page", "size");
        Parameters.search(q);
        return administration.players(q, state, Parameters.page(page, size, "updatedAt"));
    }

    @Override
    public View<Player> getPlayer(UUID id) {
        return administration.getPlayer(id);
    }

    @Override
    public View<Player> createPlayer(Create<Player> request) {
        return administration.createPlayer(request.content());
    }

    @Override
    public View<Player> updatePlayer(UUID id, Update<Player> request) {
        return administration.updatePlayer(id, request.version(), request.content());
    }

    @Override
    public PageSlice<View<Tournament>> tournaments(String q, RecordState state, int page, int size,
            HttpServletRequest request) {
        Parameters.only(request, "q", "state", "page", "size");
        Parameters.search(q);
        return administration.tournaments(q, state, Parameters.page(page, size, "updatedAt"));
    }

    @Override
    public View<Tournament> getTournament(UUID id) {
        return administration.getTournament(id);
    }

    @Override
    public View<Tournament> createTournament(Create<Tournament> request) {
        return administration.createTournament(request.content());
    }

    @Override
    public View<Tournament> updateTournament(UUID id, Update<Tournament> request) {
        return administration.updateTournament(id, request.version(), request.content());
    }

    @Override
    public PageSlice<View<Series>> series(String q, RecordState state, int page, int size, HttpServletRequest request) {
        Parameters.only(request, "q", "state", "page", "size");
        Parameters.search(q);
        return administration.series(q, state, Parameters.page(page, size, "updatedAt"));
    }

    @Override
    public View<Series> getSeries(UUID id) {
        return administration.getSeries(id);
    }

    @Override
    public View<Series> createSeries(Create<Series> request) {
        return administration.createSeries(request.content());
    }

    @Override
    public View<Series> updateSeries(UUID id, Update<Series> request) {
        return administration.updateSeries(id, request.version(), request.content());
    }

    @Override
    public PageSlice<View<Game>> games(UUID seriesId, RecordState state, int page, int size,
            HttpServletRequest request) {
        Parameters.only(request, "seriesId", "state", "page", "size");
        return administration.games(seriesId, state, Parameters.page(page, size, "updatedAt"));
    }

    @Override
    public View<Game> getGame(UUID id) {
        return administration.getGame(id);
    }

    @Override
    public View<Game> createGame(Create<Game> request) {
        return administration.createGame(request.content());
    }

    @Override
    public View<Game> updateGame(UUID id, Update<Game> request) {
        return administration.updateGame(id, request.version(), request.content());
    }

    @Override
    public View<Game> publishGame(UUID id, Version request) {
        return administration.publishGame(id, request.version());
    }

    @Override
    public View<Game> withdrawGame(UUID id, Version request) {
        return administration.withdrawGame(id, request.version());
    }
}
