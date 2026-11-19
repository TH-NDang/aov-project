package com.wikiaov.community.tournament.internal.directory.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.PlatformErrorCode;
import com.wikiaov.community.tournament.internal.application.TournamentViews;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Ranked;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.CompetitionPageEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.LineupMember;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.PlayerEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TeamEntry;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TeamRef;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentFacets;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentPart;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.TournamentRef;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryListings;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryListings.CompetitionPageRow;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryListings.FacetRow;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryListings.LineupRow;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryListings.PlayerRow;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryListings.RankedRow;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryListings.TeamRow;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.CareerStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentTier;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerRecord;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerRepository;
import com.wikiaov.community.tournament.internal.registry.persistence.TeamRecord;
import com.wikiaov.community.tournament.internal.registry.persistence.TeamRepository;
import com.wikiaov.community.tournament.internal.registry.persistence.TournamentRecord;
import com.wikiaov.community.tournament.internal.registry.persistence.TournamentRepository;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * Read model behind the admin directories. The ranked page of ids comes from {@link DirectoryListings}; the typed
 * records are then loaded by id, so documents are parsed in one place and only for the rows on screen.
 */
@Service
public class CompetitionDirectory {
    private static final Set<String> TEAM_SORTS = Set.of("RECENT", "TOURNAMENTS", "TITLES", "PRIZE", "NAME");
    private static final Set<String> PLAYER_SORTS = Set.of("RECENT", "TOURNAMENTS", "TITLES", "NAME");
    private static final Set<String> RECORD_SORTS = Set.of("RECENT", "NAME");
    private static final Set<String> TOURNAMENT_SORTS = Set.of("RECENT", "STATUS", "NAME", "UPDATED");
    private static final int LINEUP_LIMIT = 7;

    private final DirectoryListings directory;
    private final TeamRepository teams;
    private final PlayerRepository players;
    private final TournamentRepository tournaments;

    public CompetitionDirectory(DirectoryListings directory, TeamRepository teams, PlayerRepository players,
            TournamentRepository tournaments) {
        this.directory = directory;
        this.teams = teams;
        this.players = players;
        this.tournaments = tournaments;
    }

