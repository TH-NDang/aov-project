package com.wikiaov.enchantment.internal.catalog.infrastructure;

import com.wikiaov.enchantment.internal.catalog.application.EnchantmentCatalog;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class EnchantmentMediaUsageProvider implements MediaUsageProvider {
    private final EnchantmentCatalog catalog;

    public EnchantmentMediaUsageProvider(EnchantmentCatalog catalog) {
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
