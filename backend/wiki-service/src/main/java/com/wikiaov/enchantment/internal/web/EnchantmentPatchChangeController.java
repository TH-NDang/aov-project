package com.wikiaov.enchantment.internal.web;
import com.wikiaov.enchantment.internal.application.service.EnchantmentPatchChanges;
import com.wikiaov.platform.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ADMIN + "/enchantments/{id}/changes")
public class EnchantmentPatchChangeController implements EnchantmentPatchChangeApi {
    private final EnchantmentPatchChanges changes;
    public EnchantmentPatchChangeController(EnchantmentPatchChanges changes) {
        this.changes = changes;
    }
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> record(@PathVariable UUID id, @RequestBody CatalogChanges.Record input) {
        return Map.of("id", changes.record(id, input));
    }
}
