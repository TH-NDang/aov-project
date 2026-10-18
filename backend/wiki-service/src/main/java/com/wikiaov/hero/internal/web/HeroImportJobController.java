package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroImportJobRequest;
import com.wikiaov.hero.internal.application.response.HeroImportJobView;
import com.wikiaov.hero.internal.application.service.HeroImportJobs;
import com.wikiaov.platform.ApiPaths;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = ApiPaths.ADMIN + "/heroes/import/jobs", version = "1")
@PreAuthorize("hasAuthority('hero:write')")
public class HeroImportJobController {
    private final HeroImportJobs jobs;
    public HeroImportJobController(HeroImportJobs jobs) {
        this.jobs = jobs;
    }
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    HeroImportJobView create(@Valid @RequestBody HeroImportJobRequest request) {
        return jobs.enqueue(request);
    }
    @GetMapping
    List<HeroImportJobView> list() {
        return jobs.list();
    }
    @GetMapping("/{id}")
    HeroImportJobView get(@PathVariable UUID id) {
        return jobs.get(id);
    }
    @PutMapping("/{id}/notification-dismissal")
    HeroImportJobView dismissNotification(@PathVariable UUID id) {
        return jobs.dismissNotification(id);
    }
}
