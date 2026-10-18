package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroSection;
import java.util.List;
import java.util.Map;

public record HeroComparisonView(
        String status,
        HeroRevisionView from,
        HeroRevisionView to,
        Map<HeroSection, Object> before,
        Map<HeroSection, Object> after,
        List<Difference> changes,
        List<String> warnings
) {
    public record Difference(
            HeroSection section,
            String path,
            String kind,
            Object before,
            Object after
    ) {
    }
}
