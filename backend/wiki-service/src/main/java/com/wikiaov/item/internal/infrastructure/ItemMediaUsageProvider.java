package com.wikiaov.item.internal.infrastructure;
import com.wikiaov.item.internal.application.service.ItemCatalog;
import com.wikiaov.media.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
@Component
public class ItemMediaUsageProvider implements MediaUsageProvider {
    private final ItemCatalog catalog;
    public ItemMediaUsageProvider(ItemCatalog catalog) {
        this.catalog = catalog;
    }
    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID id) {
        return catalog.usages(id);
    }
}
