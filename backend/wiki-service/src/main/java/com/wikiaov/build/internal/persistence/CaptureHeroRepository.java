package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.CaptureHeroRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CaptureHeroRepository extends JpaRepository<CaptureHeroRow, CaptureHeroRow.Key> {
    List<CaptureHeroRow> findByCaptureIdOrderByCaptureOrderAsc(UUID captureId);

    @Query("select h.captureId as captureId, count(h) as total from CaptureHeroRow h "
            + "where h.captureId in :captureIds group by h.captureId")
    List<HeroCount> countByCapture(Collection<UUID> captureIds);

    interface HeroCount {
        UUID getCaptureId();

        long getTotal();
    }
}
