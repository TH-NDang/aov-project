package com.wikiaov.media.internal.asset.persistence;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAssetVersion;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data repository for asset versions. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaAssetVersionRepository extends Repository<MediaAssetVersion, UUID> {

    Optional<MediaAssetVersion> findById(UUID id);

    MediaAssetVersion save(MediaAssetVersion version);

    List<MediaAssetVersion> findByAssetIdOrderByVersionNoDesc(UUID assetId);

    List<MediaAssetVersion> findByAssetIdInOrderByVersionNoDesc(Collection<UUID> assetIds);

    List<MediaAssetVersion> findByIdIn(Collection<UUID> ids);

    Optional<MediaAssetVersion> findByAssetIdAndSha256(UUID assetId, String sha256);

    /** Stored versions per semantic type; assets whose bytes were deleted no longer count (ADR-030 section 9). */
    @Query("""
            select a.semanticType as semanticType, count(v) as files, coalesce(sum(v.sizeBytes), 0) as bytes
            from MediaAssetVersion v join MediaAsset a on a.id = v.assetId
            where a.deletedAt is null
            group by a.semanticType
            """)
    List<SemanticTotal> totalsBySemanticType();

    /** Versions created per UTC month since {@code from}, including those whose bytes were deleted later. */
    @Query(value = """
            SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
                   count(*) AS files, coalesce(sum(size_bytes), 0) AS bytes
            FROM media.media_asset_version
            WHERE created_at >= :from
            GROUP BY 1
            """, nativeQuery = true)
    List<MonthTotal> totalsByMonth(@Param("from") Instant from);

    /** Which of {@code sha256s} are bytes of a version whose asset still has its bytes. */
    @Query("""
            select distinct v.sha256 from MediaAssetVersion v join MediaAsset a on a.id = v.assetId
            where a.deletedAt is null and v.sha256 in :sha256s
            """)
    List<String> findStoredSha256In(@Param("sha256s") Collection<String> sha256s);

    interface SemanticTotal {
        MediaSemanticType getSemanticType();

        long getFiles();

        long getBytes();
    }

    interface MonthTotal {
        String getMonth();

        long getFiles();

        long getBytes();
    }
}
