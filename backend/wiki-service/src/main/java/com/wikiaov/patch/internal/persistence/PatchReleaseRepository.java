package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.internal.persistence.entity.PatchRelease;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PatchReleaseRepository extends JpaRepository<PatchRelease, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from PatchRelease e where e.id = :id")
    Optional<PatchRelease> lockById(UUID id);
}
