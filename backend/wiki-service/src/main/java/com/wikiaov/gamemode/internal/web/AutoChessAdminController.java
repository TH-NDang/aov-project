package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateGuideDraft;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.GameModeCommands.UpdateGuide;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Visibility;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminGuide;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.gamemode.internal.guide.application.AutoChessGuides;
import com.wikiaov.gamemode.internal.lineup.application.LineupInteractions;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/game-modes/{modeId}/auto-chess")
public class AutoChessAdminController implements AutoChessAdminApi {
    private final AutoChessGuides guides;

    private final LineupInteractions lineups;

    public AutoChessAdminController(AutoChessGuides guides, LineupInteractions lineups) {
        this.guides = guides;
        this.lineups = lineups;
    }

    @GetMapping(version = "1")
    public AdminGuide current(@PathVariable UUID modeId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return guides.current(modeId);
    }

    @GetMapping(path = "/revisions", version = "1")
    public List<Revision> history(@PathVariable UUID modeId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return guides.history(modeId);
    }

    @GetMapping(path = "/revisions/{revisionId}", version = "1")
    public AdminGuide revision(@PathVariable UUID modeId, @PathVariable UUID revisionId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return guides.revision(modeId, revisionId);
    }

    @PostMapping(path = "/drafts", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminGuide createDraft(@PathVariable UUID modeId, @RequestBody CreateGuideDraft input) {
        return guides.createDraft(modeId, input);
    }

    @PutMapping(path = "/drafts/{revisionId}", version = "1")
    public AdminGuide update(@PathVariable UUID modeId, @PathVariable UUID revisionId,
            @RequestBody UpdateGuide input) {
        return guides.update(modeId, revisionId, input);
    }

    @PostMapping(path = "/drafts/{revisionId}/publish", version = "1")
    public AdminGuide publish(@PathVariable UUID modeId, @PathVariable UUID revisionId,
            @RequestBody Mutation input) {
        return guides.publish(modeId, revisionId, input);
    }

    @PostMapping(path = "/drafts/{revisionId}/discard", version = "1")
    public AdminGuide discard(@PathVariable UUID modeId, @PathVariable UUID revisionId,
            @RequestBody Mutation input) {
        return guides.discard(modeId, revisionId, input);
    }

    @GetMapping(path = "/community-lineups", version = "1")
    public PageSlice<AdminLineup> communityLineups(@PathVariable UUID modeId,
            @RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("status", "page", "size"));
        if (status != null && !Set.of("VISIBLE", "HIDDEN").contains(status) || page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "Use status VISIBLE or HIDDEN, page from 0 and size from 1 to 100.");
        return lineups.adminList(modeId, status, page, size);
    }

    @PostMapping(path = "/community-lineups/{lineupId}/visibility", version = "1")
    public AdminLineup visibility(@PathVariable UUID modeId, @PathVariable UUID lineupId,
            @RequestBody Visibility input) {
        return lineups.visibility(modeId, lineupId, input);
    }
}
