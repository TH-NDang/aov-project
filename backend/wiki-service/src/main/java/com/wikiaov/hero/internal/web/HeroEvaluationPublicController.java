package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.hero.internal.application.response.HeroTraitsView;
import com.wikiaov.hero.internal.catalog.application.HeroTraitIndex;
import com.wikiaov.hero.internal.ranking.application.PublishedHeroRankings;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class HeroEvaluationPublicController implements HeroEvaluationPublicApi {
    private final PublishedHeroRankings rankings;
    private final HeroTraitIndex traits;

    public HeroEvaluationPublicController(PublishedHeroRankings rankings, HeroTraitIndex traits) {
        this.rankings = rankings;
        this.traits = traits;
    }

    @Override
    @GetMapping(path = "/heroes/{heroId}/ranking", version = "1")
    public HeroRankingViews.Published ranking(@PathVariable UUID heroId,
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = PublishedHeroRankings.DEFAULT_MODE) String mode, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "mode"));
        return rankings.published(heroId, region, mode);
    }

    @Override
    @GetMapping(path = "/hero-rankings", version = "1")
    public HeroRankingViews.PublishedBoard rankings(@RequestParam(defaultValue = "VN") String region,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region"));
        return rankings.board(region, PublishedHeroRankings.DEFAULT_MODE);
    }

    @Override
    @GetMapping(path = "/hero-traits", version = "1")
    public HeroTraitsView traits(@RequestParam(defaultValue = "VN") String region, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region"));
        return traits.read(region);
    }
}
