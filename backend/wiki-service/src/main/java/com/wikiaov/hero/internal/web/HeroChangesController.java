package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.HeroChangeEntry;
import com.wikiaov.hero.internal.application.response.HeroAssessmentView;
import com.wikiaov.hero.internal.application.response.HeroPatchView;
import com.wikiaov.hero.internal.change.application.HeroChangeEditCommand;
import com.wikiaov.hero.internal.change.application.HeroChangeOrderCommand;
import com.wikiaov.hero.internal.change.application.HeroPatchChanges;
import com.wikiaov.hero.internal.change.application.HeroPatchDerivation;
import com.wikiaov.hero.internal.domain.HeroChanges;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.CreatedId;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PublicResponses;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HeroChangesController implements HeroChangesApi {
    private final HeroPatchChanges changes;
    private final HeroPatchDerivation derivation;

    public HeroChangesController(HeroPatchChanges changes, HeroPatchDerivation derivation) {
        this.changes = changes;
        this.derivation = derivation;
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/patch-variants/{id}/hero-changes", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId record(@PathVariable UUID id,
            @RequestBody HeroChanges.Record body) {
        return new CreatedId(changes.record(id, body));
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/hero-changes/{id}/assessment", version = "1")
    public HeroAssessmentView assess(@PathVariable UUID id, @RequestBody HeroPatchChanges.AssessmentInput input) {
        return changes.assess(id, input);
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/hero-changes/{changeSetId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void edit(@PathVariable UUID changeSetId, @RequestBody HeroChangeEditCommand body) {
        changes.edit(changeSetId, body);
    }

    @Override
    @PutMapping(path = ApiPaths.ADMIN + "/patch-variants/{id}/hero-changes/order", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@PathVariable UUID id, @RequestBody HeroChangeOrderCommand body) {
        changes.reorder(id, body);
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/hero-changes/{changeSetId}/mechanics/{changeId}/previous", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId recordPrevious(@PathVariable UUID changeSetId, @PathVariable UUID changeId,
            @RequestBody HeroPatchChanges.PreviousInput input) {
        return new CreatedId(changes.recordPrevious(changeSetId, changeId, input));
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/patch-variants/{id}/hero-changes", version = "1")
    public List<HeroChangeEntry> authoringChanges(@PathVariable UUID id,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return changes.forAuthoringVariant(id, locale);
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/heroes/{heroId}/patch-view", version = "1")
    public HeroPatchView patchView(@PathVariable UUID heroId, @RequestParam UUID patchVariantId,
            @RequestParam(required = false) UUID anchorRevisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("patchVariantId", "anchorRevisionId"));
        return derivation.at(heroId, patchVariantId, anchorRevisionId);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/heroes/{heroId}/changes", version = "1")
    public ResponseEntity<PageSlice<HeroChangeEntry>> history(@PathVariable UUID heroId,
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return ResponseEntity.ok().cacheControl(PublicResponses.current())
                .body(changes.forHero(heroId, region, locale, page, size));
    }
}
