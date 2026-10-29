package com.wikiaov.media.internal.contact.persistence;

import com.wikiaov.media.internal.contact.persistence.entity.MediaContactRequest;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface MediaContactRepository extends Repository<MediaContactRequest, UUID> {
    MediaContactRequest save(MediaContactRequest request);

    Optional<MediaContactRequest> findById(UUID id);

    Page<MediaContactRequest> findAll(Pageable pageable);
}
