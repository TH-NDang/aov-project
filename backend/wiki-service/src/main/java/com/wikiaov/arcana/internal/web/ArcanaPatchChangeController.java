package com.wikiaov.arcana.internal.web;

import com.wikiaov.arcana.internal.change.application.ArcanaPatchChanges;
import com.wikiaov.platform.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/arcana/{id}/changes")
public class ArcanaPatchChangeController implements ArcanaPatchChangeApi {
    private final ArcanaPatchChanges changes;

    public ArcanaPatchChangeController(ArcanaPatchChanges changes) {
        this.changes = changes;
    }

    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> record(@PathVariable UUID id, @RequestBody CatalogChanges.Record input) {
        return Map.of("id", changes.record(id, input));
    }
}
