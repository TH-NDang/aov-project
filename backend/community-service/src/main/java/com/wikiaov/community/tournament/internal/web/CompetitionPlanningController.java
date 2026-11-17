package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning.View;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = ApiPaths.ROOT, version = "1")
public class CompetitionPlanningController {
    public record Save(
            Long version,
            CompetitionPlan content
    ) {
    }

    public record Version(
            Long version
    ) {
    }

    public record Preview(
            CompetitionPlan content,
            String stageCode,
            int opponent
    ) {
    }

    private final CompetitionPlanning planning;

    public CompetitionPlanningController(CompetitionPlanning planning) {
        this.planning = planning;
    }

    @GetMapping("/competitions")
    public PageSlice<View> list(@RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "24") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID playerId, @RequestParam(required = false) UUID organizerPageId,
            @RequestParam(required = false) UUID circuitPageId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("page", "size", "teamId", "playerId", "organizerPageId", "circuitPageId"));
        return planning.published(page, size, teamId, playerId, organizerPageId, circuitPageId);
    }

    @GetMapping("/admin/competitions")
    public PageSlice<CompetitionPlanning.Summary> summaries(@RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "100") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @RequestParam(required = false) UUID organizerPageId,
            @RequestParam(required = false) UUID circuitPageId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("page", "size", "organizerPageId", "circuitPageId"));
        return planning.summaries(page, size, organizerPageId, circuitPageId);
    }

    @GetMapping("/competitions/{id}")
    public View published(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return planning.published(id);
    }

    @GetMapping("/admin/competitions/{id}")
    public View read(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return planning.read(id);
    }

    @PutMapping("/admin/competitions/{id}")
    public View save(@PathVariable UUID id, @RequestBody Save body) {
        return planning.save(id, body.version(), body.content());
    }

    @PostMapping("/admin/competitions/preview")
    public List<CompetitionPlan.Match> preview(@RequestBody Preview body) {
        return planning.preview(body.content(), body.stageCode(), body.opponent());
    }

    @PostMapping("/admin/competitions/{id}/materialize")
    public View materialize(@PathVariable UUID id, @RequestBody Version body) {
        return planning.materialize(id, body.version());
    }

    @PostMapping("/admin/competitions/{id}/publish")
    public View publish(@PathVariable UUID id, @RequestBody Version body) {
        return planning.publish(id, body.version());
    }

    @PostMapping("/admin/competitions/{id}/withdraw")
    public View withdraw(@PathVariable UUID id, @RequestBody Version body) {
        return planning.withdraw(id, body.version());
    }
}
