package com.wikiaov.media.internal.asset.persistence;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/**
 * Spring Data repository for assets. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaAssetRepository extends Repository<MediaAsset, UUID> {

    Optional<MediaAsset> findById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from MediaAsset a where a.id = :id")
    Optional<MediaAsset> lockForWrite(UUID id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select a from MediaAsset a where a.id = :id")
    Optional<MediaAsset> lockForBinding(UUID id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select a from MediaAsset a where a.id in :ids order by a.id")
    List<MediaAsset> lockAllForBinding(Collection<UUID> ids);

    List<MediaAsset> findByIdIn(Collection<UUID> ids);

    MediaAsset save(MediaAsset asset);

    /** Saves and flushes, so the new optimistic lock value is known and conflicts surface immediately. */
    MediaAsset saveAndFlush(MediaAsset asset);

    @Query("select a from MediaAsset a where a.deletedAt is null")
    Page<MediaAsset> findAll(Pageable pageable);

    @Query("select a from MediaAsset a where a.deletedAt is null and a.semanticType = :semanticType")
    Page<MediaAsset> findBySemanticType(MediaSemanticType semanticType, Pageable pageable);

    /** Ids in list order, so a filter computed elsewhere can pick a page without loading every asset. */
    @Query("""
            select a.id from MediaAsset a
            where a.deletedAt is null and (:semanticType is null or a.semanticType = :semanticType)
            order by a.createdAt desc, a.id
            """)
    List<UUID> findIdsNewestFirst(@Nullable MediaSemanticType semanticType);

    /** Match the current version's credits, falling back to asset-wide sources only when none exist. */
    @Query("""
            select a from MediaAsset a
            where (:semanticType is null or a.semanticType = :semanticType)
              and a.semanticType <> com.wikiaov.media.MediaSemanticType.USER_AVATAR
              and a.deletedAt is null
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
                  and p.unverified = false
                  and p.ownerName is not null and trim(p.ownerName) <> ''
              )
            """)
    /** User avatars belong to their user and never need a credit (03, needsCredit). */
    Page<MediaAsset> findNeedingCredit(@Nullable MediaSemanticType semanticType, Pageable pageable);
}
