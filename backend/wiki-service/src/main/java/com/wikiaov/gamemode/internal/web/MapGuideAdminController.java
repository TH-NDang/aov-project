package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminMap;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.gamemode.internal.mapguide.application.CreateMapDraftCommand;
import com.wikiaov.gamemode.internal.mapguide.application.MapGuides;
import com.wikiaov.gamemode.internal.mapguide.application.UpdateMapCommand;
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
@RequestMapping(ApiPaths.ADMIN + "/game-modes/{modeId}/map")
public class MapGuideAdminController implements MapGuideAdminApi {
    private final MapGuides maps;

    public MapGuideAdminController(MapGuides maps) {
        this.maps = maps;
    }

    @Override
    @GetMapping(version = "1")
    public AdminMap current(@PathVariable UUID modeId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return maps.current(modeId);
    }

    @Override
    @GetMapping(path = "/revisions", version = "1")
    public List<Revision> history(@PathVariable UUID modeId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return maps.history(modeId);
    }

    @Override
    @GetMapping(path = "/revisions/{revisionId}", version = "1")
    public AdminMap revision(@PathVariable UUID modeId, @PathVariable UUID revisionId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return maps.revision(modeId, revisionId);
    }

    @Override
    @PostMapping(path = "/drafts", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminMap createDraft(@PathVariable UUID modeId, @RequestBody CreateMapDraftCommand input) {
        return maps.createDraft(modeId, input);
    }

    @Override
    @PutMapping(path = "/drafts/{revisionId}", version = "1")
    public AdminMap update(@PathVariable UUID modeId, @PathVariable UUID revisionId,
            @RequestBody UpdateMapCommand input) {
        return maps.update(modeId, revisionId, input);
    }

    @Override
    @PostMapping(path = "/drafts/{revisionId}/publish", version = "1")
    public AdminMap publish(@PathVariable UUID modeId, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return maps.publish(modeId, revisionId, input);
    }

    @Override
    @PostMapping(path = "/drafts/{revisionId}/discard", version = "1")
    public AdminMap discard(@PathVariable UUID modeId, @PathVariable UUID revisionId, @RequestBody Mutation input) {
        return maps.discard(modeId, revisionId, input);
    }
}
