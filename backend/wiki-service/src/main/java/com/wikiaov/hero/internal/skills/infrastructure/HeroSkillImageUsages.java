package com.wikiaov.hero.internal.skills.infrastructure;

import com.wikiaov.hero.internal.skills.persistence.HeroSkillImageRepository;
import com.wikiaov.hero.internal.skills.persistence.entity.HeroSkillImage;
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
public class HeroSkillImageUsages implements MediaUsageProvider {
    private final HeroSkillImageRepository images;

    public HeroSkillImageUsages(HeroSkillImageRepository images) {
        this.images = images;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return images.findByAssetId(assetId).stream().map(HeroSkillImageUsages::usage).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        return images.findAll().stream().collect(Collectors.groupingBy(HeroSkillImage::getAssetId,
                Collectors.mapping(HeroSkillImageUsages::usage, Collectors.toList())));
    }

    /** The library only feeds the Admin picker; readers see the icon chosen on the skill, reported on its own. */
    private static MediaUsage usage(HeroSkillImage image) {
        return new MediaUsage("HERO", "HERO_SKILL_IMAGE", image.getHeroId(), null,
                "SKILL_LIBRARY:" + image.getSourceSlot() + ":" + image.getVariantNo(), MediaUsageScope.CURRENT)
                .storedOnly();
    }
}
