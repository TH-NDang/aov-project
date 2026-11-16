package com.wikiaov.media.internal.source.persistence;

import com.wikiaov.media.internal.source.persistence.entity.SourceUploadSession;
import java.time.Instant;
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
    @Query(value = """
            SELECT count(*) AS files, coalesce(sum(declared_size_bytes), 0) AS bytes
            FROM media.source_upload_session
            WHERE state IN ('REQUESTED', 'VALIDATING') AND expires_at > :now
            """, nativeQuery = true)
    SourceObjectRepository.Total pending(@Param("now") Instant now);
}
