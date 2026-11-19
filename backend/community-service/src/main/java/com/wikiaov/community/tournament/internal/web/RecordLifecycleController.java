package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Version;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Action;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Impact;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.State;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycles;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = ApiPaths.ADMIN + "/{kind:teams|players|tournaments|series|roster-memberships|games}/{id}")
public class RecordLifecycleController implements RecordLifecycleApi {
    private final RecordLifecycles lifecycles;

    public RecordLifecycleController(RecordLifecycles lifecycles) {
        this.lifecycles = lifecycles;
    }

    @Override
    @GetMapping(path = "/deletion-impact", version = "1")
    public Impact impact(@PathVariable String kind, @PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return lifecycles.impact(kind, id);
    }

    @Override
    @PostMapping(path = "/delete", version = "1")
    public State delete(@PathVariable String kind, @PathVariable UUID id, @RequestBody Version request) {
        return lifecycles.mutate(kind, id, request.version(), Action.DELETE);
    }

    @Override
    @PostMapping(path = "/restore", version = "1")
    public State restore(@PathVariable String kind, @PathVariable UUID id, @RequestBody Version request) {
        return lifecycles.mutate(kind, id, request.version(), Action.RESTORE);
    }
}
