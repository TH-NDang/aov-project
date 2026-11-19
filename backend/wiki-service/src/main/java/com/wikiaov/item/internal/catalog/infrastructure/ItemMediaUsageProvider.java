package com.wikiaov.item.internal.catalog.infrastructure;

import com.wikiaov.item.internal.catalog.application.ItemCatalog;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ItemMediaUsageProvider implements MediaUsageProvider {
    private final ItemCatalog catalog;

    public ItemMediaUsageProvider(ItemCatalog catalog) {
        this.catalog = catalog;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID id) {
        return catalog.usages(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        return catalog.allUsages();
    }
}
