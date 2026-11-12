package com.wikiaov.hero.internal.gallery.infrastructure;

import com.wikiaov.hero.internal.gallery.persistence.HeroGalleryItemRepository;
import com.wikiaov.hero.internal.gallery.persistence.entity.HeroGalleryItem;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** An image attached to a hero's gallery is in use: readers see it there (ADR-027). */
@Component
public class HeroGalleryMediaUsageProvider implements MediaUsageProvider {
    private final HeroGalleryItemRepository items;

    public HeroGalleryMediaUsageProvider(HeroGalleryItemRepository items) {
        this.items = items;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return items.findByAssetId(assetId).stream().map(HeroGalleryMediaUsageProvider::usage).toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        return items.findAll().stream().collect(Collectors.groupingBy(HeroGalleryItem::getAssetId,
                Collectors.mapping(HeroGalleryMediaUsageProvider::usage, Collectors.toList())));
    }

    private static MediaUsage usage(HeroGalleryItem item) {
        return new MediaUsage("HERO", "HERO", item.getHeroId(), null, "GALLERY:" + item.getKind(),
                MediaUsageScope.CURRENT).named(null, item.getCaption());
    }
}
