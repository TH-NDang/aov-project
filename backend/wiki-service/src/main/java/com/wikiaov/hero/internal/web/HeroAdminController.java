package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroCommands.*;
import com.wikiaov.hero.internal.application.response.HeroCatalogView;
import com.wikiaov.hero.internal.application.response.HeroComparisonView;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.application.service.HeroAuthoring;
import com.wikiaov.hero.internal.application.service.HeroCatalog;
import com.wikiaov.hero.internal.application.service.HeroComparisons;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.web.request.HeroSectionRequests.*;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes")
public class HeroAdminController {
    private final HeroAuthoring authoring;
    private final HeroComparisons comparisons;
    private final HeroCatalog catalog;
    public HeroAdminController(HeroAuthoring authoring, HeroComparisons comparisons, HeroCatalog catalog) {
        this.authoring = authoring;
        this.comparisons = comparisons;
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    PageSlice<HeroCatalogView> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(required = false) UUID rulesetId, @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(defaultValue = "code") String sort, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("page", "size", "q", "seasonId", "patchVariantId", "rulesetId", "locale", "sort"));
        return catalog.list(page, size, q, seasonId, patchVariantId, rulesetId, locale, sort);
    }

    @GetMapping(path = "/{heroId}", version = "1")
    Map<String, Object> status(@PathVariable UUID heroId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return Map.of("id", heroId, "revisions", authoring.revisions(heroId));
    }

    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    HeroRevisionView create(@Valid @RequestBody Create body) {
        return authoring.create(body);
    }

    @PostMapping(path = "/{heroId}/drafts", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    HeroRevisionView fork(@PathVariable UUID heroId, @Valid @RequestBody Fork body) {
        return authoring.fork(heroId, body);
    }

    @GetMapping(path = "/{heroId}/revisions", version = "1")
    List<HeroRevisionView> revisions(@PathVariable UUID heroId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return authoring.revisions(heroId);
    }

    @GetMapping(path = {"/{heroId}/revisions/{revisionId}", "/{heroId}/drafts/{revisionId}"}, version = "1")
    Map<String, Object> read(@PathVariable UUID heroId, @PathVariable UUID revisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return Map.of("revision", authoring.read(heroId, revisionId), "content", authoring.preview(heroId, revisionId));
    }

    @GetMapping(path = "/{heroId}/revisions/{revisionId}/comparison", version = "1")
    HeroComparisonView comparison(@PathVariable UUID heroId, @PathVariable UUID revisionId,
            @RequestParam(required = false) UUID fromRevisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("fromRevisionId"));
        return comparisons.compare(heroId, revisionId, fromRevisionId);
    }

    @PostMapping(path = "/{heroId}/drafts/{draftId}/publish", version = "1")
    HeroRevisionView publish(@PathVariable UUID heroId, @PathVariable UUID draftId, @Valid @RequestBody Mutation body) {
        return authoring.publish(heroId, draftId, body);
    }

    @PostMapping(path = "/{heroId}/drafts/{draftId}/baseline-context", version = "1")
    HeroRevisionView baselineContext(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @Valid @RequestBody BaselineContext body) {
        return authoring.baselineContext(heroId, draftId, body);
    }

    @PostMapping(path = "/{heroId}/drafts/{draftId}/discard", version = "1")
    HeroRevisionView discard(@PathVariable UUID heroId, @PathVariable UUID draftId, @Valid @RequestBody Mutation body) {
        return authoring.discard(heroId, draftId, body);
    }

    @PutMapping(path = "/{heroId}/drafts/{draftId}/profile", version = "1")
    HeroRevisionView updateProfile(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @Valid @RequestBody ProfileRequest body) {
        return authoring.update(heroId, draftId, HeroSection.PROFILE, body.expectedDraftVersion(), body.content(),
                body.changeNote());
    }

    @PutMapping(path = "/{heroId}/drafts/{draftId}/overview-ratings", version = "1")
    HeroRevisionView updateRatings(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @Valid @RequestBody RatingsRequest body) {
        return authoring.update(heroId, draftId, HeroSection.OVERVIEW_RATINGS, body.expectedDraftVersion(),
                body.content(), body.changeNote());
    }

    @PutMapping(path = "/{heroId}/drafts/{draftId}/combat-stats", version = "1")
    HeroRevisionView updateStats(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @Valid @RequestBody StatsRequest body) {
        return authoring.update(heroId, draftId, HeroSection.COMBAT_STATS, body.expectedDraftVersion(), body.content(),
                body.changeNote());
    }

    @PutMapping(path = "/{heroId}/drafts/{draftId}/skills", version = "1")
    HeroRevisionView updateSkills(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @Valid @RequestBody SkillsRequest body) {
        return authoring.update(heroId, draftId, HeroSection.SKILLS, body.expectedDraftVersion(), body.content(),
                body.changeNote());
    }

    @PutMapping(path = "/{heroId}/drafts/{draftId}/skins", version = "1")
    HeroRevisionView updateSkins(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @Valid @RequestBody SkinsRequest body) {
        return authoring.update(heroId, draftId, HeroSection.SKINS, body.expectedDraftVersion(), body.content(),
                body.changeNote());
    }

    @PutMapping(path = "/{heroId}/drafts/{draftId}/media-bindings", version = "1")
    HeroRevisionView updateBindings(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @Valid @RequestBody BindingsRequest body) {
        return authoring.update(heroId, draftId, HeroSection.MEDIA_BINDINGS, body.expectedDraftVersion(),
                body.content(), body.changeNote());
    }
}
