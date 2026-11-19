package com.wikiaov.build.internal.web;

import com.wikiaov.build.internal.application.PublicBuilds;
import com.wikiaov.build.internal.application.response.BuildViews;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/builds")
public class BuildPublicController implements BuildPublicApi {
    private final PublicBuilds builds;

    public BuildPublicController(PublicBuilds builds) {
        this.builds = builds;
    }

    @Override
    @GetMapping(version = "1")
    public ResponseEntity<BuildViews.HeroBuilds> heroBuilds(@RequestParam String hero, @RequestParam String region,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("hero", "region"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(builds.heroBuilds(hero, region));
    }
}
