package com.wikiaov.hero.internal.ranking.persistence;

import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RankingSnapshotValueRepository
        extends
            JpaRepository<RankingSnapshotValueRow, RankingSnapshotValueRow.Key> {
    List<RankingSnapshotValueRow> findBySnapshotId(UUID snapshotId);

    long countBySnapshotIdAndNeedsReviewTrue(UUID snapshotId);

    @Query("select v.snapshotId as snapshotId, count(v) as total, "
            + "sum(case when v.needsReview = true then 1 else 0 end) as needsReview "
            + "from RankingSnapshotValueRow v where v.snapshotId in :snapshotIds group by v.snapshotId")
    List<ValueCount> countBySnapshot(Collection<UUID> snapshotIds);

    interface ValueCount {
        UUID getSnapshotId();

        long getTotal();

        long getNeedsReview();
    }
}
