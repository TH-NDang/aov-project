package com.wikiaov.arcana.internal.catalog.infrastructure;

import com.wikiaov.arcana.internal.catalog.application.ArcanaCatalog;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ArcanaMediaUsageProvider implements MediaUsageProvider {
    private final ArcanaCatalog catalog;

    public ArcanaMediaUsageProvider(ArcanaCatalog catalog) {
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
