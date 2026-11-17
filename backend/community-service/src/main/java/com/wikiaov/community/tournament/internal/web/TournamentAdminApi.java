package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
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
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@RequestMapping(version = "1")
public interface TournamentAdminApi {
    @GetMapping(ApiPaths.ADMIN + "/me")
    Map<String, Object> me();

    @GetMapping(ApiPaths.ADMIN + "/catalog")
    Catalog catalog(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/teams")
    PageSlice<Ranked<Team>> teams(@RequestParam(defaultValue = "") @Size(max = Parameters.MAX_SEARCH) String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(required = false) UUID tournamentId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/teams/directory")
    PageSlice<TeamEntry> teamDirectory(@RequestParam(defaultValue = "") @Size(max = Parameters.MAX_SEARCH) String q,
            @RequestParam(defaultValue = "") String country,
            @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "24") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/teams/{id}")
    View<Team> getTeam(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/teams")
    View<Team> createTeam(@RequestBody Create<Team> request);

    @PutMapping(ApiPaths.ADMIN + "/teams/{id}")
    View<Team> updateTeam(@PathVariable UUID id, @RequestBody Update<Team> request);

    @GetMapping(ApiPaths.ADMIN + "/players")
    PageSlice<Ranked<Player>> players(@RequestParam(defaultValue = "") @Size(max = Parameters.MAX_SEARCH) String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID tournamentId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/players/directory")
    PageSlice<PlayerEntry> playerDirectory(@RequestParam(defaultValue = "") @Size(max = Parameters.MAX_SEARCH) String q,
            @RequestParam(defaultValue = "") String country,
            @RequestParam(defaultValue = "") String lane,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "24") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/players/{id}")
    View<Player> getPlayer(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/players")
    View<Player> createPlayer(@RequestBody Create<Player> request);

    @PutMapping(ApiPaths.ADMIN + "/players/{id}")
    View<Player> updatePlayer(@PathVariable UUID id, @RequestBody Update<Player> request);

    @GetMapping(ApiPaths.ADMIN + "/tournaments")
    PageSlice<Ranked<Tournament>> tournaments(
            @RequestParam(defaultValue = "") @Size(max = Parameters.MAX_SEARCH) String q,
            @RequestParam(defaultValue = "") String alsoRegions,
            @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String tier,
            @RequestParam(defaultValue = "") String region,
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(defaultValue = "ALL") TournamentLevel level,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID playerId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/tournaments/facets")
    TournamentFacets tournamentFacets(@RequestParam(defaultValue = "ALL") TournamentLevel level,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/tournaments/parts")
    List<TournamentPart> tournamentParts(@RequestParam(required = false) UUID parentId,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/tournaments/{id}")
    View<Tournament> getTournament(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/tournaments")
    View<Tournament> createTournament(@RequestBody Create<Tournament> request);

    @PutMapping(ApiPaths.ADMIN + "/tournaments/{id}")
    View<Tournament> updateTournament(@PathVariable UUID id, @RequestBody Update<Tournament> request);

    @GetMapping(ApiPaths.ADMIN + "/competitions/page-stats")
    List<CompetitionPageEntry> competitionPageStats(HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/tournaments/stats")
    List<TournamentStats> tournamentStats(HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/series")
    PageSlice<View<Series>> series(@RequestParam(defaultValue = "") @Size(max = Parameters.MAX_SEARCH) String q,
            @RequestParam(required = false) UUID tournamentId,
            @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/series/{id}")
    View<Series> getSeries(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/series")
    View<Series> createSeries(@RequestBody Create<Series> request);

    @PutMapping(ApiPaths.ADMIN + "/series/{id}")
    View<Series> updateSeries(@PathVariable UUID id, @RequestBody Update<Series> request);

    @GetMapping(ApiPaths.ADMIN + "/games")
    PageSlice<View<Game>> games(@RequestParam(required = false) UUID seriesId,
            @RequestParam(required = false) UUID tournamentId,
            @RequestParam(defaultValue = "ACTIVE") RecordState state,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/games/{id}")
    View<Game> getGame(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/games")
    View<Game> createGame(@RequestBody Create<Game> request);

    @PutMapping(ApiPaths.ADMIN + "/games/{id}")
    View<Game> updateGame(@PathVariable UUID id, @RequestBody Update<Game> request);

    @PostMapping(ApiPaths.ADMIN + "/games/{id}/publish")
    View<Game> publishGame(@PathVariable UUID id, @RequestBody Version request);

    @PostMapping(ApiPaths.ADMIN + "/games/{id}/withdraw")
    View<Game> withdrawGame(@PathVariable UUID id, @RequestBody Version request);
}
