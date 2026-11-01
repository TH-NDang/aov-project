package com.wikiaov.media.internal.deletion.persistence;

import com.wikiaov.media.internal.deletion.persistence.entity.MediaDeletion;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface MediaDeletionRepository extends Repository<MediaDeletion, UUID> {
    Optional<MediaDeletion> findById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from MediaDeletion d where d.assetId = :id")
    Optional<MediaDeletion> lock(UUID id);

    MediaDeletion saveAndFlush(MediaDeletion deletion);
}
