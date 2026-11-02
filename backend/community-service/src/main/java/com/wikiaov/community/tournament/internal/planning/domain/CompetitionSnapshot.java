package com.wikiaov.community.tournament.internal.planning.domain;

import com.wikiaov.community.tournament.CompetitionOrganizations;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.util.*;

public record CompetitionSnapshot(
        Tournament tournament,
        CompetitionPlan plan,
        Map<UUID, Team> teams,
        Map<UUID, Player> players,
        Map<UUID, Series> series,
        List<RosterMembership> rosters,
        List<CompetitionResults.Resolved> resolved,
        List<CompetitionResults.Table> standings,
        CompetitionOrganizations.Organization organizer
) {
}
