package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.application.TournamentViews.Version;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycles;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RecordLifecycleController implements RecordLifecycleApi {
    private final RecordLifecycles lifecycles;

    public RecordLifecycleController(RecordLifecycles lifecycles) {
        this.lifecycles = lifecycles;
    }

    @Override
    public Impact impact(String kind, UUID id, HttpServletRequest request) {
        Parameters.only(request);
        return lifecycles.impact(kind, id);
    }

    @Override
    public State delete(String kind, UUID id, Version request) {
        return lifecycles.mutate(kind, id, request.version(), Action.DELETE);
    }

    @Override
    public State restore(String kind, UUID id, Version request) {
        return lifecycles.mutate(kind, id, request.version(), Action.RESTORE);
    }
}
