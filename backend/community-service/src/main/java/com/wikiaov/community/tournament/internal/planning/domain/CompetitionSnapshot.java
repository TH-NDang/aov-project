package com.wikiaov.community.tournament.internal.planning.domain;

import com.wikiaov.community.tournament.CompetitionCircuits;
import com.wikiaov.community.tournament.CompetitionOrganizations;
import com.wikiaov.community.tournament.CompetitionPeople;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CompetitionSnapshot(
        Tournament tournament,
        CompetitionPlan plan,
        Map<UUID, Team> teams,
        Map<UUID, Player> players,
        Map<UUID, Series> series,
        List<RosterMembership> rosters,
        List<CompetitionResults.Resolved> resolved,
        List<CompetitionResults.Table> standings,
        CompetitionOrganizations.Organization organizer,
        CompetitionCircuits.Circuit circuit,
        Map<UUID, CompetitionPeople.Person> people
) {
    /** Snapshots taken before ADR-032 have no people; they read as none. */
    public CompetitionSnapshot {
        people = people == null ? Map.of() : Map.copyOf(people);
    }

    /** The same snapshot with what the circuit's page says now; a circuit without a page stays as it is. */
    public CompetitionSnapshot describedBy(Map<UUID, CompetitionCircuits.About> about) {
        var current = circuit == null ? null : about.get(circuit.id());
        if (current == null) {
            return this;
        }

        return new CompetitionSnapshot(tournament, plan, teams, players, series, rosters, resolved, standings,
                organizer, circuit.described(current), people);
    }
}
