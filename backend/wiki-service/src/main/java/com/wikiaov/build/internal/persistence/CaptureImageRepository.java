package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.CaptureImageRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CaptureImageRepository extends JpaRepository<CaptureImageRow, CaptureImageRow.Key> {
    List<CaptureImageRow> findByCaptureIdOrderByFileNameAsc(UUID captureId);

    /** Captures that keep this screenshot as evidence, with their code (ADR-030 section 7). */
    @Query("""
            select i.captureId as captureId, c.code as code
            from CaptureImageRow i join CaptureRow c on c.id = i.captureId
            where i.imageId = :imageId order by c.code
            """)
    List<CaptureUse> findUsesOfImage(String imageId);

    @Query("select distinct i.imageId from CaptureImageRow i where i.imageId in :imageIds")
    List<String> findReferencedImageIds(Collection<String> imageIds);

    interface CaptureUse {
        UUID getCaptureId();

        String getCode();
    }
}
