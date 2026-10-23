package com.wikiaov.arcana.internal.catalog.persistence;

import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaIdentity;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ArcanaIdentityRepository extends JpaRepository<ArcanaIdentity, UUID> {
    Optional<ArcanaIdentity> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ArcanaIdentity e where e.id=:id")
    Optional<ArcanaIdentity> lockById(UUID id);
}
