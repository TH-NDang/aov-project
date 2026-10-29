package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroPatchView;
import com.wikiaov.hero.internal.change.application.HeroPatchChanges;
import com.wikiaov.hero.internal.change.application.HeroPatchDerivation;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class HeroChangesController implements HeroChangesApi {
    private final HeroPatchChanges changes;
    private final HeroPatchDerivation derivation;

    public HeroChangesController(HeroPatchChanges changes, HeroPatchDerivation derivation) {
        this.changes = changes;
        this.derivation = derivation;
    }

    @PostMapping(path = "/admin/patch-variants/{id}/hero-changes", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> record(@PathVariable UUID id,
            @RequestBody com.wikiaov.hero.internal.domain.HeroChanges.Record body) {
        return Map.of("id", changes.record(id, body));
    }

    @PutMapping(path = "/admin/hero-changes/{id}/assessment", version = "1")
    public Map<String, Object> assess(@PathVariable UUID id, @RequestBody HeroPatchChanges.AssessmentInput input) {
        return changes.assess(id, input);
    }

    @GetMapping(path = "/admin/patch-variants/{id}/hero-changes", version = "1")
    public List<Map<String, Object>> authoringChanges(@PathVariable UUID id,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return changes.forAuthoringVariant(id, locale);
    }

    @GetMapping(path = "/admin/heroes/{heroId}/patch-view", version = "1")
    public HeroPatchView patchView(@PathVariable UUID heroId, @RequestParam UUID patchVariantId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("patchVariantId"));
        return derivation.at(heroId, patchVariantId);
    }

    @GetMapping(path = "/heroes/{heroId}/changes", version = "1")
    public ResponseEntity<?> history(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(changes.forHero(heroId, region, locale, page, size));
    }
}
