package com.wikiaov.patch.internal.authoring.persistence;

import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatch;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface GamePatchRepository extends JpaRepository<GamePatch, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from GamePatch e where e.id = :id")
    Optional<GamePatch> lockById(UUID id);

    Optional<GamePatch> findByIdAndStatus(UUID id, String status);

    List<GamePatch> findAllByOrderBySequenceDesc(Pageable page);
}
