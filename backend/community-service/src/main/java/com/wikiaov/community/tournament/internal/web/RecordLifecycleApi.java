package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.application.TournamentViews.Version;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Impact;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.State;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

@Tag(name = "record lifecycle")
public interface RecordLifecycleApi {
    @Operation(operationId = "recordLifecycleApi_impact", summary = "Read what keeps a record from being deleted")
    Impact impact(String kind, UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "recordLifecycleApi_delete", summary = "Move a record to the trash")
    State delete(String kind, UUID id, Version request);

    @Operation(operationId = "recordLifecycleApi_restore", summary = "Restore a record from the trash")
    State restore(String kind, UUID id, Version request);
}
