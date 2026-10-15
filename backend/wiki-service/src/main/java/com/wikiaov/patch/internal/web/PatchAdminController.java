package com.wikiaov.patch.internal.web;
import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.application.service.PatchAuthoring;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ADMIN)
public class PatchAdminController {
    private final PatchAuthoring authoring;
    public PatchAdminController(PatchAuthoring authoring) {
        this.authoring = authoring;
    }
    @GetMapping(path = "/patches", version = "1")
    com.wikiaov.platform.PageSlice<Map<String, Object>> catalog(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return authoring.catalog(page, size);
    }
    @GetMapping(path = "/regions/{id}/ruleset-assignments", version = "1")
    List<Map<String, Object>> assignments(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return authoring.assignments(id);
    }
    @PostMapping(path = "/rulesets", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, UUID> ruleset(@Valid @RequestBody Ruleset body) {
        return Map.of("id", authoring.ruleset(body));
    }
    @GetMapping(path = "/rulesets", version = "1")
    List<Map<String, Object>> rulesets(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return authoring.rulesets();
    }
    @PostMapping(path = "/regions/{id}/ruleset-assignments", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, UUID> assignment(@PathVariable UUID id, @Valid @RequestBody Assignment body) {
        return Map.of("id", authoring.assign(id, body));
    }
    @PostMapping(path = "/patches", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, UUID> patch(@Valid @RequestBody Patch body) {
        return Map.of("id", authoring.patch(body));
    }
    @PostMapping(path = "/patches/{id}/variants", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, UUID> variant(@PathVariable UUID id, @Valid @RequestBody Variant body) {
        return Map.of("id", authoring.variant(id, body));
    }
    @PostMapping(path = "/patch-variants/{id}/publish", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void publish(@PathVariable UUID id) {
        authoring.publish(id);
    }
    @PostMapping(path = "/patch-variants/{id}/releases", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, UUID> release(@PathVariable UUID id, @Valid @RequestBody Release body) {
        return Map.of("id", authoring.release(id, body));
    }
}
