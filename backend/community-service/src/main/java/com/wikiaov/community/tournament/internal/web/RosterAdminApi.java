package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Create;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Update;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;

@Tag(name = "roster admin")
public interface RosterAdminApi {
    @Operation(operationId = "rosterAdminApi_memberships", summary = "List roster memberships")
    PageSlice<View<RosterMembership>> memberships(UUID tournamentId, UUID teamId, UUID playerId, RecordState state,
            @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page, @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "rosterAdminApi_getMembership", summary = "Read a roster membership")
    View<RosterMembership> getMembership(UUID id);

    @Operation(operationId = "rosterAdminApi_createMembership", summary = "Create a roster membership")
    View<RosterMembership> createMembership(Create<RosterMembership> request);

    @Operation(operationId = "rosterAdminApi_updateMembership", summary = "Change a roster membership")
    View<RosterMembership> updateMembership(UUID id, Update<RosterMembership> request);
}
