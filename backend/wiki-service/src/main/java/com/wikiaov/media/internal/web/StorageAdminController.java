package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.capacity.application.StorageCapacity;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews;
import com.wikiaov.media.internal.web.request.SourceRequests;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/storage")
class StorageAdminController implements StorageAdminApi {

    private final StorageCapacity capacity;

    StorageAdminController(StorageCapacity capacity) {
        this.capacity = capacity;
    }

    @GetMapping(path = "/summary", version = "1")
    public StorageCapacityViews.Summary summary(HttpServletRequest http) {
        QueryParameters.requireOnly(http, Set.of());
        return capacity.summary();
    }

    @PostMapping(path = "/estimates", version = "1")
    public StorageCapacityViews.Estimate estimate(@RequestBody SourceRequests.Estimate body) {
        return capacity.estimate(body.target(),
                body.files().stream().map(SourceRequests.EstimateFile::toFile).toList());
    }
}
