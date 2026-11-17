package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.importing.application.HeroImports;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = ApiPaths.ADMIN + "/heroes/import", version = "1")
public class HeroImportController implements HeroImportApi {
    private final HeroImports imports;

    public HeroImportController(HeroImports imports) {
        this.imports = imports;
    }

    @GetMapping("/fields")
    public List<HeroImports.Field> fields(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return imports.fields();
    }

    @PostMapping("/preview")
    public HeroImportPlan preview(@RequestBody HeroImportRequest request) {
        return imports.preview(request);
    }

    @GetMapping("/relation-fields")
    public java.util.Map<String, List<HeroImports.Field>> relationFields() {
        return imports.relationFields();
    }

    @GetMapping("/contexts")
    public List<com.wikiaov.patch.AuthoringContext> contexts(@RequestParam(required = false) java.util.UUID regionId,
            @RequestParam java.util.UUID seasonId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("regionId", "seasonId"));
        return imports.contexts(regionId, seasonId);
    }

    @PostMapping("/apply")
    public HeroImportPlan apply(@RequestBody HeroImportRequest request) {
        return imports.apply(request);
    }
}
