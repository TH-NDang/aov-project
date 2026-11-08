package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.SaveLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.LikeState;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.MyState;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.OwnLineup;
import com.wikiaov.gamemode.internal.lineup.application.LineupInteractions;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Likes and saved lineups of the signed-in reader; every route needs a person's bearer token. */
@RestController
@RequestMapping(ApiPaths.ROOT + "/game-modes/{code}/auto-chess")
public class LineupController implements LineupApi {
    private final LineupInteractions lineups;

    public LineupController(LineupInteractions lineups) {
        this.lineups = lineups;
    }

    @GetMapping(path = "/me", version = "1")
    public MyState me(@PathVariable String code, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return lineups.me(code);
    }

    @PutMapping(path = "/lineups/{lineupId}/like", version = "1")
    public LikeState like(@PathVariable String code, @PathVariable UUID lineupId) {
        return lineups.like(code, lineupId);
    }

    @DeleteMapping(path = "/lineups/{lineupId}/like", version = "1")
    public LikeState unlike(@PathVariable String code, @PathVariable UUID lineupId) {
        return lineups.unlike(code, lineupId);
    }

    @PostMapping(path = "/lineups", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public OwnLineup create(@PathVariable String code, @RequestBody SaveLineup input) {
        return lineups.create(code, input);
    }

    @PutMapping(path = "/lineups/{lineupId}", version = "1")
    public OwnLineup update(@PathVariable String code, @PathVariable UUID lineupId, @RequestBody SaveLineup input) {
        return lineups.update(code, lineupId, input);
    }

    @DeleteMapping(path = "/lineups/{lineupId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String code, @PathVariable UUID lineupId, @RequestParam long expectedVersion,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("expectedVersion"));
        lineups.delete(code, lineupId, expectedVersion);
    }
}
