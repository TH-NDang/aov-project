package com.wikiaov.hero.internal.skills.infrastructure;

import com.wikiaov.hero.internal.skills.persistence.HeroSkillImageRepository;
import com.wikiaov.media.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class HeroSkillImageUsages implements MediaUsageProvider {
    private final HeroSkillImageRepository images;

    public HeroSkillImageUsages(HeroSkillImageRepository images) {
        this.images = images;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return images.findByAssetId(assetId).stream().map(image -> new MediaUsage("HERO", "HERO_SKILL_IMAGE",
                image.getHeroId(), null, "SKILL_LIBRARY:" + image.getSourceSlot() + ":" + image.getVariantNo(),
                MediaUsageScope.CURRENT)).toList();
    }
}
