package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.PatchCommands.Assignment;
import com.wikiaov.patch.internal.application.PatchCommands.CreateRegion;
import com.wikiaov.patch.internal.application.PatchCommands.Patch;
import com.wikiaov.patch.internal.application.PatchCommands.Release;
import com.wikiaov.patch.internal.application.PatchCommands.Ruleset;
import com.wikiaov.patch.internal.application.PatchCommands.SeasonPatch;
import com.wikiaov.patch.internal.application.PatchCommands.Title;
import com.wikiaov.patch.internal.application.PatchCommands.Variant;
import com.wikiaov.patch.internal.application.response.PatchAdminViews;
import com.wikiaov.patch.internal.authoring.application.PatchAuthoring;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CreatedId;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN)
public class PatchAdminController implements PatchAdminApi {
    private final PatchAuthoring authoring;

    public PatchAdminController(PatchAuthoring authoring) {
        this.authoring = authoring;
    }

    @GetMapping(path = "/patches", version = "1")
    public com.wikiaov.platform.PageSlice<PatchAdminViews.Patch> catalog(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return authoring.catalog(page, size);
    }

    @GetMapping(path = "/regions/{id}/ruleset-assignments", version = "1")
    public List<PatchAdminViews.Assignment> assignments(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return authoring.assignments(id);
    }

    @PostMapping(path = "/regions", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId region(@RequestBody CreateRegion body) {
        return new CreatedId(authoring.region(body));
    }

    @PostMapping(path = "/rulesets", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId ruleset(@RequestBody Ruleset body) {
        return new CreatedId(authoring.ruleset(body));
    }

    @GetMapping(path = "/rulesets", version = "1")
    public List<PatchAdminViews.Ruleset> rulesets(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return authoring.rulesets();
    }

    @PostMapping(path = "/regions/{id}/ruleset-assignments", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId assignment(@PathVariable UUID id, @RequestBody Assignment body) {
        return new CreatedId(authoring.assign(id, body));
    }

    @PostMapping(path = "/patches", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId patch(@RequestBody Patch body) {
        return new CreatedId(authoring.patch(body));
    }

    @PutMapping(path = "/patches/{id}/title", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void title(@PathVariable UUID id, @RequestBody Title body) {
        authoring.rename(id, body);
    }

    @PostMapping(path = "/season-patches", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId seasonPatch(@RequestBody SeasonPatch body) {
        return new CreatedId(authoring.seasonPatch(body));
    }

    @PostMapping(path = "/patches/{id}/variants", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId variant(@PathVariable UUID id, @RequestBody Variant body) {
        return new CreatedId(authoring.variant(id, body));
    }

    @PostMapping(path = "/patch-variants/{id}/publish", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void publish(@PathVariable UUID id) {
        authoring.publish(id);
    }

    @PostMapping(path = "/patch-releases/{id}/confirm", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirm(@PathVariable UUID id) {
        authoring.confirmRelease(id);
    }

    @PostMapping(path = "/patch-variants/{id}/releases", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId release(@PathVariable UUID id, @RequestBody Release body) {
        return new CreatedId(authoring.release(id, body));
    }
}
