package com.wikiaov.arcana.internal.infrastructure;
import com.wikiaov.arcana.internal.application.service.ArcanaCatalog;
import com.wikiaov.media.*;
import java.util.*;
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
}
