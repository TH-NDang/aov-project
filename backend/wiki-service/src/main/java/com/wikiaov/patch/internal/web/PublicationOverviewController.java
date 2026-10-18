package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.service.PublicationOverview;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/publication-overview")
public class PublicationOverviewController {
    private final PublicationOverview overview;
    public PublicationOverviewController(PublicationOverview overview) {
        this.overview = overview;
    }

    @GetMapping(version = "1")
    com.wikiaov.patch.internal.application.response.PublicationOverviewView.Snapshot read(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return overview.read();
    }
}
