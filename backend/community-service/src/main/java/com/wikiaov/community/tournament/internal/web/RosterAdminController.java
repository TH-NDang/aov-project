package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Create;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Update;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.domain.RosterContent.RosterMembership;
import com.wikiaov.community.tournament.internal.roster.application.RosterAdministration;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RosterAdminController implements RosterAdminApi {
    private final RosterAdministration rosters;

    public RosterAdminController(RosterAdministration rosters) {
        this.rosters = rosters;
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/roster-memberships", version = "1")
    public PageSlice<View<RosterMembership>> memberships(@RequestParam(required = false) UUID tournamentId,
            @RequestParam(required = false) UUID teamId, @RequestParam(required = false) UUID playerId,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("tournamentId", "teamId", "playerId", "state", "page", "size"));
        return rosters.list(tournamentId, teamId, playerId, state, Parameters.pageable(page, size, "updatedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/roster-memberships/{id}", version = "1")
    public View<RosterMembership> getMembership(@PathVariable UUID id) {
        return rosters.get(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/roster-memberships", version = "1")
    public View<RosterMembership> createMembership(@RequestBody Create<RosterMembership> request) {
        return rosters.create(request.content());
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/roster-memberships/{id}", version = "1")
    public View<RosterMembership> updateMembership(@PathVariable UUID id,
            @RequestBody Update<RosterMembership> request) {
        return rosters.update(id, request.version(), request.content());
    }
}
