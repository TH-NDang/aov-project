package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.stats.application.PatchStatDefaults;
import com.wikiaov.patch.internal.stats.application.PatchStatDefaults.*;
import com.wikiaov.platform.ApiPaths;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/patch-variants/{id}/stat-defaults")
public class PatchStatDefaultsController implements PatchStatDefaultsApi {
    private final PatchStatDefaults defaults;

    @GetMapping(version = "1")
    public List<StatDefaultView> effective(@PathVariable UUID id) {
        return defaults.effective(id);
    }

    @PutMapping(path = "/{key}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void set(@PathVariable UUID id, @PathVariable String key, @RequestBody SetStatDefault input) {
        defaults.set(id, key, input);
    }
}
