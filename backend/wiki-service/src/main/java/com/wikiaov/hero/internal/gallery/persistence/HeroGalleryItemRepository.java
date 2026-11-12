package com.wikiaov.hero.internal.gallery.persistence;

import com.wikiaov.hero.internal.gallery.persistence.entity.HeroGalleryItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HeroGalleryItemRepository extends JpaRepository<HeroGalleryItem, UUID> {
    List<HeroGalleryItem> findByHeroIdOrderBySortOrderAscCreatedAtAsc(UUID heroId);

    Optional<HeroGalleryItem> findByIdAndHeroId(UUID id, UUID heroId);

    boolean existsByHeroIdAndAssetId(UUID heroId, UUID assetId);

    List<HeroGalleryItem> findByAssetId(UUID assetId);

    @Query("select coalesce(max(i.sortOrder), -1) from HeroGalleryItem i where i.heroId = :heroId")
    int lastSortOrder(UUID heroId);
}
