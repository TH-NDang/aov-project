package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.application.TournamentAdministration;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Create;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Ranked;
import com.wikiaov.community.tournament.internal.application.TournamentViews.TournamentStats;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Update;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Version;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.CompetitionPageEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.PlayerEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TeamEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentPart;
import com.wikiaov.community.tournament.internal.directory.application.TournamentLevel;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

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
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return administration.catalog(region, locale, seasonId, patchVariantId, includeUnscoped);
    }

    @Override
    public PageSlice<Ranked<Team>> teams(String q, RecordState state, String sort, UUID tournamentId, int page,
            int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "state", "sort", "tournamentId", "page", "size"));
        return administration.teams(q, state, sort, tournamentId, Parameters.pageable(page, size, "updatedAt"));
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
    public PageSlice<TeamEntry> teamDirectory(String q, String country, String sort, int page, int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "country", "sort", "page", "size"));
        return administration.teamDirectory(q, country, sort, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    public PageSlice<PlayerEntry> playerDirectory(String q, String country, String lane, String status, String sort,
            int page, int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "country", "lane", "status", "sort", "page", "size"));
        return administration.playerDirectory(q, country, lane, status, sort,
                Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    public List<CompetitionPageEntry> competitionPageStats(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return administration.competitionPageStats();
    }

    @Override
    public PageSlice<Ranked<Player>> players(String q, RecordState state, String sort, UUID teamId, UUID tournamentId,
            int page, int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "state", "sort", "teamId", "tournamentId", "page", "size"));
        return administration.players(q, state, sort, teamId, tournamentId,
                Parameters.pageable(page, size, "updatedAt"));
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
    public PageSlice<Ranked<Tournament>> tournaments(String q, String alsoRegions, RecordState state, String status,
            String tier, String region, Integer year, String sort, TournamentLevel level, UUID teamId, UUID playerId,
            int page,
            int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("q", "alsoRegions", "state", "status", "tier", "region", "year", "sort", "level",
                        "teamId", "playerId", "page", "size"));
        return administration.tournaments(q, alsoRegions, state, status, tier, region, year, sort, level, teamId,
                playerId, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    public TournamentFacets tournamentFacets(TournamentLevel level, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("level"));
        return administration.tournamentFacets(level);
    }

    @Override
    public List<TournamentPart> tournamentParts(UUID parentId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("parentId"));
        return administration.tournamentParts(parentId);
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
    public PageSlice<View<Series>> series(String q, UUID tournamentId, RecordState state, int page, int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "tournamentId", "state", "page", "size"));
        return administration.series(q, tournamentId, state, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    public List<TournamentStats> tournamentStats(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return administration.tournamentStats();
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
    public PageSlice<View<Game>> games(UUID seriesId, UUID tournamentId, RecordState state, int page, int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("seriesId", "tournamentId", "state", "page", "size"));
        return administration.games(seriesId, tournamentId, state, Parameters.pageable(page, size, "updatedAt"));
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
