package com.wikiaov.item.internal.web;

import com.wikiaov.item.internal.change.application.ItemPatchChanges;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CreatedId;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/items/{id}/changes")
public class ItemPatchChangeController implements ItemPatchChangeApi {
    private final ItemPatchChanges changes;

    public ItemPatchChangeController(ItemPatchChanges changes) {
        this.changes = changes;
    }

    @Override
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId record(@PathVariable UUID id, @RequestBody CatalogChanges.Record input) {
        return new CreatedId(changes.record(id, input));
    }
}