    public PageSlice<PlayerEntry> players(PlayerFilter filter, Pageable page) {
        requireOneOf("sort", filter.sort(), PLAYER_SORTS);
        requireEnum("lane", filter.lane(), Lane.class);
        requireEnum("status", filter.status(), CareerStatus.class);

        var rows = directory.players(ReferenceLabels.literalSearch(filter.q()), filter.q(), filter.country(),
                filter.lane(), filter.status(), filter.sort(), unsorted(page));
        var people = byId(players.findAllById(rows.map(PlayerRow::id).toList()), PlayerRecord::getId);
        var latestTeams = byId(teams.findAllById(rows.map(PlayerRow::teamId).filter(Objects::nonNull).toSet()),
                TeamRecord::getId);
        var latest = byId(
                tournaments.findAllById(rows.map(PlayerRow::tournamentId).filter(Objects::nonNull).toSet()),
                TournamentRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var content = people.get(row.id()).getContent();
            return new PlayerEntry(row.id(), content.code(), content.nickname(), content.fullName(),
                    content.country(), content.photoUrl(), content.birthDate(), parseLane(row.lane()),
                    content.careerStatus(), content.signatureHeroes(), row.tournaments(), row.titles(),
                    teamRef(latestTeams.get(row.teamId())), tournamentRef(latest.get(row.tournamentId())),
                    row.lastActiveOn());
        }));
    }

    public PageSlice<TeamEntry> teams(String q, String country, String sort, Pageable page) {
        requireOneOf("sort", sort, TEAM_SORTS);

        var rows = directory.teams(ReferenceLabels.literalSearch(q), q, country, sort, unsorted(page));
        var records = byId(teams.findAllById(rows.map(TeamRow::id).toList()), TeamRecord::getId);
        var latest = byId(tournaments.findAllById(rows.map(TeamRow::tournamentId).filter(Objects::nonNull).toSet()),
                TournamentRecord::getId);
        var lineups = lineups(rows.map(TeamRow::id).toList());

        return PageSlice.from(rows.map(row -> {
            var content = records.get(row.id()).getContent();
            var lineup = lineups.get(row.id());
            return new TeamEntry(row.id(), content.code(), content.name(), content.shortName(), content.country(),
                    content.logoUrl(), row.tournaments(), row.matches(), row.wins(), row.losses(),
                    row.titles(), row.prizeUsd(), tournamentRef(latest.get(row.tournamentId())),
                    lineup == null ? List.of() : lineup.members(), lineup == null ? null : lineup.tournament(),
                    row.lastActiveOn());
        }));
    }

    public PageSlice<Ranked<Team>> rankedTeams(String q, String sort, UUID tournamentId, Pageable page) {
        requireOneOf("sort", sort, RECORD_SORTS);

        var rows = directory.rankedTeams(ReferenceLabels.literalSearch(q), q, sort, text(tournamentId), unsorted(page));
        var records = byId(teams.findAllById(rows.map(RankedRow::id).toList()), TeamRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var record = records.get(row.id());
            return new Ranked<>(TournamentViews.view(record, record.getContent()), row.lastActiveOn(),
                    row.context());
        }));
    }

    public PageSlice<Ranked<Player>> rankedPlayers(String q, String sort, UUID teamId, UUID tournamentId,
            Pageable page) {
        requireOneOf("sort", sort, RECORD_SORTS);

        var rows = directory.rankedPlayers(ReferenceLabels.literalSearch(q), q, sort, text(teamId), text(tournamentId),
                unsorted(page));
        var records = byId(players.findAllById(rows.map(RankedRow::id).toList()), PlayerRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var record = records.get(row.id());
            return new Ranked<>(TournamentViews.view(record, record.getContent()), row.lastActiveOn(),
                    row.context());
        }));
    }

    public PageSlice<Ranked<Tournament>> rankedTournaments(TournamentFilter filter, Pageable page) {
        requireOneOf("sort", filter.sort(), TOURNAMENT_SORTS);
        requireEnum("status", filter.status(), TournamentStatus.class);
        requireEnum("tier", filter.tier(), TournamentTier.class);

        var rows = directory.rankedTournaments(filter.q(), filter.alsoRegions(), filter.status(), filter.tier(),
                filter.region(), filter.year() == null ? "" : filter.year().toString(), filter.sort(),
                filter.level().mainEventsOnly(), text(filter.teamId()), text(filter.playerId()), unsorted(page));
        var records = byId(tournaments.findAllById(rows.map(RankedRow::id).toList()), TournamentRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var record = records.get(row.id());
            return new Ranked<>(TournamentViews.view(record, record.getContent()), null, row.context());
        }));
    }

    /** The parts of one main event, or every part when no main event is named. */
    public List<TournamentPart> tournamentParts(UUID mainEventId) {
        var ids = directory.tournamentParts(text(mainEventId));
        var records = byId(tournaments.findAllById(ids), TournamentRecord::getId);

        return ids.stream().map(records::get).map(row -> {
            var part = row.getContent();
            return new TournamentPart(row.getId(), part.parentTournamentId(), part.name(), part.logoUrl(),
                    part.competitionType(), part.status(), part.tier(), part.region(), part.startsOn(), part.endsOn());
        }).toList();
    }

    public TournamentFacets tournamentFacets(TournamentLevel level) {
        var rows = directory.tournamentFacets(level.mainEventsOnly());
        var statuses = rows.stream().filter(row -> row.facet().equals("STATUS"))
                .collect(Collectors.toMap(FacetRow::value, FacetRow::rows));
        var regions = rows.stream().filter(row -> row.facet().equals("REGION")).map(FacetRow::value).sorted()
                .toList();
        var years = rows.stream().filter(row -> row.facet().equals("YEAR"))
                .map(row -> Integer.valueOf(row.value())).sorted(Comparator.reverseOrder()).toList();

        return new TournamentFacets(statuses.values().stream().mapToLong(Long::longValue).sum(), statuses, regions,
                years);
    }

    public List<CompetitionPageEntry> competitionPages() {
        var rows = directory.competitionPages();
        var latest = byId(
                tournaments.findAllById(rows.stream().map(CompetitionPageRow::latestTournamentId).toList()),
                TournamentRecord::getId);

        return rows.stream().map(row -> new CompetitionPageEntry(row.pageId(), row.tournaments(),
                row.firstYear(), row.lastYear(), parseTiers(row.tiers()),
                tournamentRef(latest.get(row.latestTournamentId())))).toList();
    }

    /** The most recent roster each team has on record; its latest tournament may have none entered yet. */
    private Map<UUID, Lineup> lineups(List<UUID> teamIds) {
        if (teamIds.isEmpty()) {
            return Map.of();
        }

        var teamList = teamIds.stream().map(UUID::toString).collect(Collectors.joining(","));
        var current = directory.lineups(teamList).stream()
                .filter(line -> parseStatus(line.status()) != RosterStatus.INACTIVE)
                .collect(Collectors.groupingBy(LineupRow::teamId));
        var latestLines = current.values().stream().map(CompetitionDirectory::latestTournamentLines).toList();
        var people = byId(players.findAllById(latestLines.stream().flatMap(List::stream)
                .map(LineupRow::playerId).collect(Collectors.toSet())), PlayerRecord::getId);
        var shown = byId(tournaments.findAllById(latestLines.stream()
                .map(lines -> lines.getFirst().tournamentId()).collect(Collectors.toSet())),
                TournamentRecord::getId);

        return latestLines.stream().collect(Collectors.toMap(lines -> lines.getFirst().teamId(), lines -> {
            var members = lines.stream().map(line -> member(line, people.get(line.playerId()).getContent()))
                    .sorted(LINEUP_ORDER).limit(LINEUP_LIMIT).toList();
            return new Lineup(members, tournamentRef(shown.get(lines.getFirst().tournamentId())));
        }));
    }

    private static List<LineupRow> latestTournamentLines(List<LineupRow> lines) {
        var latest = lines.stream().max(Comparator.comparingInt(LineupRow::day)
                .thenComparing(LineupRow::tournamentId)).orElseThrow();
        return lines.stream().filter(line -> line.tournamentId().equals(latest.tournamentId())).toList();
    }

    private static LineupMember member(LineupRow line, Player player) {
        var lane = line.lane() == null ? player.lane() : parseLane(line.lane());
        return new LineupMember(line.playerId(), player.nickname(), player.photoUrl(), lane,
                parseStatus(line.status()));
    }

    private record Lineup(
            List<LineupMember> members,
            TournamentRef tournament
    ) {
    }

    private static final Comparator<LineupMember> LINEUP_ORDER = Comparator
            .comparing((LineupMember member) -> member.status() == RosterStatus.SUBSTITUTE)
            .thenComparing(LineupMember::lane, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(LineupMember::name, String.CASE_INSENSITIVE_ORDER);

    private static String text(UUID id) {
        return id == null ? "" : id.toString();
    }

    private static Pageable unsorted(Pageable page) {
        return PageRequest.of(page.getPageNumber(), page.getPageSize());
    }

    private static <T> Map<UUID, T> byId(List<T> rows, Function<T, UUID> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }

    private static TeamRef teamRef(TeamRecord row) {
        if (row == null) {
            return null;
        }

        var team = row.getContent();
        return new TeamRef(row.getId(), team.name(), team.shortName(), team.logoUrl());
    }

    private static TournamentRef tournamentRef(TournamentRecord row) {
        if (row == null) {
            return null;
        }

        var tournament = row.getContent();
        return new TournamentRef(row.getId(), tournament.name(), tournament.logoUrl(), tournament.tier(),
                tournament.year(), tournament.startsOn(), tournament.endsOn());
    }

    private static Lane parseLane(String value) {
        return value == null ? null : Lane.valueOf(value);
    }

    private static RosterStatus parseStatus(String value) {
        return value == null ? RosterStatus.UNKNOWN : RosterStatus.valueOf(value);
    }

    private static List<TournamentTier> parseTiers(String tiers) {
        if (tiers == null) {
            return List.of();
        }

        return Arrays.stream(tiers.split(",")).map(TournamentTier::valueOf).sorted().toList();
    }

    private static void requireOneOf(String name, String value, Set<String> allowed) {
        if (!allowed.contains(value)) {
            throw unsupported(name, value);
        }
    }

    private static <E extends Enum<E>> void requireEnum(String name, String value, Class<E> type) {
        if (value.isEmpty()) {
            return;
        }

        try {
            Enum.valueOf(type, value);
        } catch (IllegalArgumentException invalid) {
            throw unsupported(name, value);
        }
    }

    /** A list option the client sent that the list does not have is a bad query parameter, not bad content. */
    private static ApiException unsupported(String name, String value) {
        return new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Unsupported " + name + ": " + value);
    }
}
