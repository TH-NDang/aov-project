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
}
