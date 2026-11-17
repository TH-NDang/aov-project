package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.stats.application.PatchStatDefaults;
import com.wikiaov.patch.internal.stats.application.PatchStatDefaults.SetStatDefault;
import com.wikiaov.patch.internal.stats.application.PatchStatDefaults.StatDefaultView;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/patch-variants/{id}/stat-defaults")
public class PatchStatDefaultsController implements PatchStatDefaultsApi {
    private final PatchStatDefaults defaults;

    @Override
    @GetMapping(version = "1")
    public List<StatDefaultView> effective(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return defaults.effective(id);
    }

    @Override
    @PutMapping(path = "/{key}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void set(@PathVariable UUID id, @PathVariable String key, @RequestBody SetStatDefault input) {
        defaults.set(id, key, input);
    }
}
