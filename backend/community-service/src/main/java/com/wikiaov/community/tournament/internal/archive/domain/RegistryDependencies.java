package com.wikiaov.community.tournament.internal.archive.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public final class RegistryDependencies {
    private RegistryDependencies() {
    }

    public record Parent(
            RegistryKind kind,
            UUID id
    ) {
    }

    public static List<Parent> of(Object content) {
        var parents = new ArrayList<Parent>();
        if (content instanceof Series series) {
            add(parents, RegistryKind.TOURNAMENT, series.tournamentId());
            add(parents, RegistryKind.TEAM, series.teamAId());
            add(parents, RegistryKind.TEAM, series.teamBId());
        } else if (content instanceof RosterMembership roster) {
            add(parents, RegistryKind.TOURNAMENT, roster.tournamentId());
            add(parents, RegistryKind.TEAM, roster.teamId());
            add(parents, RegistryKind.PLAYER, roster.playerId());
        } else if (content instanceof Game game) {
            add(parents, RegistryKind.SERIES, game.seriesId());
            for (var side : game.sides()) {
                add(parents, RegistryKind.TEAM, side.teamId());
                for (var player : side.participants())
                    add(parents, RegistryKind.PLAYER, player.playerId());
            }
        }
        return parents.stream().distinct().toList();
    }

    private static void add(List<Parent> parents, RegistryKind kind, UUID id) {
        if (id != null)
            parents.add(new Parent(kind, id));
    }
}
