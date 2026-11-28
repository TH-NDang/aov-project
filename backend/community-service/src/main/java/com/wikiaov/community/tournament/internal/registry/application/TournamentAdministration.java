package com.wikiaov.community.tournament.internal.registry.application;

import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.application.TournamentViews.BuildRoles;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Ranked;
import com.wikiaov.community.tournament.internal.application.TournamentViews.TournamentStats;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.catalog.application.WikiCatalog;
import com.wikiaov.community.tournament.internal.directory.application.CompetitionDirectory;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.CompetitionPageEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.PlayerEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.PlayerFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TeamEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TeamFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentPart;
import com.wikiaov.community.tournament.internal.directory.application.PlayerFilter;
import com.wikiaov.community.tournament.internal.directory.application.TournamentFilter;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.games.application.GamePatchScopes;
import com.wikiaov.community.tournament.internal.games.application.GamePatchScopes.PatchScope;
import com.wikiaov.community.tournament.internal.games.application.GamePatchScopes.Source;
import com.wikiaov.community.tournament.internal.games.application.GameRecords;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class TournamentAdministration {
    private final TeamRegistry teams;
    private final PlayerRegistry players;
    private final PlayerMerge merges;
    private final TournamentRegistry tournaments;
    private final SeriesRegistry series;
    private final GameRecords games;
    private final WikiCatalog catalog;
    private final CompetitionDirectory directory;
    private final GamePatchScopes patchScopes;
    private final TransactionTemplate reads;
    private final TransactionTemplate writes;

    public TournamentAdministration(TeamRegistry teams, PlayerRegistry players, PlayerMerge merges,
            TournamentRegistry tournaments,
            SeriesRegistry series, GameRecords games, WikiCatalog catalog, CompetitionDirectory directory,
            GamePatchScopes patchScopes, PlatformTransactionManager transactions) {
        this.teams = teams;
        this.players = players;
        this.merges = merges;
        this.tournaments = tournaments;
        this.series = series;
        this.games = games;
        this.catalog = catalog;
        this.directory = directory;
        this.patchScopes = patchScopes;
        this.reads = new TransactionTemplate(transactions);
        this.reads.setReadOnly(true);
        this.writes = new TransactionTemplate(transactions);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    public Map<String, Object> me() {
        return Map.of("capabilities", SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .map(Object::toString).filter(value -> value.startsWith("tournament:")).sorted().toList());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    public Catalog catalog(String region, String locale, UUID season, UUID patch, boolean unscoped) {
        return catalog.read(region, locale, season, patch, unscoped);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<TeamEntry> teamDirectory(String q, String country, String sort, Pageable page) {
        return directory.teams(q, country, sort, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public TeamFacets teamFacets(String q) {
        return directory.teamFacets(q);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<PlayerEntry> playerDirectory(PlayerFilter filter, Pageable page) {
        return directory.players(filter, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PlayerFacets playerFacets(PlayerFilter filter) {
        return directory.playerFacets(filter);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<CompetitionPageEntry> competitionPageStats() {
        return directory.competitionPages();
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Ranked<Team>> teams(String q, RecordState state, String sort, UUID tournamentId, Pageable page) {
        if (state != RecordState.ACTIVE || sort.equals("UPDATED")) {
            return Ranked.unranked(teams.list(q, state, page));
        }

        return directory.rankedTeams(q, sort, tournamentId, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Team> getTeam(UUID id) {
        return teams.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Team> createTeam(Team content) {
        return teams.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Team> updateTeam(UUID id, Long version, Team content) {
        return teams.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Ranked<Player>> players(String q, RecordState state, String sort, UUID teamId, UUID tournamentId,
            Pageable page) {
        if (state != RecordState.ACTIVE || sort.equals("UPDATED")) {
            return Ranked.unranked(players.list(q, state, page));
        }

        return directory.rankedPlayers(q, sort, teamId, tournamentId, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Player> getPlayer(UUID id) {
        return players.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Player> createPlayer(Player content, boolean allowSameName) {
        return players.create(content, actor(), allowSameName);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public PlayerMerge.Result mergePlayer(UUID id, Long version, UUID intoId, Long intoVersion) {
        return merges.merge(id, version, intoId, intoVersion, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Player> updatePlayer(UUID id, Long version, Player content) {
        return players.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Ranked<Tournament>> tournaments(TournamentFilter filter, RecordState state, Pageable page) {
        if (state != RecordState.ACTIVE) {
            return Ranked.unranked(tournaments.list(filter.q(), state, page));
        }

        return directory.rankedTournaments(filter, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public TournamentFacets tournamentFacets(TournamentFilter filter) {
        return directory.tournamentFacets(filter);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<TournamentPart> tournamentParts(UUID mainEventId) {
        return directory.tournamentParts(mainEventId);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<PatchScope> gamePatches(UUID tournamentId) {
        tournaments.get(tournamentId);
        return patchScopes.forTournament(tournamentId);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Tournament> getTournament(UUID id) {
        return tournaments.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Tournament> createTournament(Tournament content) {
        return tournaments.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Tournament> updateTournament(UUID id, Long version, Tournament content) {
        return tournaments.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<Series>> series(String q, UUID tournamentId, RecordState state, Pageable page) {
        return series.list(q, tournamentId, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<TournamentStats> tournamentStats() {
        return series.stats();
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Series> getSeries(UUID id) {
        return series.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Series> createSeries(Series content) {
        return series.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Series> updateSeries(UUID id, Long version, Series content) {
        return series.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<Game>> games(UUID seriesId, UUID tournamentId, RecordState state, Pageable page) {
        return games.list(seriesId, tournamentId, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Game> getGame(UUID id) {
        return games.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public BuildRoles buildRoles(UUID heroId) {
        return new BuildRoles(games.buildRoles(heroId));
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Game> createGame(Game content) {
        return games.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Game> updateGame(UUID id, Long version, Game content) {
        return games.update(id, version, content, actor());
    }

    /**
     * Reads the draft and publishes it in two short transactions, with the wiki references resolved between them, so
     * no transaction stays open during the wiki call.
     */
    @PreAuthorize("hasAuthority('tournament:publish')")
    public View<Game> publishGame(UUID id, Long version) {
        var draft = reads.execute(status -> games.get(id));
        TournamentErrors.version(draft.version(), version);
        var content = draft.content();
        var scope = reads.execute(status -> patchScopes.forGame(id, content));

        // A game without a patch of its own is published in the patch its stage was played on.
        var season = scope.source() == Source.STAGE ? scope.seasonId() : content.seasonId();
        var patch = scope.source() == Source.STAGE ? scope.patchId() : content.patchVariantId();
        var references = catalog.read(content.region() == null ? "VN" : content.region(),
                content.locale() == null ? "vi-VN" : content.locale(), season, patch, content.includeUnscoped());

        return writes.execute(status -> games.publish(id, version, references, actor()));
    }

    @PreAuthorize("hasAuthority('tournament:publish')")
    @Transactional
    public View<Game> withdrawGame(UUID id, Long version) {
        return games.withdraw(id, version, actor());
    }

    private static String actor() {
        return CommunityActor.editorKey();
    }
}
