package com.wikiaov.hero.internal.badges.infrastructure;

import com.wikiaov.hero.internal.badges.persistence.SkinBadgeTranslationRepository;
import com.wikiaov.media.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SkinBadgeMediaUsageProvider implements MediaUsageProvider {
    private final SkinBadgeTranslationRepository repository;

    public SkinBadgeMediaUsageProvider(SkinBadgeTranslationRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return repository.findByIconAssetId(assetId).stream()
                .map(text -> new MediaUsage("HERO", "SKIN_BADGE", text.getBadgeId(), null,
                        "BADGE_ICON:" + text.getLocale(), MediaUsageScope.CURRENT))
                .toList();
    }
}
