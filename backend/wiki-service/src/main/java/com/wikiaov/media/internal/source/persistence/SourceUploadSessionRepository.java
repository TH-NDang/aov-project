package com.wikiaov.media.internal.source.persistence;

import com.wikiaov.media.internal.domain.model.UploadState;
import com.wikiaov.media.internal.source.persistence.entity.SourceUploadSession;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Uploads of source files. Only the declared methods exist; Spring Data implements them. */
public interface SourceUploadSessionRepository extends Repository<SourceUploadSession, UUID> {

    Optional<SourceUploadSession> findById(UUID id);

    SourceUploadSession save(SourceUploadSession session);

    /** Uploads still waiting in the private staging area, with the size their clients declared. */
    @Query("""
            select count(s) as files, coalesce(sum(s.declaredSizeBytes), 0) as bytes from SourceUploadSession s
            where s.state in :states and s.expiresAt > :now
            """)
    SourceObjectRepository.Total pending(@Param("now") Instant now, @Param("states") Collection<UploadState> states);

    /** Uploads neither stored nor refused yet. */
    default SourceObjectRepository.Total pending(Instant now) {
        return pending(now, List.of(UploadState.REQUESTED, UploadState.VALIDATING));
    }
}
