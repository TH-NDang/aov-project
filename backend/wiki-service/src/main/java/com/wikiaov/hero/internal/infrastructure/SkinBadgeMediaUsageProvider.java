package com.wikiaov.hero.internal.infrastructure;

import com.wikiaov.hero.internal.persistence.HeroMediaRepository;
import com.wikiaov.hero.internal.persistence.entity.SkinBadgeTranslation;
import com.wikiaov.media.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SkinBadgeMediaUsageProvider implements MediaUsageProvider {
    private final HeroMediaRepository repository;

    public SkinBadgeMediaUsageProvider(HeroMediaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return repository.rows(SkinBadgeTranslation.class, "iconAssetId", List.of(assetId)).stream()
                .map(text -> new MediaUsage("HERO", "SKIN_BADGE", text.getBadgeId(), null,
                        "BADGE_ICON:" + text.getLocale(), MediaUsageScope.CURRENT))
                .toList();
    }
}
