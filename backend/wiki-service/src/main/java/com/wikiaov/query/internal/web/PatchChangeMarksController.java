package com.wikiaov.query.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PublicResponses;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.query.internal.application.ChangedPatchVariants;
import com.wikiaov.query.internal.application.PatchChangedVariants;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping(ApiPaths.ROOT + "/patches")
public class PatchChangeMarksController implements PatchChangeMarksApi {
    private final ChangedPatchVariants changed;
    private final JsonMapper json;

    public PatchChangeMarksController(ChangedPatchVariants changed, JsonMapper json) {
        this.changed = changed;
        this.json = json;
    }

    @Override
    @GetMapping(path = "/changed-variants", version = "1")
    public ResponseEntity<PatchChangedVariants> changedVariants(@RequestParam(defaultValue = "VN") String region,
            @RequestParam String domain, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("region", "domain"));
        return PublicResponses.current(changed.read(region, domain), web, json);
    }
}
