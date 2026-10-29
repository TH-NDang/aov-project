package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.roster.application.RosterAdministration;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RosterAdminController implements RosterAdminApi {
    private final RosterAdministration rosters;

    public RosterAdminController(RosterAdministration rosters) {
        this.rosters = rosters;
    }

    @Override
    public PageSlice<View<RosterMembership>> memberships(UUID tournamentId, UUID teamId, UUID playerId,
            RecordState state, int page,
            int size, HttpServletRequest request) {
        Parameters.only(request, "tournamentId", "teamId", "playerId", "state", "page", "size");
        return rosters.list(tournamentId, teamId, playerId, state, Parameters.page(page, size, "updatedAt"));
    }

    @Override
    public View<RosterMembership> getMembership(UUID id) {
        return rosters.get(id);
    }

    @Override
    public View<RosterMembership> createMembership(Create<RosterMembership> request) {
        return rosters.create(request.content());
    }

    @Override
    public View<RosterMembership> updateMembership(UUID id, Update<RosterMembership> request) {
        return rosters.update(id, request.version(), request.content());
    }
}
