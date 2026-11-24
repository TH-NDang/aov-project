package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning.View;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = ApiPaths.ROOT)
public class CompetitionPlanningController implements CompetitionPlanningApi {
    private final CompetitionPlanning planning;

    public CompetitionPlanningController(CompetitionPlanning planning) {
        this.planning = planning;
    }

    @Override
    @GetMapping(path = "/competitions", version = "1")
    public PageSlice<View> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID playerId, @RequestParam(required = false) UUID organizerPageId,
            @RequestParam(required = false) UUID circuitPageId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("page", "size", "teamId", "playerId", "organizerPageId", "circuitPageId"));
        var filter = new CompetitionPlanning.PublishedFilter(teamId, playerId, organizerPageId, circuitPageId);
        return planning.published(filter, page, size);
    }

    @Override
    @GetMapping(path = "/admin/competitions", version = "1")
    public PageSlice<CompetitionPlanning.Summary> summaries(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(required = false) UUID organizerPageId,
            @RequestParam(required = false) UUID circuitPageId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("page", "size", "organizerPageId", "circuitPageId"));
        return planning.summaries(page, size, organizerPageId, circuitPageId);
    }

    @Override
    @GetMapping(path = "/competitions/{id}", version = "1")
    public View published(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return planning.published(id);
    }

    @Override
    @GetMapping(path = "/admin/competitions/{id}", version = "1")
    public View read(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return planning.read(id);
    }

    @Override
    @PutMapping(path = "/admin/competitions/{id}", version = "1")
    public View save(@PathVariable UUID id, @RequestBody Save body) {
        return planning.save(id, body.version(), body.content());
    }

    @Override
    @PostMapping(path = "/admin/competitions/preview", version = "1")
    public List<CompetitionPlan.Match> preview(@RequestBody Preview body) {
        return planning.preview(body.content(), body.stageCode(),
                new CompetitionPlanning.BracketOptions(body.teams(), Boolean.TRUE.equals(body.thirdPlace()),
                        body.opponent()));
    }

    @Override
    @GetMapping(path = "/admin/competitions/{id}/revisions", version = "1")
    public PageSlice<CompetitionPlanning.Revision> revisions(@PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return planning.revisions(id, page, size);
    }

    @Override
    @GetMapping(path = "/admin/competitions/{id}/revisions/{revisionId}", version = "1")
    public CompetitionPlan revision(@PathVariable UUID id, @PathVariable UUID revisionId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return planning.revision(id, revisionId);
    }

    @Override
    @PostMapping(path = "/admin/competitions/{id}/materialize", version = "1")
    public View materialize(@PathVariable UUID id, @RequestBody Version body) {
        return planning.materialize(id, body.version());
    }

    @Override
    @PostMapping(path = "/admin/competitions/{id}/publish", version = "1")
    public View publish(@PathVariable UUID id, @RequestBody Version body) {
        return planning.publish(id, body.version());
    }

    @Override
    @PostMapping(path = "/admin/competitions/{id}/withdraw", version = "1")
    public View withdraw(@PathVariable UUID id, @RequestBody Version body) {
        return planning.withdraw(id, body.version());
    }
}
