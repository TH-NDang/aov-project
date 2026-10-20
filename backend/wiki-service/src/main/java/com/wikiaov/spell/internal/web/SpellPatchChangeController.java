package com.wikiaov.spell.internal.web;
import com.wikiaov.platform.*;
import com.wikiaov.spell.internal.application.service.SpellPatchChanges;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ADMIN + "/spells/{id}/changes")
public class SpellPatchChangeController {
    private final SpellPatchChanges changes;
    public SpellPatchChangeController(SpellPatchChanges changes) {
        this.changes = changes;
    }
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, UUID> record(@PathVariable UUID id, @RequestBody CatalogChanges.Record input) {
        return Map.of("id", changes.record(id, input));
    }
}
