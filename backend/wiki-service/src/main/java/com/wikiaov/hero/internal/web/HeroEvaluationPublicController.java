package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.hero.internal.catalog.application.HeroTraitIndex;
import com.wikiaov.hero.internal.ranking.application.HeroRankings;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class HeroEvaluationPublicController implements HeroEvaluationPublicApi {
    private final HeroRankings rankings;
    private final HeroTraitIndex traits;

    public HeroEvaluationPublicController(HeroRankings rankings, HeroTraitIndex traits) {
        this.rankings = rankings;
        this.traits = traits;
    }

    @GetMapping(path = "/heroes/{heroId}/ranking", version = "1")
    public HeroRankingViews.Published ranking(@PathVariable UUID heroId,
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "RANKED_ELITE") String mode, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "mode"));
        return rankings.published(heroId, region, mode);
    }

    @GetMapping(path = "/hero-traits", version = "1")
    public Map<String, Object> traits(@RequestParam(defaultValue = "VN") String region, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region"));
        return traits.read(region);
    }
}
