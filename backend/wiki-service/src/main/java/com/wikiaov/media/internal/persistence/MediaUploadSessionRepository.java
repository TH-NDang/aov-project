package com.wikiaov.media.internal.persistence;

import com.wikiaov.media.internal.persistence.entity.MediaUploadSession;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/**
 * Spring Data repository for upload sessions. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaUploadSessionRepository extends Repository<MediaUploadSession, UUID> {

    Optional<MediaUploadSession> findById(UUID id);

    MediaUploadSession save(MediaUploadSession session);
}
