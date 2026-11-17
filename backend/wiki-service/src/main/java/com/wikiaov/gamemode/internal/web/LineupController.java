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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Likes and saved lineups of the signed-in reader. Like every {@code /users/me} route, each one needs a person's bearer
 * token and is never cached.
 */
@RestController
@RequestMapping(ApiPaths.ROOT + "/users/me/game-modes/{code}/auto-chess")
public class LineupController implements LineupApi {
    private final LineupInteractions lineups;

    public LineupController(LineupInteractions lineups) {
        this.lineups = lineups;
    }

    @GetMapping(version = "1")
    public MyState me(@PathVariable String code, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return lineups.me(code);
    }

    @PutMapping(path = "/likes/{lineupId}", version = "1")
    public LikeState like(@PathVariable String code, @PathVariable UUID lineupId) {
        return lineups.like(code, lineupId);
    }

    @DeleteMapping(path = "/likes/{lineupId}", version = "1")
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
