package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.response.RegionView;
import com.wikiaov.patch.internal.application.service.Regions;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/regions")
public class RegionController implements RegionApi {
    private final Regions regions;
    public RegionController(Regions regions) {
        this.regions = regions;
    }

    @GetMapping(version = "1")
    public List<RegionView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return regions.list();
    }

    @GetMapping(path = "/{code}", version = "1")
    public RegionView select(@PathVariable String code, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return regions.select(code);
    }
}
