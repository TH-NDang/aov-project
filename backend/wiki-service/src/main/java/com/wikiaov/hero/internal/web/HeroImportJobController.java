package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroImportJobRequest;
import com.wikiaov.hero.internal.application.response.HeroImportJobView;
import com.wikiaov.hero.internal.importing.application.HeroImportJobs;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/import/jobs")
public class HeroImportJobController implements HeroImportJobApi {
    private final HeroImportJobs jobs;

    public HeroImportJobController(HeroImportJobs jobs) {
        this.jobs = jobs;
    }

    @Override
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public HeroImportJobView create(@RequestBody HeroImportJobRequest request) {
        return jobs.enqueue(request);
    }

    @Override
    @GetMapping(version = "1")
    public List<HeroImportJobView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return jobs.list();
    }

    @Override
    @GetMapping(path = "/{id}", version = "1")
    public HeroImportJobView get(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return jobs.get(id);
    }

    @Override
    @PutMapping(path = "/{id}/notification-dismissal", version = "1")
    public HeroImportJobView dismissNotification(@PathVariable UUID id) {
        return jobs.dismissNotification(id);
    }
}
