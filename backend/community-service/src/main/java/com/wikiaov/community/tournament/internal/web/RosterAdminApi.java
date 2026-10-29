package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RequestMapping(version = "1")
public interface RosterAdminApi {
    @GetMapping(ApiPaths.ADMIN + "/roster-memberships")
    PageSlice<View<RosterMembership>> memberships(@RequestParam(required = false) UUID tournamentId,
            @RequestParam(required = false) UUID teamId, @RequestParam(required = false) UUID playerId,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/roster-memberships/{id}")
    View<RosterMembership> getMembership(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/roster-memberships")
    View<RosterMembership> createMembership(@RequestBody Create<RosterMembership> request);

    @PutMapping(ApiPaths.ADMIN + "/roster-memberships/{id}")
    View<RosterMembership> updateMembership(@PathVariable UUID id, @RequestBody Update<RosterMembership> request);
}
