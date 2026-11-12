package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.BuildRow;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BuildRepository extends JpaRepository<BuildRow, UUID> {
    List<BuildRow> findByCaptureId(UUID captureId);

    Optional<BuildRow> findByIdAndCaptureId(UUID id, UUID captureId);

    List<BuildRow> findByCaptureIdAndHeroIdAndNeedsReviewFalseOrderByListPositionAsc(UUID captureId, UUID heroId);

    long countByCaptureIdAndNeedsReviewTrue(UUID captureId);

    @Query("select b.captureId as captureId, count(b) as total, "
            + "sum(case when b.needsReview = true then 1 else 0 end) as needsReview "
            + "from BuildRow b where b.captureId in :captureIds group by b.captureId")
    List<BuildCount> countByCapture(Collection<UUID> captureIds);

    /** Builds and heroes of confirmed captures that use each arcana page. */
    @Query("""
            select b.arcanaPageId as valueId, count(b) as builds, count(distinct b.heroId) as heroes
            from BuildRow b, CaptureRow c
            where c.id = b.captureId and c.confirmedAt is not null and b.needsReview = false
            and b.arcanaPageId in :pageIds
            group by b.arcanaPageId
            """)
    List<ValueUse> arcanaPageUse(Collection<UUID> pageIds);

    interface BuildCount {
        UUID getCaptureId();

        long getTotal();

        long getNeedsReview();
    }

    interface ValueUse {
        UUID getValueId();

        long getBuilds();

        long getHeroes();
    }
}
