package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.tournament.CompetitionIdentities;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
class CompetitionIdentityCatalog implements CompetitionIdentities {
    private final TeamRegistry teams;
    private final PlayerRegistry players;

    CompetitionIdentityCatalog(TeamRegistry teams, PlayerRegistry players) {
        this.teams = teams;
        this.players = players;
    }

    public Identity read(String kind, UUID id) {
        if ("TEAM".equals(kind)) {
            var row = teams.get(id);
            if (row.deletedAt() != null)
                throw TournamentErrors.invalid("Restore the team before linking it.");
            var data = row.content();
            return new Identity(id, data.code(), data.name(), data.country(), data.logoUrl());
        }
        if (!"PLAYER".equals(kind))
            throw TournamentErrors.invalid("Unsupported identity kind.");
        var row = players.get(id);
        if (row.deletedAt() != null)
            throw TournamentErrors.invalid("Restore the player before linking it.");
        var data = row.content();
        return new Identity(id, data.code(), data.nickname(), data.country(), data.photoUrl());
    }

    public Identity create(String kind, String code, String name, String country, String imageUrl, String actor) {
        var id = "TEAM".equals(kind)
                ? teams.create(new Team(code, name, null, country, imageUrl), actor).id()
                : players.create(new Player(code, name, null, country, imageUrl, null), actor).id();
        return read(kind, id);
    }

    @Override
    public void publish(String kind, UUID id, String name, String shortName, String country, String imageUrl,
            String actor) {
        if ("TEAM".equals(kind)) {
            var row = teams.get(id);
            var previous = row.content();
            teams.update(id, row.version(),
                    new Team(previous.code(), name, shortName, country, imageUrl, previous.aliases()), actor);
        } else if ("PLAYER".equals(kind)) {
            var row = players.get(id);
            var previous = row.content();
            players.update(id, row.version(),
                    new Player(previous.code(), name, previous.fullName(), country, imageUrl, previous.aliases(),
                            previous.birthDate(), previous.lane(), previous.careerStatus(),
                            previous.signatureHeroes()),
                    actor);
        }
    }
}
