package com.wikiaov.item.internal.web;
import com.wikiaov.item.internal.application.ItemCommands.*;
import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.application.service.ItemCatalog;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ADMIN + "/items")
public class ItemAdminController {
    private final ItemCatalog catalog;
    public ItemAdminController(ItemCatalog catalog) {
        this.catalog = catalog;
    }
    @GetMapping(version = "1")
    PageSlice<ItemView> list(@RequestParam(required = false) UUID rulesetId,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnchanged, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("rulesetId", "locale", "q", "page", "size", "seasonId", "patchVariantId", "includeUnchanged"));
        return catalog.list(rulesetId, locale, q, page, size, seasonId, patchVariantId, includeUnchanged);
    }
    @GetMapping(path = "/{id}", version = "1")
    ItemView latest(@PathVariable UUID id, @RequestParam(required = false) UUID rulesetId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId"));
        return catalog.latest(id, rulesetId);
    }
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    ItemView create(@Valid @RequestBody Create input) {
        return catalog.create(input);
    }
    @GetMapping(path = "/{id}/revisions", version = "1")
    List<ItemView.Revision> history(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.history(id);
    }
    @GetMapping(path = {"/{id}/revisions/{revisionId}", "/{id}/drafts/{revisionId}"}, version = "1")
    ItemView read(@PathVariable UUID id, @PathVariable UUID revisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.read(id, revisionId);
    }
    @PostMapping(path = "/{id}/drafts", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    ItemView fork(@PathVariable UUID id, @Valid @RequestBody Fork input) {
        return catalog.fork(id, input);
    }
    @PutMapping(path = "/{id}/drafts/{revisionId}", version = "1")
    ItemView update(@PathVariable UUID id, @PathVariable UUID revisionId, @Valid @RequestBody Update input) {
        return catalog.update(id, revisionId, input);
    }
    @PostMapping(path = "/{id}/drafts/{revisionId}/publish", version = "1")
    ItemView publish(@PathVariable UUID id, @PathVariable UUID revisionId, @Valid @RequestBody Mutation input) {
        return catalog.publish(id, revisionId, input);
    }
    @PostMapping(path = "/{id}/drafts/{revisionId}/discard", version = "1")
    ItemView discard(@PathVariable UUID id, @PathVariable UUID revisionId, @Valid @RequestBody Mutation input) {
        return catalog.discard(id, revisionId, input);
    }
}
