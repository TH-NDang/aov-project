package com.wikiaov.hero.internal.badges.infrastructure;

import com.wikiaov.hero.internal.badges.persistence.SkinBadgeTranslationRepository;
import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeTranslation;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SkinBadgeMediaUsageProvider implements MediaUsageProvider {
    private final SkinBadgeTranslationRepository repository;

    public SkinBadgeMediaUsageProvider(SkinBadgeTranslationRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return repository.findByIconAssetId(assetId).stream().map(SkinBadgeMediaUsageProvider::usage).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        return repository.findAll().stream().filter(text -> text.getIconAssetId() != null)
                .collect(Collectors.groupingBy(SkinBadgeTranslation::getIconAssetId,
                        Collectors.mapping(SkinBadgeMediaUsageProvider::usage, Collectors.toList())));
    }

    private static MediaUsage usage(SkinBadgeTranslation text) {
        return new MediaUsage("HERO", "SKIN_BADGE", text.getBadgeId(), null, "BADGE_ICON:" + text.getLocale(),
                MediaUsageScope.CURRENT).named(text.getDisplayName(), null);
    }
}
