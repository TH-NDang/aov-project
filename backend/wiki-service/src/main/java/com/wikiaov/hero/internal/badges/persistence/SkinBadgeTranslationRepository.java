package com.wikiaov.hero.internal.badges.persistence;

import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkinBadgeTranslationRepository extends JpaRepository<SkinBadgeTranslation, SkinBadgeTranslation.Key> {
    List<SkinBadgeTranslation> findByIconAssetId(UUID assetId);

    List<SkinBadgeTranslation> findByBadgeIdIn(Collection<UUID> ids, Sort sort);
}
