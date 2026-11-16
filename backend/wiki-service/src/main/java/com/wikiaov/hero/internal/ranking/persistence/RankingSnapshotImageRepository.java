package com.wikiaov.hero.internal.ranking.persistence;

import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotImageRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RankingSnapshotImageRepository
        extends
            JpaRepository<RankingSnapshotImageRow, RankingSnapshotImageRow.Key> {
    List<RankingSnapshotImageRow> findBySnapshotIdOrderByBoardDescPageNoAsc(UUID snapshotId);

    /** Snapshots that keep this screenshot as evidence, with their code (ADR-030 section 7). */
    @Query("""
            select i.snapshotId as snapshotId, s.code as code
            from RankingSnapshotImageRow i join RankingSnapshotRow s on s.id = i.snapshotId
            where i.imageId = :imageId order by s.code
            """)
    List<SnapshotUse> findUsesOfImage(String imageId);

    @Query("select distinct i.imageId from RankingSnapshotImageRow i where i.imageId in :imageIds")
    List<String> findReferencedImageIds(Collection<String> imageIds);

    interface SnapshotUse {
        UUID getSnapshotId();

        String getCode();
    }
}
