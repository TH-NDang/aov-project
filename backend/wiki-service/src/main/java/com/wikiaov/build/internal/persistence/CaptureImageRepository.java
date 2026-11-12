package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.CaptureImageRow;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CaptureImageRepository extends JpaRepository<CaptureImageRow, CaptureImageRow.Key> {
    List<CaptureImageRow> findByCaptureIdOrderByFileNameAsc(UUID captureId);
}
