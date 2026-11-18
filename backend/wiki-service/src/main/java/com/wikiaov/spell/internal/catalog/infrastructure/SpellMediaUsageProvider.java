package com.wikiaov.spell.internal.catalog.infrastructure;

import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        return catalog.allUsages();
    }
}
