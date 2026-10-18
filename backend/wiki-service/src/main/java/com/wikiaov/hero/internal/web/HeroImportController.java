package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.application.service.HeroImports;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Set;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = ApiPaths.ADMIN + "/heroes/import", version = "1")
@PreAuthorize("hasAuthority('hero:write')")
public class HeroImportController {
    private final HeroImports imports;

    public HeroImportController(HeroImports imports) {
        this.imports = imports;
    }

    @GetMapping("/fields")
    List<HeroImports.Field> fields(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return HeroImports.FIELDS;
    }

    @PostMapping("/preview")
    HeroImportPlan preview(@Valid @RequestBody HeroImportRequest request) {
        return imports.preview(request);
    }

    @GetMapping("/relation-fields")
    java.util.Map<String, List<HeroImports.Field>> relationFields() {
        return HeroImports.RELATION_FIELDS;
    }

    @GetMapping("/contexts")
    List<com.wikiaov.patch.AuthoringContext> contexts(@RequestParam(required = false) java.util.UUID regionId,
            @RequestParam java.util.UUID seasonId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("regionId", "seasonId"));
        return imports.contexts(regionId, seasonId);
    }

    @PostMapping("/apply")
    HeroImportPlan apply(@Valid @RequestBody HeroImportRequest request) {
        return imports.apply(request);
    }
}
