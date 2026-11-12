package com.wikiaov.hero.internal.ranking.persistence;

import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotHeroRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RankingSnapshotHeroRepository
        extends
            JpaRepository<RankingSnapshotHeroRow, RankingSnapshotHeroRow.Key> {
    List<RankingSnapshotHeroRow> findBySnapshotId(UUID snapshotId);

    @Query("select h.snapshotId as snapshotId, count(h) as total from RankingSnapshotHeroRow h "
            + "where h.snapshotId in :snapshotIds group by h.snapshotId")
    List<HeroCount> countBySnapshot(Collection<UUID> snapshotIds);

    interface HeroCount {
        UUID getSnapshotId();

        long getTotal();
    }
}
