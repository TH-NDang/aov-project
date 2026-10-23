package com.wikiaov.patch.internal.ruleset.persistence;

import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface RegionRepository extends Repository<Region, UUID> {
    List<Region> findAllByOrderBySortOrderAscCodeAsc();

    Optional<Region> findByCode(String code);

    Optional<Region> findById(UUID id);

    Optional<Region> findByCodeAndLifecycleState(String code, String lifecycleState);

    List<Region> findByLifecycleState(String lifecycleState);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Region r where r.id=:id")
    Optional<Region> lockById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Region r where r.id=:id and r.lifecycleState='ACTIVE'")
    Optional<Region> lockActiveById(UUID id);

    Region saveAndFlush(Region region);
}
