package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.tournament.CompetitionIdentities;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
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

    @Override
    public Identity read(Kind kind, UUID id) {
        if (kind == Kind.TEAM) {
            var row = teams.get(id);
            if (row.deletedAt() != null) {
                throw TournamentErrors.invalid("Restore the team before linking it.");
            }
            var data = row.content();
            return new Identity(id, data.code(), data.name(), data.country(), data.logoUrl());
        }
        if (kind != Kind.PLAYER) {
            throw TournamentErrors.invalid("Unsupported identity kind.");
        }
        var row = players.get(id);
        if (row.deletedAt() != null) {
            throw TournamentErrors.invalid("Restore the player before linking it.");
        }
        var data = row.content();
        return new Identity(id, data.code(), data.nickname(), data.country(), data.photoUrl());
    }

    @Override
    public Identity create(Kind kind, String code, String name, String country, String imageUrl, String actor) {
        var id = kind == Kind.TEAM
                ? teams.create(new Team(code, name, null, country, imageUrl), actor).id()
                : players.create(new Player(code, name, null, country, imageUrl, null), actor).id();
        return read(kind, id);
    }

    @Override
    public void publish(Kind kind, UUID id, String name, String shortName, String country, String imageUrl,
            String actor) {
        if (kind == Kind.TEAM) {
            var row = teams.get(id);
            var previous = row.content();
            teams.update(id, row.version(),
                    new Team(previous.code(), name, shortName, country, imageUrl, previous.aliases()), actor);
        } else if (kind == Kind.PLAYER) {
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
