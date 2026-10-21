package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.HeroSkillImage;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroSkillImageRepository extends JpaRepository<HeroSkillImage, UUID> {
    List<HeroSkillImage> findByHeroIdOrderBySourceSlotAscVariantNoAsc(UUID heroId);
    List<HeroSkillImage> findByHeroIdIn(Collection<UUID> heroIds);
    Optional<HeroSkillImage> findByHeroIdAndSourceSlotAndVariantNo(UUID heroId, int sourceSlot, int variantNo);
    List<HeroSkillImage> findByAssetId(UUID assetId);
}
