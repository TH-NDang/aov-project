package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroImportJobRequest;
import com.wikiaov.hero.internal.application.response.HeroImportJobView;
import com.wikiaov.hero.internal.importing.application.HeroImportJobs;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/import/jobs")
public class HeroImportJobController implements HeroImportJobApi {
    private final HeroImportJobs jobs;

    public HeroImportJobController(HeroImportJobs jobs) {
        this.jobs = jobs;
    }

    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public HeroImportJobView create(@RequestBody HeroImportJobRequest request) {
        return jobs.enqueue(request);
    }

    @GetMapping(version = "1")
    public List<HeroImportJobView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return jobs.list();
    }

    @GetMapping(path = "/{id}", version = "1")
    public HeroImportJobView get(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return jobs.get(id);
    }

    @PutMapping(path = "/{id}/notification-dismissal", version = "1")
    public HeroImportJobView dismissNotification(@PathVariable UUID id) {
        return jobs.dismissNotification(id);
    }
}
