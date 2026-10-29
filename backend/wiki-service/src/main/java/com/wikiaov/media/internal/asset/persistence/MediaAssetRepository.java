package com.wikiaov.media.internal.asset.persistence;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
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

    /** Match the current version's credits, falling back to asset-wide sources only when none exist. */
    @Query("""
            select a from MediaAsset a
            where (:semanticType is null or a.semanticType = :semanticType)
              and a.currentVersionId is not null
              and not exists (
                select p.id from MediaProvenance p
                where p.assetId = a.id
                  and (p.assetVersionId = a.currentVersionId or (
                    p.assetVersionId is null and not exists (
                      select currentSource.id from MediaProvenance currentSource
                      where currentSource.assetId = a.id
                        and currentSource.assetVersionId = a.currentVersionId
                    )
                  ))
                  and trim(p.sourceLabel) <> ''
                  and p.sourceLabel not like '%Chưa xác minh%'
                  and p.ownerName is not null and trim(p.ownerName) <> ''
              )
            """)
    Page<MediaAsset> findNeedingCredit(@Nullable MediaSemanticType semanticType, Pageable pageable);
}
