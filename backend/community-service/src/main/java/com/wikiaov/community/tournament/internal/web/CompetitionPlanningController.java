package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.tournament.internal.application.TournamentViews.PageSlice;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning.View;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
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
    public PageSlice<View> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size, @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID playerId, @RequestParam(required = false) UUID organizerPageId,
            jakarta.servlet.http.HttpServletRequest request) {
        Parameters.only(request, "page", "size", "teamId", "playerId", "organizerPageId");
        return planning.published(page, size, teamId, playerId, organizerPageId);
    }

    @GetMapping("/admin/competitions")
    public PageSlice<CompetitionPlanning.Summary> summaries(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        return planning.summaries(page, size);
    }

    @GetMapping("/competitions/{id}")
    public View published(@PathVariable UUID id) {
        return planning.published(id);
    }

    @GetMapping("/admin/competitions/{id}")
    public View read(@PathVariable UUID id) {
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
        return planning.publish(id, body.version(), true);
    }

    @PostMapping("/admin/competitions/{id}/withdraw")
    public View withdraw(@PathVariable UUID id, @RequestBody Version body) {
        return planning.publish(id, body.version(), false);
    }
}
