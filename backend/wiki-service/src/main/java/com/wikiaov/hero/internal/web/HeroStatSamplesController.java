package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.stats.application.HeroStatSamples;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/patch-variants/{id}/hero-stat-samples")
public class HeroStatSamplesController implements HeroStatSamplesApi {
    private final HeroStatSamples samples;

    @GetMapping(version = "1")
    public List<HeroStatSamples.Sample> forPatch(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return samples.forPatch(id);
    }
}
