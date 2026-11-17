package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateDraft;
import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateMode;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.GameModeCommands.UpdateMode;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminMode;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminSummary;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.gamemode.internal.catalog.application.GameModeCatalog;
import com.wikiaov.platform.ApiPaths;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/game-modes")
public class GameModeAdminController implements GameModeAdminApi {
    private final GameModeCatalog catalog;

    public GameModeAdminController(GameModeCatalog catalog) {
        this.catalog = catalog;
    }

    @Override
    @GetMapping(version = "1")
    public List<AdminSummary> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.adminList();
    }

    @Override
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminMode create(@RequestBody CreateMode input) {
        return catalog.create(input);
    }

    @Override
    @GetMapping(path = "/{id}", version = "1")
    public AdminMode current(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.current(id);
    }

    @Override
    @GetMapping(path = "/{id}/revisions", version = "1")
    public List<Revision> history(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.history(id);
    }

    @Override
    @GetMapping(path = "/{id}/revisions/{revisionId}", version = "1")
    public AdminMode revision(@PathVariable UUID id, @PathVariable UUID revisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.revision(id, revisionId);
    }

    @Override
    @PostMapping(path = "/{id}/drafts", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminMode createDraft(@PathVariable UUID id, @RequestBody CreateDraft input) {
        return catalog.createDraft(id, input);
    }

    @Override
    @PutMapping(path = "/{id}/drafts/{revisionId}", version = "1")
    public AdminMode update(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody UpdateMode input) {
        return catalog.update(id, revisionId, input);
    }

    @Override
    @PostMapping(path = "/{id}/drafts/{revisionId}/publish", version = "1")
    public AdminMode publish(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return catalog.publish(id, revisionId, input);
    }

    @Override
    @PostMapping(path = "/{id}/drafts/{revisionId}/discard", version = "1")
    public AdminMode discard(@PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return catalog.discard(id, revisionId, input);
    }
}
