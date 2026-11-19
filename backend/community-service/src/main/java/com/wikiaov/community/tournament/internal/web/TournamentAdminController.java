package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
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
import com.wikiaov.community.tournament.internal.directory.application.PlayerFilter;
import com.wikiaov.community.tournament.internal.directory.application.TournamentFilter;
import com.wikiaov.community.tournament.internal.directory.application.TournamentLevel;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.registry.application.TournamentAdministration;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TournamentAdminController implements TournamentAdminApi {
    private final TournamentAdministration administration;

    public TournamentAdminController(TournamentAdministration administration) {
        this.administration = administration;
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/me", version = "1")
    public Map<String, Object> me() {
        return administration.me();
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/catalog", version = "1")
    public Catalog catalog(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return administration.catalog(region, locale, seasonId, patchVariantId, includeUnscoped);
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/teams", version = "1")
    public PageSlice<Ranked<Team>> teams(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "RECENT") String sort, @RequestParam(required = false) UUID tournamentId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "state", "sort", "tournamentId", "page", "size"));
        return administration.teams(q, state, sort, tournamentId, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/teams/{id}", version = "1")
    public View<Team> getTeam(@PathVariable UUID id) {
        return administration.getTeam(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/teams", version = "1")
    public View<Team> createTeam(@RequestBody Create<Team> request) {
        return administration.createTeam(request.content());
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/teams/{id}", version = "1")
    public View<Team> updateTeam(@PathVariable UUID id, @RequestBody Update<Team> request) {
        return administration.updateTeam(id, request.version(), request.content());
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/teams/directory", version = "1")
    public PageSlice<TeamEntry> teamDirectory(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String country, @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "country", "sort", "page", "size"));
        return administration.teamDirectory(q, country, sort, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/players/directory", version = "1")
    public PageSlice<PlayerEntry> playerDirectory(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String country, @RequestParam(defaultValue = "") String lane,
            @RequestParam(defaultValue = "") String status, @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "country", "lane", "status", "sort", "page", "size"));
        return administration.playerDirectory(new PlayerFilter(q, country, lane, status, sort),
                Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/competitions/page-stats", version = "1")
    public List<CompetitionPageEntry> competitionPageStats(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return administration.competitionPageStats();
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/players", version = "1")
    public PageSlice<Ranked<Player>> players(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "RECENT") String sort, @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID tournamentId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "state", "sort", "teamId", "tournamentId", "page", "size"));
        return administration.players(q, state, sort, teamId, tournamentId,
                Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/players/{id}", version = "1")
    public View<Player> getPlayer(@PathVariable UUID id) {
        return administration.getPlayer(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/players", version = "1")
    public View<Player> createPlayer(@RequestBody Create<Player> request) {
        return administration.createPlayer(request.content());
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/players/{id}", version = "1")
    public View<Player> updatePlayer(@PathVariable UUID id, @RequestBody Update<Player> request) {
        return administration.updatePlayer(id, request.version(), request.content());
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/tournaments", version = "1")
    public PageSlice<Ranked<Tournament>> tournaments(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String alsoRegions,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String tier, @RequestParam(defaultValue = "") String region,
            @RequestParam(required = false) Integer year, @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(defaultValue = "ALL") TournamentLevel level, @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID playerId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("q", "alsoRegions", "state", "status", "tier", "region", "year", "sort", "level",
                        "teamId", "playerId", "page", "size"));
        var filter = new TournamentFilter(q, alsoRegions, status, tier, region, year, sort, level, teamId, playerId);
        return administration.tournaments(filter, state, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/tournaments/facets", version = "1")
    public TournamentFacets tournamentFacets(@RequestParam(defaultValue = "ALL") TournamentLevel level,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("level"));
        return administration.tournamentFacets(level);
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/tournaments/parts", version = "1")
    public List<TournamentPart> tournamentParts(@RequestParam(required = false) UUID parentId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("parentId"));
        return administration.tournamentParts(parentId);
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/tournaments/{id}", version = "1")
    public View<Tournament> getTournament(@PathVariable UUID id) {
        return administration.getTournament(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/tournaments", version = "1")
    public View<Tournament> createTournament(@RequestBody Create<Tournament> request) {
        return administration.createTournament(request.content());
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/tournaments/{id}", version = "1")
    public View<Tournament> updateTournament(@PathVariable UUID id, @RequestBody Update<Tournament> request) {
        return administration.updateTournament(id, request.version(), request.content());
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/series", version = "1")
    public PageSlice<View<Series>> series(@RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) UUID tournamentId, @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "tournamentId", "state", "page", "size"));
        return administration.series(q, tournamentId, state, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/tournaments/stats", version = "1")
    public List<TournamentStats> tournamentStats(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return administration.tournamentStats();
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/series/{id}", version = "1")
    public View<Series> getSeries(@PathVariable UUID id) {
        return administration.getSeries(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/series", version = "1")
    public View<Series> createSeries(@RequestBody Create<Series> request) {
        return administration.createSeries(request.content());
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/series/{id}", version = "1")
    public View<Series> updateSeries(@PathVariable UUID id, @RequestBody Update<Series> request) {
        return administration.updateSeries(id, request.version(), request.content());
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/games", version = "1")
    public PageSlice<View<Game>> games(@RequestParam(required = false) UUID seriesId,
            @RequestParam(required = false) UUID tournamentId, @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("seriesId", "tournamentId", "state", "page", "size"));
        return administration.games(seriesId, tournamentId, state, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/games/{id}", version = "1")
    public View<Game> getGame(@PathVariable UUID id) {
        return administration.getGame(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/games", version = "1")
    public View<Game> createGame(@RequestBody Create<Game> request) {
        return administration.createGame(request.content());
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/games/{id}", version = "1")
    public View<Game> updateGame(@PathVariable UUID id, @RequestBody Update<Game> request) {
        return administration.updateGame(id, request.version(), request.content());
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/games/{id}/publish", version = "1")
    public View<Game> publishGame(@PathVariable UUID id, @RequestBody Version request) {
        return administration.publishGame(id, request.version());
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/games/{id}/withdraw", version = "1")
    public View<Game> withdrawGame(@PathVariable UUID id, @RequestBody Version request) {
        return administration.withdrawGame(id, request.version());
    }
}
