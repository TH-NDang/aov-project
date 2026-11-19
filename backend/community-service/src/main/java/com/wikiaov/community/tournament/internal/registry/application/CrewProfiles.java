package com.wikiaov.community.tournament.internal.registry.application;

import com.wikiaov.community.tournament.CompetitionPeople;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Checks that the broadcast and staff lines of tournaments and series name existing individual profile pages. */
@Component
public class CrewProfiles {
    private final CompetitionPeople people;

    public CrewProfiles(CompetitionPeople people) {
        this.people = people;
    }

    public void requireIndividuals(Set<UUID> pageIds) {
        if (pageIds.isEmpty()) {
            return;
        }
        if (!people.read(pageIds, false).keySet().containsAll(pageIds)) {
            throw TournamentErrors.invalid("broadcast and staff must name existing person or player pages.");
        }
    }
}
