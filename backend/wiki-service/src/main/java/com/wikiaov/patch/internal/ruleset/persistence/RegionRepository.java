package com.wikiaov.patch.internal.ruleset.persistence;

import com.wikiaov.patch.internal.domain.PatchLifecycleState;
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

    Optional<Region> findByCodeAndLifecycleState(String code, PatchLifecycleState lifecycleState);

    List<Region> findByLifecycleState(PatchLifecycleState lifecycleState);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Region r where r.id=:id")
    Optional<Region> lockById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Region r where r.id=:id and r.lifecycleState=com.wikiaov.patch.internal.domain.PatchLifecycleState.ACTIVE")
    Optional<Region> lockActiveById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Region r order by r.id")
    List<Region> lockAll();

    Region saveAndFlush(Region region);
}
