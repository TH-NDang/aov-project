package com.wikiaov.hero.internal.shop.persistence;

import com.wikiaov.hero.internal.shop.persistence.entity.SkinAcquisitionRow;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkinAcquisitionRepository extends JpaRepository<SkinAcquisitionRow, SkinAcquisitionRow.Key> {
    List<SkinAcquisitionRow> findByHeroIdAndRegionCodeOrderBySkinKey(UUID heroId, String regionCode);
}
