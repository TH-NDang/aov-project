package com.wikiaov.community.tournament.internal.archive.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
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
        if (content instanceof Tournament tournament) {
            add(parents, RegistryKind.TOURNAMENT, tournament.parentTournamentId());
            tournament.placements().forEach(line -> add(parents, RegistryKind.TEAM, line.teamId()));
            for (var award : tournament.awards()) {
                add(parents, RegistryKind.PLAYER, award.playerId());
                add(parents, RegistryKind.TEAM, award.teamId());
            }
            tournament.staff().forEach(member -> add(parents, RegistryKind.TEAM, member.teamId()));
        } else if (content instanceof Series series) {
            add(parents, RegistryKind.TOURNAMENT, series.tournamentId());
            add(parents, RegistryKind.TEAM, series.teamAId());
            add(parents, RegistryKind.TEAM, series.teamBId());
            add(parents, RegistryKind.PLAYER, series.mvpPlayerId());
        } else if (content instanceof RosterMembership roster) {
            add(parents, RegistryKind.TOURNAMENT, roster.tournamentId());
            add(parents, RegistryKind.TEAM, roster.teamId());
            add(parents, RegistryKind.PLAYER, roster.playerId());
        } else if (content instanceof Game game) {
            add(parents, RegistryKind.SERIES, game.seriesId());
            add(parents, RegistryKind.PLAYER, game.mvpPlayerId());
            for (var side : game.sides()) {
                add(parents, RegistryKind.TEAM, side.teamId());
                for (var player : side.participants()) {
                    add(parents, RegistryKind.PLAYER, player.playerId());
                }
            }
        }
        return parents.stream().distinct().toList();
    }

    private static void add(List<Parent> parents, RegistryKind kind, UUID id) {
        if (id != null) {
            parents.add(new Parent(kind, id));
        }
    }
}
