package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.importing.application.HeroImports;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/import")
public class HeroImportController implements HeroImportApi {
    private final HeroImports imports;

    public HeroImportController(HeroImports imports) {
        this.imports = imports;
    }

    @GetMapping(path = "/fields", version = "1")
    public List<HeroImports.Field> fields(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return imports.fields();
    }

    @PostMapping(path = "/preview", version = "1")
    public HeroImportPlan preview(@RequestBody HeroImportRequest request) {
        return imports.preview(request);
    }

    @GetMapping(path = "/relation-fields", version = "1")
    public java.util.Map<String, List<HeroImports.Field>> relationFields(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return imports.relationFields();
    }

    @GetMapping(path = "/contexts", version = "1")
    public List<com.wikiaov.patch.AuthoringContext> contexts(@RequestParam(required = false) java.util.UUID regionId,
            @RequestParam java.util.UUID seasonId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("regionId", "seasonId"));
        return imports.contexts(regionId, seasonId);
    }

    @PostMapping(path = "/apply", version = "1")
    public HeroImportPlan apply(@RequestBody HeroImportRequest request) {
        return imports.apply(request);
    }
}
