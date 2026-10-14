package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.internal.persistence.entity.Region;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface RegionRepository extends Repository<Region, UUID> {
    List<Region> findAllByOrderBySortOrderAscCodeAsc();
    Optional<Region> findByCode(String code);
}
