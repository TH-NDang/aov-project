package com.wikiaov.patch.internal.watch.persistence;

import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import com.wikiaov.patch.internal.watch.persistence.entity.PatchNoteSourceCheck;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatchNoteSourceCheckRepository extends JpaRepository<PatchNoteSourceCheck, PatchNoteSource> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PatchNoteSourceCheck c where c.source = :source")
    Optional<PatchNoteSourceCheck> lock(@Param("source") PatchNoteSource source);
}
