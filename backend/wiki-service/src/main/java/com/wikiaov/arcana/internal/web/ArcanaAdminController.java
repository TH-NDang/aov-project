package com.wikiaov.arcana.internal.web;

import com.wikiaov.arcana.internal.application.ArcanaCommands.Create;
import com.wikiaov.arcana.internal.application.ArcanaCommands.Fork;
import com.wikiaov.arcana.internal.application.ArcanaCommands.Mutation;
import com.wikiaov.arcana.internal.application.ArcanaCommands.Update;
import com.wikiaov.arcana.internal.application.response.ArcanaView;
import com.wikiaov.arcana.internal.catalog.application.ArcanaCatalog;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
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
@RequestMapping(ApiPaths.ADMIN + "/arcana")
public class ArcanaAdminController implements ArcanaAdminApi {
    private final ArcanaCatalog catalog;

    public ArcanaAdminController(ArcanaCatalog catalog) {
        this.catalog = catalog;
    }

    @Override
    @GetMapping(version = "1")
    public PageSlice<ArcanaView> list(@RequestParam(required = false) UUID rulesetId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnchanged,
            @RequestParam(defaultValue = "false") boolean draftsOnly, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("rulesetId", "locale", "q", "page", "size", "seasonId", "patchVariantId", "includeUnchanged",
                        "draftsOnly"));
        if (draftsOnly) {
            if (rulesetId == null || seasonId != null || patchVariantId != null || includeUnchanged) {
                throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                        "Drafts require a ruleset and no timeline filter.");
            }
            return catalog.drafts(rulesetId, locale, q, page, size);
        }
        return catalog.list(rulesetId, locale, q, page, size, seasonId, patchVariantId, includeUnchanged);
    }

    @Override
    @GetMapping(path = "/{id}", version = "1")
    public ArcanaView latest(@PathVariable UUID id, @RequestParam(required = false) UUID rulesetId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId"));
        return catalog.latest(id, rulesetId);
    }

    @Override
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public ArcanaView create(@RequestBody Create input) {
        return catalog.create(input);
    }

    @Override
    @GetMapping(path = "/{id}/revisions", version = "1")
    public List<ArcanaView.Revision> history(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.history(id);
    }

    @Override
    @GetMapping(path = {"/{id}/revisions/{revisionId}", "/{id}/drafts/{revisionId}"}, version = "1")
    public ArcanaView read(@PathVariable UUID id, @PathVariable UUID revisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.read(id, revisionId);
    }

    @Override
    @PostMapping(path = "/{id}/drafts", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public ArcanaView fork(@PathVariable UUID id, @RequestBody Fork input) {
        return catalog.fork(id, input);
    }

    @Override
    @PutMapping(path = "/{id}/drafts/{revisionId}", version = "1")
    public ArcanaView update(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Update input) {
        return catalog.update(id, revisionId, input);
    }

    @Override
    @PostMapping(path = "/{id}/drafts/{revisionId}/publish", version = "1")
    public ArcanaView publish(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return catalog.publish(id, revisionId, input);
    }

    @Override
    @PostMapping(path = "/{id}/drafts/{revisionId}/discard", version = "1")
    public ArcanaView discard(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return catalog.discard(id, revisionId, input);
    }
}
