package com.wikiaov.community.tournament.internal.archive.application;

import com.wikiaov.community.tournament.internal.application.*;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.roster.application.RosterAdministration;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

@Service
public class RecordLifecycles {
    private final TeamRegistry teams;
    private final PlayerRegistry players;
    private final TournamentRegistry tournaments;
    private final SeriesRegistry series;
    private final GameRecords games;
    private final RosterAdministration rosters;

    public RecordLifecycles(TeamRegistry teams, PlayerRegistry players, TournamentRegistry tournaments,
            SeriesRegistry series, GameRecords games, RosterAdministration rosters) {
        this.teams = teams;
        this.players = players;
        this.tournaments = tournaments;
        this.series = series;
        this.games = games;
        this.rosters = rosters;
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    public Impact impact(String kind, UUID id) {
        return switch (kind) {
            case "teams" -> teams.deletionImpact(id);
            case "players" -> players.deletionImpact(id);
            case "tournaments" -> tournaments.deletionImpact(id);
            case "series" -> series.deletionImpact(id);
            case "games" -> games.deletionImpact(id);
            case "roster-memberships" -> rosters.deletionImpact(id);
            default -> throw TournamentErrors.invalid("Unsupported registry kind.");
        };
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    public State mutate(String kind, UUID id, Long version, Action action) {
        var auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        String actor = auth.getToken().getIssuer() + "|" + auth.getToken().getSubject();
        return switch (kind) {
            case "teams" -> teams.lifecycle(id, version, action, actor);
            case "players" -> players.lifecycle(id, version, action, actor);
            case "tournaments" -> tournaments.lifecycle(id, version, action, actor);
            case "series" -> series.lifecycle(id, version, action, actor);
            case "games" -> games.lifecycle(id, version, action, actor);
            case "roster-memberships" -> rosters.lifecycle(id, version, action, actor);
            default -> throw TournamentErrors.invalid("Unsupported registry kind.");
        };
    }
}
