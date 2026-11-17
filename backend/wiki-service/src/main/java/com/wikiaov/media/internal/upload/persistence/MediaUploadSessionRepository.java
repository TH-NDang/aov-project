package com.wikiaov.media.internal.upload.persistence;

import com.wikiaov.media.internal.domain.model.UploadState;
import com.wikiaov.media.internal.upload.persistence.entity.MediaUploadSession;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data repository for upload sessions. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaUploadSessionRepository extends Repository<MediaUploadSession, UUID> {

    Optional<MediaUploadSession> findById(UUID id);

    MediaUploadSession save(MediaUploadSession session);

    List<MediaUploadSession> findByAssetId(UUID assetId);

    /** Uploads still waiting in the private staging area, with the size their clients declared. */
    @Query("""
            select count(s) as files, coalesce(sum(s.declaredSizeBytes), 0) as bytes from MediaUploadSession s
            where s.state in :states and s.expiresAt > :now
            """)
    Pending pending(@Param("now") Instant now, @Param("states") Collection<UploadState> states);

    /** Uploads neither stored nor refused yet. */
    default Pending pending(Instant now) {
        return pending(now, List.of(UploadState.REQUESTED, UploadState.VALIDATING));
    }

    interface Pending {
        long getFiles();

        long getBytes();
    }
}
