package com.wikiaov.community.tournament.internal.planning.application;

import com.wikiaov.community.tournament.CompetitionCircuits;
import com.wikiaov.community.tournament.CompetitionOrganizations;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.persistence.PlayerRepository;
import com.wikiaov.community.tournament.internal.persistence.SeriesRepository;
import com.wikiaov.community.tournament.internal.persistence.TeamRepository;
import com.wikiaov.community.tournament.internal.persistence.TournamentRepository;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionResults;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionSnapshot;
import com.wikiaov.community.tournament.internal.roster.persistence.RosterRepository;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

@Component
public class CompetitionInputs {
    private final TournamentRepository tournaments;
    private final TeamRepository teams;
    private final PlayerRepository players;
    private final SeriesRepository series;
    private final RosterRepository rosters;
    private final CompetitionOrganizations organizations;
    private final CompetitionCircuits circuits;

    public CompetitionInputs(TournamentRepository tournaments, TeamRepository teams, PlayerRepository players,
            SeriesRepository series, RosterRepository rosters, CompetitionOrganizations organizations,
            CompetitionCircuits circuits) {
        this.tournaments = tournaments;
        this.teams = teams;
        this.players = players;
        this.series = series;
        this.rosters = rosters;
        this.organizations = organizations;
        this.circuits = circuits;
    }

    public CompetitionSnapshot snapshot(UUID id, CompetitionPlan plan) {
        return snapshot(id, plan, false);
    }

    public Map<UUID, Tournament> tournamentDetails(Collection<UUID> ids) {
        var details = new LinkedHashMap<UUID, Tournament>();
        tournaments.findAllById(ids).forEach(row -> details.put(row.getId(), row.getContent()));
        return details;
    }

    public CompetitionSnapshot snapshot(UUID id, CompetitionPlan plan, boolean publishedOrganization) {
        CompetitionOrganizations.Organization organizer = null;
        if (plan.organizerPageId() != null) {
            try {
                organizer = organizations.read(plan.organizerPageId(), publishedOrganization);
            } catch (IllegalArgumentException error) {
                throw TournamentErrors.invalid(error.getMessage());
            }
        }
        var resolvedPlan = organizer == null ? plan : plan.organizedBy(organizer.name());
        CompetitionCircuits.Circuit circuit = null;
        if (plan.circuitPageId() != null) {
            try {
                circuit = circuits.read(plan.circuitPageId(), publishedOrganization);
            } catch (IllegalArgumentException error) {
                throw TournamentErrors.invalid(error.getMessage());
            }
            resolvedPlan = resolvedPlan.inCircuit(circuit.name());
        }

        var tournament = tournaments.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(tournament);
        var teamMap = new LinkedHashMap<UUID, Team>();
        for (var entry : plan.entrants()) {
            var row = teams.findById(entry.teamId()).orElseThrow(TournamentErrors::missing);
            RegistryArchivePolicy.requireActive(row);
            teamMap.put(row.getId(), row.getContent());
        }
        var seriesMap = new LinkedHashMap<UUID, Series>();
        for (var match : plan.matches()) {
            if (match.seriesId() == null) {
                continue;
            }
            var row = series.findById(match.seriesId()).orElseThrow(TournamentErrors::missing);
            RegistryArchivePolicy.requireActive(row);
            if (!id.equals(row.getContent().tournamentId())) {
                throw TournamentErrors.invalid("Series belongs to another competition.");
            }
            seriesMap.put(row.getId(), row.getContent());
        }
        var members = rosters.search(id, null, null, "ACTIVE", Pageable.unpaged()).stream()
                .map(row -> row.getContent()).filter(row -> teamMap.containsKey(row.teamId())).toList();
        var playerMap = new LinkedHashMap<UUID, Player>();
        players.findAllById(members.stream().map(RosterMembership::playerId).distinct().toList())
                .forEach(row -> playerMap.put(row.getId(), row.getContent()));
        var resolved = CompetitionResults.resolve(plan, seriesMap);
        return new CompetitionSnapshot(tournament.getContent(), resolvedPlan, teamMap, playerMap, seriesMap, members,
                resolved, CompetitionResults.tables(plan, resolved), organizer, circuit);
    }
}
