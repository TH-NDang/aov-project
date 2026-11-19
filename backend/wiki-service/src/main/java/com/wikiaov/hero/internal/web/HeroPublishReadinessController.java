package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView;
import com.wikiaov.hero.internal.catalog.application.HeroPublishReadiness;
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
@RequestMapping(ApiPaths.ADMIN + "/heroes/publish-readiness")
public class HeroPublishReadinessController implements HeroPublishReadinessApi {
    private final HeroPublishReadiness readiness;

    @Override
    @GetMapping(version = "1")
    public List<HeroPublishReadinessView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return readiness.list();
    }
}
