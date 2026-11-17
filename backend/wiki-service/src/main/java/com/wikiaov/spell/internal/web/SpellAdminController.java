package com.wikiaov.spell.internal.web;

import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.spell.internal.application.SpellCommands.Create;
import com.wikiaov.spell.internal.application.SpellCommands.Fork;
import com.wikiaov.spell.internal.application.SpellCommands.Mutation;
import com.wikiaov.spell.internal.application.SpellCommands.Removal;
import com.wikiaov.spell.internal.application.SpellCommands.Update;
import com.wikiaov.spell.internal.application.response.SpellRemovalView;
import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
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
@RequestMapping(ApiPaths.ADMIN + "/spells")
public class SpellAdminController implements SpellAdminApi {
    private final SpellCatalog catalog;

    public SpellAdminController(SpellCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public PageSlice<SpellView> list(@RequestParam(required = false) UUID rulesetId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnchanged,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            @RequestParam(defaultValue = "false") boolean draftsOnly, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("rulesetId", "locale", "q", "page", "size", "seasonId", "patchVariantId", "includeUnchanged",
                        "draftsOnly", "includeUnscoped"));
        if (includeUnscoped && (!includeUnchanged || rulesetId == null || seasonId == null && patchVariantId == null)) {
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "Unscoped observations require a ruleset and an all-entries timeline filter.");
        }
        if (draftsOnly) {
            if (rulesetId == null || seasonId != null || patchVariantId != null || includeUnchanged) {
                throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                        "Drafts require a ruleset and no timeline filter.");
            }
            return catalog.drafts(rulesetId, locale, q, page, size);
        }
        return catalog.list(rulesetId, locale, q, page, size, seasonId, patchVariantId, includeUnchanged,
                includeUnscoped);
    }

    @GetMapping(path = "/{id}", version = "1")
    public SpellView latest(@PathVariable UUID id, @RequestParam(required = false) UUID rulesetId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId"));
        return catalog.latest(id, rulesetId);
    }

    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public SpellView create(@RequestBody Create input) {
        return catalog.create(input);
    }

    @GetMapping(path = "/{id}/revisions", version = "1")
    public List<SpellView.Revision> history(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.history(id);
    }

    @GetMapping(path = {"/{id}/revisions/{revisionId}", "/{id}/drafts/{revisionId}"}, version = "1")
    public SpellView read(@PathVariable UUID id, @PathVariable UUID revisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.read(id, revisionId);
    }

    @PostMapping(path = "/{id}/drafts", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public SpellView fork(@PathVariable UUID id, @RequestBody Fork input) {
        return catalog.fork(id, input);
    }

    @PutMapping(path = "/{id}/drafts/{revisionId}", version = "1")
    public SpellView update(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Update input) {
        return catalog.update(id, revisionId, input);
    }

    @PostMapping(path = "/{id}/drafts/{revisionId}/publish", version = "1")
    public SpellView publish(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return catalog.publish(id, revisionId, input);
    }

    @PostMapping(path = "/{id}/drafts/{revisionId}/discard", version = "1")
    public SpellView discard(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return catalog.discard(id, revisionId, input);
    }

    @GetMapping(path = "/{id}/removals", version = "1")
    public List<SpellRemovalView> removals(@PathVariable UUID id, @RequestParam UUID rulesetId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId"));
        return catalog.removals(id, rulesetId);
    }

    @PostMapping(path = "/{id}/removals", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public SpellRemovalView recordRemoval(@PathVariable UUID id, @RequestBody Removal input) {
        return catalog.recordRemoval(id, input);
    }
}
