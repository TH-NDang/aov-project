package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.stats.application.HeroStatRules;
import com.wikiaov.hero.internal.stats.application.HeroStatRules.SetStatRule;
import com.wikiaov.hero.internal.stats.application.HeroStatRules.StatRuleView;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/hero-stat-rules")
public class HeroStatRulesController implements HeroStatRulesApi {
    private final HeroStatRules rules;

    @Override
    @GetMapping(version = "1")
    public List<StatRuleView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return rules.list();
    }

    @Override
    @PutMapping(path = "/{key}", version = "1")
    public StatRuleView set(@PathVariable String key, @RequestBody SetStatRule input) {
        return rules.set(key, input);
    }

    @Override
    @DeleteMapping(path = "/{key}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable String key, @RequestParam long expectedVersion) {
        rules.remove(key, expectedVersion);
    }
}
