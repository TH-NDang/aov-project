package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentViews.BuildRoles;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Create;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Ranked;
import com.wikiaov.community.tournament.internal.application.TournamentViews.TournamentStats;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Update;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Version;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.CompetitionPageEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.PlayerEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.PlayerFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TeamEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TeamFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentPart;
import com.wikiaov.community.tournament.internal.directory.application.TournamentLevel;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.games.application.GamePatchScopes.PatchScope;
import com.wikiaov.community.tournament.internal.registry.application.PlayerMerge;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "tournament admin")
public interface TournamentAdminApi {
    @Operation(operationId = "tournamentAdminApi_me", summary = "Read the account's tournament capabilities")
    Map<String, Object> me();

    @Operation(operationId = "tournamentAdminApi_catalog", summary = "Read the game catalog for editors")
    Catalog catalog(String region, String locale, UUID seasonId, UUID patchVariantId, boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_teams", summary = "List teams")
    PageSlice<Ranked<Team>> teams(@Size(max = Parameters.MAX_SEARCH) String q, RecordState state, String sort,
            UUID tournamentId, @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_teamDirectory", summary = "List the team directory")
    PageSlice<TeamEntry> teamDirectory(@Size(max = Parameters.MAX_SEARCH) String q, String country, String sort,
            @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page, @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_getTeam", summary = "Read a team")
    View<Team> getTeam(UUID id);

    @Operation(operationId = "tournamentAdminApi_createTeam", summary = "Create a team")
    View<Team> createTeam(Create<Team> request);

    @Operation(operationId = "tournamentAdminApi_updateTeam", summary = "Change a team")
    View<Team> updateTeam(UUID id, Update<Team> request);

    @Operation(operationId = "tournamentAdminApi_players", summary = "List players")
    PageSlice<Ranked<Player>> players(@Size(max = Parameters.MAX_SEARCH) String q, RecordState state, String sort,
            UUID teamId, UUID tournamentId, @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_teamFacets", summary = "List what the team directory can be narrowed by")
    TeamFacets teamFacets(@Size(max = Parameters.MAX_SEARCH) String q,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_playerFacets", summary = "List what the player directory can be narrowed by")
    PlayerFacets playerFacets(@Size(max = Parameters.MAX_SEARCH) String q, String country, String lane, String status,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_playerDirectory", summary = "List the player directory")
    PageSlice<PlayerEntry> playerDirectory(@Size(max = Parameters.MAX_SEARCH) String q, String country, String lane,
            String status, String sort, @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_getPlayer", summary = "Read a player")
    View<Player> getPlayer(UUID id);

    @Operation(operationId = "tournamentAdminApi_createPlayer", summary = "Create a player")
    View<Player> createPlayer(Create<Player> request, boolean allowSameName,
            @Parameter(hidden = true) HttpServletRequest http);

    /** Moves the second profile of one person into {@code intoId} and puts it in the trash (spec 04). */
    record MergePlayer(
            Long version,
            UUID intoId,
            Long intoVersion
    ) {
    }

    @Operation(operationId = "tournamentAdminApi_mergePlayer", summary = "Merge a player into another")
    PlayerMerge.Result mergePlayer(UUID id, MergePlayer request);

    @Operation(operationId = "tournamentAdminApi_updatePlayer", summary = "Change a player")
    View<Player> updatePlayer(UUID id, Update<Player> request);

    @Operation(operationId = "tournamentAdminApi_tournaments", summary = "List tournaments")
    PageSlice<Ranked<Tournament>> tournaments(@Size(max = Parameters.MAX_SEARCH) String q, String alsoRegions,
            RecordState state, String status, String tier, String region, Integer year, String sort,
            TournamentLevel level, UUID teamId, UUID playerId, @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_tournamentFacets", summary = "List what tournaments can be narrowed by")
    TournamentFacets tournamentFacets(@Size(max = Parameters.MAX_SEARCH) String q, String alsoRegions, String status,
            String tier, String region, Integer year, TournamentLevel level,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_tournamentParts", summary = "List the parts of main events")
    List<TournamentPart> tournamentParts(UUID parentId, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_gamePatches", summary = "List the season and patch of each game", description = "A game naming its own season or patch keeps it (GAME); otherwise the patch line of its "
            + "stage in effect on the day it was played stands for it (STAGE), or none does (NONE).")
    List<PatchScope> gamePatches(UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_getTournament", summary = "Read a tournament")
    View<Tournament> getTournament(UUID id);

    @Operation(operationId = "tournamentAdminApi_createTournament", summary = "Create a tournament")
    View<Tournament> createTournament(Create<Tournament> request);

    @Operation(operationId = "tournamentAdminApi_updateTournament", summary = "Change a tournament")
    View<Tournament> updateTournament(UUID id, Update<Tournament> request);

    @Operation(operationId = "tournamentAdminApi_competitionPageStats", summary = "Count the seasons of organizer and circuit pages")
    List<CompetitionPageEntry> competitionPageStats(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_tournamentStats", summary = "Count the teams and matches of each tournament")
    List<TournamentStats> tournamentStats(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_series", summary = "List series")
    PageSlice<View<Series>> series(@Size(max = Parameters.MAX_SEARCH) String q, UUID tournamentId, RecordState state,
            @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page, @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_getSeries", summary = "Read a series")
    View<Series> getSeries(UUID id);

    @Operation(operationId = "tournamentAdminApi_createSeries", summary = "Create a series")
    View<Series> createSeries(Create<Series> request);

    @Operation(operationId = "tournamentAdminApi_updateSeries", summary = "Change a series")
    View<Series> updateSeries(UUID id, Update<Series> request);

    @Operation(operationId = "tournamentAdminApi_games", summary = "List games")
    PageSlice<View<Game>> games(UUID seriesId, UUID tournamentId, RecordState state,
            @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page, @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_getGame", summary = "Read a game")
    View<Game> getGame(UUID id);

    @Operation(operationId = "tournamentAdminApi_buildRoles", summary = "The role a new step of a build of a hero starts with, by item")
    BuildRoles buildRoles(UUID heroId, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentAdminApi_createGame", summary = "Create a game")
    View<Game> createGame(Create<Game> request);

    @Operation(operationId = "tournamentAdminApi_updateGame", summary = "Change a game")
    View<Game> updateGame(UUID id, Update<Game> request);

    @Operation(operationId = "tournamentAdminApi_publishGame", summary = "Publish a game")
    View<Game> publishGame(UUID id, Version request);

    @Operation(operationId = "tournamentAdminApi_withdrawGame", summary = "Withdraw a game")
    View<Game> withdrawGame(UUID id, Version request);
}
