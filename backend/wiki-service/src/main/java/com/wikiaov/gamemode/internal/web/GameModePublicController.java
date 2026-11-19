package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.response.GameModeViews.CardList;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Insights;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicGuide;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicMode;
import com.wikiaov.gamemode.internal.catalog.application.GameModeCatalog;
import com.wikiaov.gamemode.internal.guide.application.AutoChessGuides;
import com.wikiaov.gamemode.internal.lineup.application.LineupInteractions;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/game-modes")
public class GameModePublicController implements GameModePublicApi {

    private final GameModeCatalog catalog;

    private final AutoChessGuides guides;

    private final LineupInteractions lineups;

    public GameModePublicController(GameModeCatalog catalog, AutoChessGuides guides, LineupInteractions lineups) {
        this.catalog = catalog;
        this.guides = guides;
        this.lineups = lineups;
    }

    @Override
    @GetMapping(version = "1")
    public CardList list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.cards();
    }

    @Override
    @GetMapping(path = "/{code}", version = "1")
    public PublicMode read(@PathVariable String code, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.published(code);
    }

    @Override
    @GetMapping(path = "/{code}/auto-chess", version = "1")
    public PublicGuide guide(@PathVariable String code, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return guides.published(code);
    }

    @Override
    @GetMapping(path = "/{code}/auto-chess/lineups", version = "1")
    public PageSlice<PublicLineup> lineups(@PathVariable String code,
            @RequestParam(defaultValue = "popular") String sort, @RequestParam(required = false) String unit,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("sort", "unit", "page", "size"));
        return lineups.community(code, sort, unit, page, size);
    }

    @Override
    @GetMapping(path = "/{code}/auto-chess/insights", version = "1")
    public Insights insights(@PathVariable String code, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return lineups.insights(code);
    }
}
