package com.wikiaov.spell.internal.infrastructure;
import com.wikiaov.media.*;
import com.wikiaov.spell.internal.application.service.SpellCatalog;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
@Component
public class SpellMediaUsageProvider implements MediaUsageProvider {
    private final SpellCatalog catalog;
    public SpellMediaUsageProvider(SpellCatalog catalog) {
        this.catalog = catalog;
    }
    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID id) {
        return catalog.usages(id);
    }
}
