package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.stats.application.HeroStatRules;
import com.wikiaov.hero.internal.stats.application.HeroStatRules.StatRuleView;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ROOT + "/hero-stat-rules")
public class HeroStatRulesPublicController implements HeroStatRulesPublicApi {
    private final HeroStatRules rules;

    @Override
    @GetMapping(version = "1")
    public List<StatRuleView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return rules.published();
    }
}
