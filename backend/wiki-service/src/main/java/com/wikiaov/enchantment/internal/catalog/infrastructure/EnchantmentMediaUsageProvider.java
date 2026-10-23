package com.wikiaov.enchantment.internal.catalog.infrastructure;

import com.wikiaov.enchantment.internal.catalog.application.EnchantmentCatalog;
import com.wikiaov.media.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class EnchantmentMediaUsageProvider implements MediaUsageProvider {
    private final EnchantmentCatalog catalog;

    public EnchantmentMediaUsageProvider(EnchantmentCatalog catalog) {
        this.catalog = catalog;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID id) {
        return catalog.usages(id);
    }
}
