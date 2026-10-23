package com.wikiaov.media.internal.asset.persistence;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

/**
 * Spring Data repository for assets. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaAssetRepository extends Repository<MediaAsset, UUID> {

    Optional<MediaAsset> findById(UUID id);

    List<MediaAsset> findByIdIn(Collection<UUID> ids);

    MediaAsset save(MediaAsset asset);

    /** Saves and flushes, so the new optimistic lock value is known and conflicts surface immediately. */
    MediaAsset saveAndFlush(MediaAsset asset);

    Page<MediaAsset> findAll(Pageable pageable);

    Page<MediaAsset> findBySemanticType(MediaSemanticType semanticType, Pageable pageable);
}
