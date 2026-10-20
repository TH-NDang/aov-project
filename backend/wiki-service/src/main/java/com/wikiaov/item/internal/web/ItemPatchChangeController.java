package com.wikiaov.item.internal.web;
import com.wikiaov.item.internal.application.service.ItemPatchChanges;
import com.wikiaov.platform.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ADMIN + "/items/{id}/changes")
public class ItemPatchChangeController {
    private final ItemPatchChanges changes;
    public ItemPatchChangeController(ItemPatchChanges changes) {
        this.changes = changes;
    }
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, UUID> record(@PathVariable UUID id, @RequestBody CatalogChanges.Record input) {
        return Map.of("id", changes.record(id, input));
    }
}
