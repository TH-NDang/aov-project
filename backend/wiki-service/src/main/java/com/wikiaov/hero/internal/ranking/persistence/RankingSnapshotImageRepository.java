package com.wikiaov.hero.internal.ranking.persistence;

import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotImageRow;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RankingSnapshotImageRepository
        extends
            JpaRepository<RankingSnapshotImageRow, RankingSnapshotImageRow.Key> {
    List<RankingSnapshotImageRow> findBySnapshotIdOrderByBoardDescPageNoAsc(UUID snapshotId);
}
