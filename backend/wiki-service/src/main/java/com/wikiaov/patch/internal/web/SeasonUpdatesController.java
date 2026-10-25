package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.response.SeasonUpdatesView;
import com.wikiaov.patch.internal.context.application.SeasonUpdates;
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
@RequestMapping(ApiPaths.ROOT + "/seasons/current/updates")
public class SeasonUpdatesController implements SeasonUpdatesApi {
    private final SeasonUpdates updates;

    public SeasonUpdatesController(SeasonUpdates updates) {
        this.updates = updates;
    }

    @GetMapping(version = "1")
    public ResponseEntity<SeasonUpdatesView> current(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "4") int limit,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "limit"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(updates.read(region, locale, limit));
    }
}
