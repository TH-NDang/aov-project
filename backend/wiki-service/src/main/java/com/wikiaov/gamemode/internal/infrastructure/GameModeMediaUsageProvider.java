package com.wikiaov.gamemode.internal.infrastructure;

import com.wikiaov.gamemode.internal.catalog.application.GameModeCatalog;
import com.wikiaov.gamemode.internal.guide.application.AutoChessGuides;
import com.wikiaov.gamemode.internal.mapguide.application.MapGuides;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells Media where mode art, auto-chess icons and map art are used, so used images are not deprecated. */
@Component
public class GameModeMediaUsageProvider implements MediaUsageProvider {
    private final GameModeCatalog catalog;

    private final AutoChessGuides guides;

    private final MapGuides maps;

    public GameModeMediaUsageProvider(GameModeCatalog catalog, AutoChessGuides guides, MapGuides maps) {
        this.catalog = catalog;
        this.guides = guides;
        this.maps = maps;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        var usages = new ArrayList<>(catalog.usages(assetId));
        usages.addAll(guides.usages(assetId));
        usages.addAll(maps.usages(assetId));
        return usages;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        var usages = new HashMap<UUID, List<MediaUsage>>();
        catalog.allUsages().forEach((id, list) -> usages.computeIfAbsent(id, key -> new ArrayList<>()).addAll(list));
        guides.allUsages().forEach((id, list) -> usages.computeIfAbsent(id, key -> new ArrayList<>()).addAll(list));
        maps.allUsages().forEach((id, list) -> usages.computeIfAbsent(id, key -> new ArrayList<>()).addAll(list));
        usages.replaceAll((id, list) -> list.stream().map(usage -> usage.named(null, null)).toList());
        return usages;
    }
}
