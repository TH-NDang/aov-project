package com.wikiaov.community.tournament.internal.registry.application;

import com.wikiaov.community.tournament.CompetitionTournaments;
import com.wikiaov.community.tournament.internal.registry.persistence.TournamentRecord;
import com.wikiaov.community.tournament.internal.registry.persistence.TournamentRepository;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class KnownTournaments implements CompetitionTournaments {
    private final TournamentRepository tournaments;

    KnownTournaments(TournamentRepository tournaments) {
        this.tournaments = tournaments;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> known(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Set.of();
        }
        return tournaments.findAllById(ids).stream().map(TournamentRecord::getId).collect(Collectors.toSet());
    }
}
